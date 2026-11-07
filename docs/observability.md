# Grafana + Prometheus for Nexora

This is the full path from "the API is a black box" to a running dashboard. It
covers the code that is already in this repository, the Docker stack that runs
Prometheus, Alertmanager and Grafana, how to point it at the Render service, and
what to do when a panel is empty.

Prometheus and Grafana are for **service health**: traffic, latency, errors,
memory, event-loop lag. They are not a sales or stock dashboard — those numbers
live in the app's reports and in Postgres, and the last section explains when a
Grafana Postgres datasource is the right tool instead.

---

## 1. How the pieces fit

```
  Flutter app ──HTTP──► Nexora API ──► Supabase Postgres
                            │
                            │ GET /metrics   (Prometheus text format)
                            ▼
                      ┌────────────┐    scrape every 30 s / 60 s
                      │ Prometheus │◄──────────────────────────────┐
                      └─────┬──────┘                               │
                            │ rules                                │
                            ▼                                      │
                     ┌──────────────┐                        ┌─────┴──────┐
                     │ Alertmanager │                        │  Nexora API │
                     └──────────────┘                        │  local:4100 │
                                                             │  or Render  │
                      ┌────────────┐                         └─────────────┘
                      │   Grafana  │── PromQL ──► Prometheus
                      └────────────┘
```

Prometheus **pulls**. It needs a machine that stays on; Render only runs the API,
so the stack lives on your laptop, a small VPS, or inside Grafana Cloud.

What is already in the repository:

| Path                                                | What it does                                          |
| --------------------------------------------------- | ----------------------------------------------------- |
| `apps/api/src/metrics/metrics.service.ts`           | Registry, HTTP counters/histogram, process metrics    |
| `apps/api/src/metrics/http-metrics.middleware.ts`   | Counts every request when the response finishes       |
| `apps/api/src/metrics/metrics.controller.ts`        | `GET /metrics`, token check, `no-store`               |
| `apps/api/src/metrics/metrics.module.ts`            | Wires the controller before routes are mounted        |
| `infra/observability/docker-compose.yml`            | Prometheus, Alertmanager, Grafana                     |
| `infra/observability/prometheus/*.yml`              | Scrape jobs and alert rules                           |
| `infra/observability/grafana/**`                    | Provisioned datasource, dashboard provider, dashboard |
| `infra/observability/secrets/metrics_token.example` | Placeholder for the scrape token                      |
| `infra/observability/scripts/record-test-run.sh`    | Posts a test-run annotation to Grafana (§13)          |

---

## 2. The API side (already implemented)

### 2.1 The endpoint

`GET /metrics` is **outside** the `/api/v1` prefix, like the health probes. It is
public to the auth guard and exempt from the rate limiter; Prometheus must be
able to poll it.

```bash
curl http://localhost:4100/metrics | head -30
```

The output is the Prometheus text format. Every series uses the `nexora_` prefix.

### 2.2 The token

`METRICS_TOKEN` is validated at boot (minimum 16 characters). The controller
accepts either header:

```http
Authorization: Bearer <token>
x-metrics-token: <token>
```

Behaviour:

| `NODE_ENV`         | `METRICS_TOKEN` | `GET /metrics`        |
| ------------------ | --------------- | --------------------- |
| development / test | empty           | open                  |
| development / test | set             | token required        |
| production         | empty           | **404** (fail closed) |
| production         | set             | token required        |

A missing token in production does not stop the API from booting — it makes the
endpoint pretend it does not exist. That is deliberate: a forgotten secret must
not publish traffic and memory data.

Generate one:

```bash
openssl rand -hex 32
```

Set it on Render (Environment → `METRICS_TOKEN`) and redeploy. Locally, add it to
the root `.env` only if you want to test the protected path.

### 2.3 What is published

HTTP series (labels are bounded — never a raw path, tenant id or product id):

| Metric                                 | Type      | Labels                      |
| -------------------------------------- | --------- | --------------------------- |
| `nexora_http_requests_total`           | counter   | `method`, `route`, `status` |
| `nexora_http_request_duration_seconds` | histogram | `method`, `route`, `status` |
| `nexora_http_requests_in_flight`       | gauge     | `method`                    |
| `nexora_build_info`                    | gauge     | `service`, `node_version`   |

Process series come from prom-client and share the prefix:

```text
nexora_process_cpu_user_seconds_total
nexora_process_resident_memory_bytes
nexora_nodejs_heap_size_used_bytes
nexora_nodejs_eventloop_lag_p99_seconds
nexora_nodejs_gc_duration_seconds
...
```

Scrape-time labels (`environment`, `service`) are attached by Prometheus, not by
the API, so the same build works locally and on Render.

### 2.4 Adding a business metric (optional)

Prometheus is good at counters, not at per-item lists. Add a counter where the
business event is already committed, with a **small** label set:

```ts
// metrics.service.ts
readonly salesCompleted = new Counter({
  name: `${METRICS_PREFIX}sales_completed_total`,
  help: 'Sales posted, by channel.',
  labelNames: ['channel'],
  registers: [this.registry],
});
```

```ts
// after the transaction commits
this.metrics.salesCompleted.inc({ channel: sale.channel === 'counter' ? 'counter' : 'other' });
```

Do not label with `organization_id`, `product_id`, `user_id` or a free-text
reason: each distinct value is a separate time series and will melt Prometheus.
If you need per-tenant detail, query Postgres from Grafana instead (§10).

---

## 3. Run the stack locally

Prerequisite: Docker Desktop (Windows/macOS) or Docker Engine + Compose (Linux).
At least 2 GB of free RAM for the three containers.

```bash
cd infra/observability

cp .env.example .env
# edit .env: set a long GRAFANA_ADMIN_PASSWORD

cp secrets/metrics_token.example secrets/metrics_token
# paste the same token as METRICS_TOKEN on Render; not needed for the local job
```

Start:

```bash
docker compose up -d
docker compose ps
```

Ports are bound to loopback only:

| URL                   | Service      | Notes                           |
| --------------------- | ------------ | ------------------------------- |
| http://localhost:3001 | Grafana      | login with the values in `.env` |
| http://localhost:9090 | Prometheus   | targets, graph, `/alerts`       |
| http://localhost:9093 | Alertmanager | silence and routing             |

The dashboard is provisioned on boot: **Dashboards → Nexora → Nexora API**
(`http://localhost:3001/d/nexora-api`).

### 3.1 Generate some traffic

With the API running (`npm run dev --workspace @mystock/api`):

```bash
for i in $(seq 1 30); do curl -s http://localhost:4100/api/v1/missing > /dev/null; done
curl -s http://localhost:4100/health > /dev/null
```

Wait one scrape interval (30 s), then open Prometheus → Status → Targets. Both
`nexora-api-local` and `nexora-api-render` are listed; the Render one is `down`
until the token is correct and the service is awake.

Useful direct checks:

```bash
curl 'http://localhost:9090/api/v1/query?query=sum(rate(nexora_http_requests_total[5m]))'
curl 'http://localhost:9090/api/v1/targets?state=active'
```

### 3.2 If Docker is not available

You can still instrument and inspect the API without the stack: `curl` the
`/metrics` endpoint, or point a Prometheus binary at it. The Grafana dashboard
JSON and the provisioning files are plain files in this repository and work with
any Prometheus + Grafana installation.

---

## 4. Point Prometheus at Render

The Render API is already a scrape job in
`infra/observability/prometheus/prometheus.yml`:

```yaml
- job_name: nexora-api-render
  metrics_path: /metrics
  scheme: https
  scrape_interval: 60s
  scrape_timeout: 45s
  static_configs:
    - targets: ['nexora-web-service.onrender.com']
      labels:
        service: nexora-api
        environment: production
  authorization:
    type: Bearer
    credentials_file: /etc/prometheus-secrets/metrics_token
```

Steps:

1. On Render, set `METRICS_TOKEN` to a generated value and redeploy. Verify:

   ```bash
   TOKEN=... # the value you set
   curl -s -H "Authorization: Bearer $TOKEN" \
     https://nexora-web-service.onrender.com/metrics | head
   ```

   A `404` means the variable is missing or the deploy is older than the
   instrumentation. A `401` is not possible — the endpoint answers `404` for a
   bad token on purpose.

2. Put the same value in `infra/observability/secrets/metrics_token` (no quotes,
   one line) and restart Prometheus:

   ```bash
   docker compose restart prometheus
   ```

3. Check the target in Prometheus → Status → Targets. The first scrape of a
   sleeping free instance can time out; the next one, within 60 s, succeeds.

### 4.1 Free Render behaviour you must plan for

- A free web service sleeps after **15 idle minutes**. Scraping every 60 s counts
  as traffic, so Prometheus keeps it awake — that consumes roughly 730 of the
  750 free instance hours per month and leaves no headroom for a second service.
- Even with traffic, Render may still spin the instance down; the first scrape
  after a wake takes 30–50 s and can exceed `scrape_timeout`. `up` then flaps.
- `NexoraApiDown` fires after 5 minutes of failed scrapes. On a free service that
  is also what an idle night looks like; either upgrade the API to an always-on
  instance, or silence that alert for the production target during closed hours.
- If the machine running Prometheus sleeps, monitoring stops. A production setup
  belongs on a small always-on VPS (or Grafana Cloud), not on a laptop.

### 4.2 Where should Prometheus live?

| Option                                       | Cost          | Trade-off                                               |
| -------------------------------------------- | ------------- | ------------------------------------------------------- |
| Your laptop                                  | free          | monitoring only while it is on                          |
| 1 vCPU / 1 GB VPS with this compose file     | ~€4–6 / month | full control; you patch it                              |
| Grafana Cloud free + Grafana Alloy on a host | free tier     | no Prometheus to maintain; the agent still needs a host |

There is no way to run Prometheus _inside_ the Render web service: it is a
separate stateful process with a disk, and Render only runs the API container.

---

## 5. The dashboard

Open **Nexora API** in Grafana. Two variables at the top filter every panel:

- **Environment** — `local`, `production` (from the scrape jobs).
- **Route** — Express route patterns such as `/api/v1/catalog/items/:id`.

| Panel               | Query                                                                        | What it answers               |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| Request rate        | `sum(rate(nexora_http_requests_total[$__rate_interval]))`                    | is traffic normal?            |
| 5xx error rate      | 5xx / all requests                                                           | are users seeing failures?    |
| p95 latency         | `histogram_quantile(0.95, sum by (le) (rate(..._bucket[$__rate_interval])))` | is the API slow?              |
| In flight           | `sum(nexora_http_requests_in_flight)`                                        | are requests piling up?       |
| Rate by route       | `sum by (route) (rate(...))`                                                 | which workflow is busy?       |
| Latency percentiles | p50 / p95 / p99                                                              | tail latency                  |
| Responses by status | `sum by (status) (rate(...))`                                                | 401 storm? 429 throttling?    |
| Slowest routes      | `topk(8, histogram_quantile(0.95, ...))`                                     | where to optimise             |
| Process memory      | RSS + heap used                                                              | leak or normal plateau        |
| Event loop lag      | `nexora_nodejs_eventloop_lag_p99_seconds`                                    | synchronous blocking          |
| Uptime              | `time() - max(nexora_process_start_time_seconds)`                            | restarts                      |
| Scrape targets up   | `sum(up{job=~"nexora-api-.*"})`                                              | is monitoring itself healthy? |
| Requests, 24 h      | `sum(increase(...[24h]))`                                                    | daily volume                  |

The dashboard is provisioned from
`infra/observability/grafana/dashboards/nexora-api.json`. Edit it in the UI only
if `allowUiUpdates` is on (it is off); otherwise edit the JSON and commit it — the
file is the source of truth.

After a deploy the counters restart at zero. That is normal; `rate()` handles the
reset, and the uptime panel shows why a graph dropped.

---

## 6. Alerts

Rules live in `infra/observability/prometheus/alerts.yml`:

| Alert                  | Expression                      | For  |
| ---------------------- | ------------------------------- | ---- |
| `NexoraApiDown`        | `up{job=~"nexora-api-.*"} == 0` | 5 m  |
| `NexoraHighErrorRate`  | 5xx ratio > 5%                  | 10 m |
| `NexoraSlowP95`        | p95 > 2 s                       | 10 m |
| `NexoraMemoryPressure` | RSS > 450 MB (512 MB instance)  | 15 m |
| `NexoraEventLoopLag`   | p99 lag > 500 ms                | 10 m |

They are visible in Prometheus → Alerts and in Alertmanager. **Nothing is sent
anywhere yet**: `alertmanager/alertmanager.yml` uses an empty default receiver.
Add Slack, e-mail or a webhook there, then:

```bash
docker compose restart alertmanager
```

Reload Prometheus after editing rules (the compose file enables the lifecycle
API):

```bash
curl -X POST http://localhost:9090/-/reload
```

Tune thresholds against your own traffic before trusting the pages. A shop that
closes at night should not page for a 5xx at 03:00; use Alertmanager silences or
the alert's `for` window.

---

## 7. Production layout of the stack

For an always-on stack, use a small VPS:

1. Install Docker and the Compose plugin.
2. Copy `infra/observability` to the server (without `secrets/metrics_token`
   ending up in git).
3. `docker compose up -d`, then reach the UIs through an SSH tunnel:

   ```bash
   ssh -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090 user@vps
   ```

4. Do not publish 3000/9090 on a public interface. If you need public Grafana,
   put Caddy or nginx with HTTPS in front and keep Grafana's own login.
5. Back up `grafana-data` and `prometheus-data` volumes; the dashboards and rules
   are already in git.

Retention defaults to 15 days (`PROMETHEUS_RETENTION` in `.env`). At Nexora's
series count that is a few hundred MB. Raise it only with disk headroom.

---

## 8. Security checklist

- `METRICS_TOKEN` is long, random and different from every other secret.
- The token file is `0600` on the host and gitignored.
- Prometheus and Grafana ports stay on loopback (the compose file does this).
- Grafana admin password is not the default; sign-up and anonymous access are off.
- The API's scrape token, Supabase keys and database password never appear in a
  Grafana datasource or dashboard JSON.
- `/metrics` must never expose tenant, product or user identifiers in labels.
- Prometheus stores 15 days of traffic metadata; treat the volume as internal data.

---

## 9. Troubleshooting

| Symptom                                        | Likely cause                                  | Fix                                                                                                      |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Target `down`, `401`/`404` in the error column | token missing or different on Render          | set `METRICS_TOKEN`, redeploy, update `secrets/metrics_token`, restart Prometheus                        |
| `404` from `/metrics` in production            | `METRICS_TOKEN` not set                       | set it; the endpoint is fail-closed                                                                      |
| `404` from `/metrics` locally                  | API process is older than the instrumentation | restart `npm run dev`                                                                                    |
| Panel "No data"                                | variable filter excludes everything           | set Environment and Route to All                                                                         |
| Render target flaps every 15 minutes           | free instance sleeps                          | expected; upgrade or accept a `NexoraApiDown` during idle                                                |
| Latency panel empty                            | no requests in the window                     | generate traffic or widen the time range                                                                 |
| Grafana login fails after changing `.env`      | password only applies at first boot           | `docker compose down && docker compose up -d` (keeps the volume; admin password persists after creation) |
| Port already in use                            | another service on 3001/9090/9093             | change the left side of the port mapping                                                                 |
| Rules not firing                               | Prometheus not reloaded                       | `curl -X POST localhost:9090/-/reload`                                                                   |

---

## 10. When it is not a Prometheus question

- **Sales, stock, top products, per-tenant totals**: these are rows in Postgres,
  not time series. Add a read-only Postgres role and a Grafana **PostgreSQL**
  datasource, then write SQL panels. Never use the service-role key or the
  database owner in Grafana.
- **Uptime from outside the API**: add the Blackbox exporter and probe
  `https://nexora-web-service.onrender.com/health/ready` (it checks Postgres and
  the document renderer, not just the process). Keep the token-protected
  `/metrics` for internals.
- **Logs**: Prometheus does not store logs. Add Loki (or Render's log stream) if
  you need request-level history.
- **The Flutter app**: phones cannot be scraped. Use crashes and traces (Sentry,
  OpenTelemetry → Tempo) if you need client-side visibility; Prometheus only sees
  the requests that reach the API.

---

## 11. What was verified in this repository

- `GET /metrics` serves Prometheus text outside `/api/v1`, with
  `nexora_http_requests_total`, the latency histogram, in-flight gauge, process
  and event-loop series.
- The HTTP middleware records the **final** status code (including Nest's default
  `201` for POST) when the response finishes, and uses route patterns, not raw
  paths.
- Without a token the endpoint is open in development/test and `404` in
  production; with a token it accepts `Authorization: Bearer` and
  `x-metrics-token` and rejects everything else.
- The metrics e2e suite (`apps/api/test/metrics.e2e.test.ts`) covers those cases,
  plus the `unmatched` label for unknown paths.
- The Docker stack was started end to end on Docker Desktop 4.98 (Engine 29.9.2,
  Compose v5.6.1): Prometheus 3.16.0, Alertmanager v0.34.2 and Grafana 13.3.0.
  `nexora-api-local` is `up` and scraping a host API on `:4100`; Prometheus
  answered the dashboard's rate, status and p95 queries; the five alert rules
  loaded (`NexoraApiDown` pending only because the Render target was `down`).
  Grafana provisioned the `Prometheus` datasource (uid `nexora-prometheus`) and
  the `Nexora API` dashboard, which rendered live values across all 13 panels in
  a signed-in browser session.
- The Render target currently reports `down` with `HTTP 404 Not Found`: that is
  the production fail-closed behaviour until `METRICS_TOKEN` is set on the
  Render service and the same value is written to
  `infra/observability/secrets/metrics_token`. `NexoraApiDown` firing on Render
  is therefore expected before that step.
- Running Compose exposed one real defect that native testing could not: the
  secrets volume was mounted at `/etc/prometheus/secrets`, inside the
  read-only `/etc/prometheus` mount, so Docker could not create the mountpoint.
  The stack now mounts `./secrets` at `/etc/prometheus-secrets`, and
  `prometheus.yml` reads the token from there.
- `promtool` validated the config and all five rules, and a dashboard pass
  confirmed the 5xx stat renders `0%` with no traffic errors and that an unknown
  path is charted as `unmatched` rather than the raw wildcard.
- The test-run annotation path was exercised against the running stack: the
  `API test runs` annotation query appeared on the dashboard, the recorder
  posted annotation `#1` (`api tests: 352 passed, 0 failed in 119s`), and the
  purple marker rendered on every time-series panel.

---

## 12. Step by step: how this setup was actually built

This is the exact sequence, including the dead end that was fixed. It assumes
the repository is already cloned and dependencies are installed.

### 12.1 Add the metrics library and the four source files

```bash
npm install prom-client@15.1.3 --workspace @mystock/api
```

| File                                              | Responsibility                                                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/metrics/metrics.service.ts`         | Owns the `Registry`; defines the request counter, latency histogram, in-flight gauge and `nexora_build_info`; calls `collectDefaultMetrics({ prefix: 'nexora_' })` for process and Node.js series |
| `apps/api/src/metrics/http-metrics.middleware.ts` | Starts a timer per request, increments the in-flight gauge, and records on `finish`/`close` so the **final** status code is used                                                                  |
| `apps/api/src/metrics/metrics.controller.ts`      | `GET /metrics`, token check, `text/plain; version=0.0.4`, `no-store`                                                                                                                              |
| `apps/api/src/metrics/metrics.module.ts`          | `@Global()` module exporting the service and mounting the controller                                                                                                                              |

Two decisions matter more than the code:

- **Labels are route patterns, never raw paths.** `routeLabel()` reads the
  matched Express route (`/api/v1/organizations/:organizationId/products`). Any
  route containing `*` — Express 5's fallback for unknown paths — becomes
  `unmatched`. Tenant ids, product ids and raw URLs never enter a label.
- **Recording happens after the response.** Nest returns `201` for POSTs and
  the status is not final until the response is written; the middleware listens
  to `finish` (and `close` for aborted requests) and guards against double
  counting.

### 12.2 Wire it into the application

```ts
// app.module.ts
import { MetricsModule } from './metrics/metrics.module';
...
imports: [..., DatabaseModule, MetricsModule],
```

```ts
// app.setup.ts
app.use(helmet());
app.use(httpMetricsMiddleware(app.get(MetricsService)));
app.setGlobalPrefix('api/v1', {
  exclude: [...healthExcludes, { path: 'metrics', method: RequestMethod.GET }],
});
```

`METRICS_TOKEN` is validated at boot in `packages/config/src/env.ts`
(`z.string().min(16).optional()`). The controller computes the decision at
request time:

```ts
const expected = env.METRICS_TOKEN;
if (!expected) return env.NODE_ENV !== 'production'; // open in dev, 404 in prod
// else compare Bearer / x-metrics-token with timingSafeEqual
```

An invalid credential throws `NotFoundException`, not `UnauthorizedException`:
a scanner should not learn that a metrics endpoint exists.

### 12.3 Run the API tests

```bash
# everything (packages build first, then each workspace's test script)
npm test

# API only
npm test --workspace @mystock/api

# only the metrics suite
npm test --workspace @mystock/api -- test/metrics.e2e.test.ts
```

The run on 2026-11-07 produced **44 files / 352 tests passing in ~119 s**.
The API suite uses Vitest with PGlite (an in-process PostgreSQL) and a local
JWKS server, so it needs no Docker and no hosted database.

`test/metrics.e2e.test.ts` contains eight cases:

1. serves Prometheus text outside the versioned prefix;
2. does not expose metrics under `/api/v1`;
3. labels unknown paths without putting the raw URL in a series;
4. hides the endpoint without a credential;
5. rejects a wrong bearer token;
6. accepts the bearer token Prometheus sends;
7. accepts the `x-metrics-token` header;
8. fails closed in production without a token.

**These results stay in the terminal.** Nothing in the test run pushes to
Grafana — see §13 for what that means and for the annotation bridge that was
added.

### 12.4 Build and run the API on the host

```bash
npm run build --workspace @mystock/api
cd apps/api && node dist/main.js        # reads the root .env, listens on :4100
```

```bash
curl -s http://127.0.0.1:4100/metrics | head -5
```

With the root `.env` (`NODE_ENV=development`) and no `METRICS_TOKEN`, the
endpoint is open so the local scrape job needs no credential.

### 12.5 Start the stack

```bash
cd infra/observability
cp .env.example .env                    # set GRAFANA_ADMIN_PASSWORD
cp secrets/metrics_token.example secrets/metrics_token
docker compose up -d
docker compose ps
```

The first start on Docker Desktop 4.98 failed with:

```text
error mounting "/run/desktop/mnt/host/.../secrets" ... create mountpoint ...:
read-only file system
```

Cause: `./secrets` was mounted at `/etc/prometheus/secrets`, which is inside the
read-only `/etc/prometheus` mount, so Docker could not create the mountpoint.
The fix was to mount it as a sibling:

```yaml
- ./prometheus:/etc/prometheus:ro
- ./secrets:/etc/prometheus-secrets:ro
```

and change `credentials_file` to
`/etc/prometheus-secrets/metrics_token`.

### 12.6 Scrape jobs

`prometheus/prometheus.yml` defines two API jobs. Neither uses a raw URL path
template; both read the same metric names:

```yaml
- job_name: nexora-api-local
  static_configs:
    - targets: ['host.docker.internal:4100']
      labels: { service: nexora-api, environment: local }

- job_name: nexora-api-render
  scheme: https
  scrape_interval: 60s
  scrape_timeout: 45s
  static_configs:
    - targets: ['nexora-web-service.onrender.com']
      labels: { service: nexora-api, environment: production }
  authorization:
    type: Bearer
    credentials_file: /etc/prometheus-secrets/metrics_token
```

`host.docker.internal` works natively on Docker Desktop; the
`extra_hosts: host-gateway` entry covers Linux.

### 12.7 Provision Grafana from files, not clicks

Three small files under `infra/observability/grafana/` do all the setup:

| File                                      | Effect                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `provisioning/datasources/prometheus.yml` | `Prometheus` datasource, uid `nexora-prometheus`, `http://prometheus:9090`, default, not editable           |
| `provisioning/dashboards/nexora.yml`      | Folders `Nexora`, provider reads `/var/lib/grafana/dashboards`, refresh every 30 s, `allowUiUpdates: false` |
| `dashboards/nexora-api.json`              | The 13 panels, `environment`/`route` variables, and the `API test runs` annotation query                    |

The dashboard's queries, in order:

| Panel               | PromQL                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| Request rate        | `sum(rate(nexora_http_requests_total{environment=~"$environment"}[$__rate_interval]))` |
| 5xx error rate      | 5xx rate ÷ total rate with `clamp_min(..., 1e-9)`, `or vector(0)`                      |
| p95 latency         | `histogram_quantile(0.95, sum by (le) (rate(...bucket ...)))`                          |
| Requests in flight  | `sum(nexora_http_requests_in_flight)`                                                  |
| Rate by route       | `sum by (route) (rate(...{route=~"$route"}...))`                                       |
| Latency percentiles | p50 / p95 / p99 of the histogram                                                       |
| Responses by status | `sum by (status) (rate(...))`                                                          |
| Slowest routes      | `topk(8, histogram_quantile(0.95, sum by (le, route) (...)))`                          |
| Process memory      | RSS and heap-used gauges                                                               |
| Event loop lag      | `nexora_nodejs_eventloop_lag_p99_seconds`                                              |
| Uptime              | `time() - max(nexora_process_start_time_seconds)`                                      |
| Scrape targets up   | `sum(up{job=~"nexora-api-.*"})`                                                        |
| Requests, last 24 h | `sum(increase(nexora_http_requests_total[24h]))`                                       |

Because the JSON is mounted read-only and `allowUiUpdates` is false, the
dashboard in Git is the dashboard in Grafana. Edit the JSON, wait up to 30 s
(or restart the container), and the change appears.

### 12.8 Verify without guessing

```bash
# containers (from infra/observability/)
docker compose ps
# scrape health
curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job:.labels.job, health, lastError}'
# one value
curl -s 'localhost:9090/api/v1/query?query=sum(rate(nexora_http_requests_total[5m]))'
# Grafana (reuse the admin password from .env)
GRAFANA_PASSWORD=$(grep '^GRAFANA_ADMIN_PASSWORD=' .env | cut -d= -f2-)
curl -s localhost:3001/api/health
curl -s -u "admin:$GRAFANA_PASSWORD" localhost:3001/api/dashboards/uid/nexora-api
```

At the time of writing: `nexora-api-local` was `up` (9 ms scrapes),
`nexora-api-render` was `down` with `HTTP 404` (token not yet set on Render),
p95 was ≈ 4.8 ms, and all 13 panels rendered in a logged-in browser.

---

## 13. API tests and Grafana: what did and did not happen

The short version: **the 352-test run was never published to Grafana.** The
dashboard was populated by Prometheus scraping the running API while traffic
was generated with `curl`. There is no hidden test-results pipeline, and the
dashboard does not claim one.

Why not push test results into Prometheus directly:

- Prometheus **pulls** long-running targets. A Vitest run is a short-lived
  process that exits, and its PGlite database disappears with it.
- HTTP metrics only exist while the API is serving. Test assertions do not
  produce Prometheus samples.

What was added so a test run can be recorded on the dashboard — as an
**annotation**, which is the right shape for a discrete event:

1. The dashboard now has an `API test runs` annotation query, enabled by
   default, matching the tag `api-tests`. It draws purple dashed markers on
   every time-series panel.
2. `infra/observability/scripts/record-test-run.sh` posts an annotation with the
   counts, the duration and a `passed`/`failed` tag.

Run it after a suite:

```bash
GRAFANA_PASSWORD=$(grep '^GRAFANA_ADMIN_PASSWORD=' infra/observability/.env | cut -d= -f2-) \
  infra/observability/scripts/record-test-run.sh 352 0 119 api
```

```json
{ "id": 1, "message": "Annotation added" }
```

In CI, use a Grafana service-account token instead of a password:

```bash
GRAFANA_URL=https://grafana.example.com \
GRAFANA_TOKEN=$GRAFANA_SA_TOKEN \
  infra/observability/scripts/record-test-run.sh "$PASSED" "$FAILED" "$SECONDS" api
```

To read them back:

```bash
curl -s -u "admin:$(grep '^GRAFANA_ADMIN_PASSWORD=' infra/observability/.env | cut -d= -f2-)" \
  'localhost:3001/api/annotations?tags=api-tests&limit=10'
```

If you need **numbers** over time (pass rate, duration per commit) rather than
markers, that is a batch-job series: push them to a Pushgateway, scrape the
Pushgateway, and plot `test_suite_passed` / `test_suite_duration_seconds`.
Pushgateway is not part of this stack because per-run counters are easy to
misread and annotations already answer "did the run pass, and when".
The detailed per-test report stays in Allure: `npm run report:allure`.

---

## 14. Every Git push, automatically

Two different things happen on a push, and only one of them needs CI:

| What                     | Trigger                                          | Where it shows                                           |
| ------------------------ | ------------------------------------------------ | -------------------------------------------------------- |
| The deployed API changes | Render auto-deploy (already on)                  | `/metrics` on Render → `environment="production"` series |
| The test run is recorded | GitHub Actions job in `.github/workflows/ci.yml` | `API test runs` markers on the dashboard                 |

Prometheus does the first part by itself: it scrapes Render every 60 s, so a
successful deploy appears in the production series without any workflow. The
annotation is what carries the test verdict onto the same timeline.

### 14.1 What the workflow does

The `quality` job in `.github/workflows/ci.yml` now runs the API suite once and
writes machine-readable results:

```yaml
- name: Unit and integration tests
  id: unit-tests
  run: |
    npm run build:packages
    start=$(date +%s)
    set +e
    npm test --workspace @mystock/api -- \
      --reporter=default \
      --reporter=json \
      --outputFile.json="$RUNNER_TEMP/api-test-results.json"
    status=$?
    set -e
    echo "seconds=$(( $(date +%s) - start ))" >> "$GITHUB_OUTPUT"
    exit $status
```

Then a best-effort step reads `numPassedTests` / `numFailedTests`, posts the
annotation, and exits successfully even if Grafana is unreachable:

```yaml
- name: Record the test run in Grafana
  if: always()
  continue-on-error: true
  env:
    GRAFANA_URL: ${{ secrets.GRAFANA_URL }}
    GRAFANA_TOKEN: ${{ secrets.GRAFANA_TOKEN }}
  ...
```

When the two secrets are absent — the state of a fresh fork, or a pull request
from a fork — the step prints a skip message and the build stays green. The
`--reporter=default` flag keeps the readable Vitest output in the job log; only
the JSON file goes to `$RUNNER_TEMP`.

### 14.2 Make Grafana reachable from the runner

GitHub-hosted runners cannot reach `http://localhost:3001` on your laptop. Pick
one of these:

| Option                        | `GRAFANA_URL`                 | Notes                                                                                                                              |
| ----------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Self-hosted runner on this PC | `http://localhost:3001`       | The runner runs on the same machine as Docker; simplest for a single operator                                                      |
| Grafana on a VPS              | `https://grafana.example.com` | Put it behind HTTPS and keep Prometheus unexposed; only Grafana needs to be public                                                 |
| Grafana Cloud (free tier)     | `https://<org>.grafana.net`   | Reachable from CI; the local dashboard does not see those annotations, so either use Cloud for everything or forward metrics to it |
| Tunnel (cloudflared/ngrok)    | the tunnel URL                | Works, but a public URL to an admin tool must be token-protected, rate-limited and short-lived                                     |

Do not expose the local stack's ports as-is: they are deliberately bound to
`127.0.0.1` in `docker-compose.yml`.

### 14.3 Create the CI identity

Use a **service account**, never the admin password:

1. Grafana → Administration → Users and access → Service accounts → **Add
   service account**.
2. Name it `ci-annotations`, role **Editor** (Viewer cannot create
   annotations).
3. Add a token, copy the `glsa_...` value once.
4. GitHub → Settings → Secrets and variables → Actions → add:
   - `GRAFANA_URL`
   - `GRAFANA_TOKEN`

The repository secrets are only injected into trusted workflows, so forked pull
requests skip the annotation automatically.

### 14.4 Result

On the next push to `main`, the `quality` job finishes and a purple marker
appears at the run's timestamp:

```text
api 3f9c2ab tests: 352 passed, 0 failed in 118s
```

Tags are `api-tests` plus `passed` or `failed`, so the marker is visible on
every panel and queryable:

```bash
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
  "$GRAFANA_URL/api/annotations?tags=api-tests&limit=10"
```

The token path was verified against the running stack: a temporary service
account with the Editor role posted annotation `#2`, after which the account
was deleted. The first annotation (`#1`, `admin`) came from the password path.
