# The observability toolchain

Every tool in the stack, what it does, how it is configured in this repository,
and how to operate it. This is the reference companion to
[`observability.md`](observability.md), which is the step-by-step tutorial:
local stack, pointing Prometheus at Render, dashboard panels, security and
troubleshooting.

The boundaries are deliberate. The stack answers **service health** questions —
is the API up, how much traffic, how slow, how many errors, is it leaking
memory. It does not answer business questions about sales or stock; those live
in the app's reports and Postgres.

Versions and URLs below were read from the running stack on 2026-11-08.

Contents:

1. [One job per tool](#1-one-job-per-tool)
2. [The stack at a glance](#2-the-stack-at-a-glance)
3. [How one slow request becomes a Slack message](#3-how-one-slow-request-becomes-a-slack-message)
4. [Prometheus](#4-prometheus)
5. [Alertmanager](#5-alertmanager)
6. [Grafana](#6-grafana)
7. [Slack](#7-slack)
8. [Supporting tools](#8-supporting-tools)
9. [Integration points](#9-integration-points)
10. [Configuration reference](#10-configuration-reference)
11. [Day-2 operations](#11-day-2-operations)
12. [Glossary](#12-glossary)
13. [Further reading](#13-further-reading)

---

## 1. One job per tool

| Concern                   | Tool                       | Owns                                                     | Does not own                      |
| ------------------------- | -------------------------- | -------------------------------------------------------- | --------------------------------- |
| Produce numbers           | Nexora API + `prom-client` | Counters, histograms, gauges, process metrics            | Storage, rules, graphs            |
| Collect and store         | Prometheus 3.16.0          | Scraping, time-series database, PromQL, alert rules      | Notifications, long-term storage  |
| Decide who hears about it | Alertmanager 0.34.2        | Grouping, routing, deduplication, silencing, delivery    | Computing alert conditions        |
| Ask and display           | Grafana 13.3.0             | Queries, panels, variables, annotations                  | Storing metrics, evaluating rules |
| Deliver                   | Slack                      | The message a human actually reads                       | History, retries, severity logic  |
| Run everything            | Docker Compose             | Containers, networks, volumes, environment interpolation | Orchestration, HA, auto-scaling   |
| Feed test results         | Shell + Node scripts, CI   | Grafana annotations for test runs                        | Production telemetry              |

Only **metrics** are collected. Application logs stay in Render's log stream (or
the API's terminal when run locally); the observability containers log to Docker.
No traces are captured. That is a complete answer for this service today: the
failure modes that matter (down, slow, erroring, leaking) are visible in metrics,
and a request still carries a route, status and duration.

---

## 2. The stack at a glance

| Tool         | Version | Address (loopback only) | Configuration in git                                          | Persistent volume   |
| ------------ | ------- | ----------------------- | ------------------------------------------------------------- | ------------------- |
| Prometheus   | 3.16.0  | http://localhost:9090   | `infra/observability/prometheus/prometheus.yml`, `alerts.yml` | `prometheus-data`   |
| Alertmanager | 0.34.2  | http://localhost:9093   | `infra/observability/alertmanager/alertmanager.yml`           | `alertmanager-data` |
| Grafana      | 13.3.0  | http://localhost:3001   | `infra/observability/grafana/**`                              | `grafana-data`      |
| Slack        | hosted  | —                       | `infra/observability/secrets/slack_webhook` (untracked)       | —                   |

Docker Compose project name: `nexora-observability`. Images are pinned by tag,
not `latest`, so a `docker compose pull` is a deliberate upgrade, not a surprise.

```
 Browser ──► Grafana :3001 ──PromQL──► Prometheus :9090 ──scrape──► Nexora API
                                             │               local :4100 / Render HTTPS
                                             │
                                             │ alert rules every 30 s
                                             ▼
                                      Alertmanager :9093
                                             │ grouping, routing, silences
                                             ▼
                                       Slack #nexora-alerts
```

All three UIs are bound to `127.0.0.1`. Reach them through an SSH tunnel or put a
TLS reverse proxy in front; never publish 9090/9093/3001 directly. Grafana talks
to Prometheus over the Compose network, so Prometheus never needs a public
address.

---

## 3. How one slow request becomes a Slack message

1. A request finishes. `http-metrics-middleware.ts` records its method, route
   pattern, status and duration, and decrements the in-flight gauge.
2. Prometheus scrapes `GET /metrics` — every 30 s locally, every 60 s for
   Render. Each scrape reads the current value of every counter and bucket.
3. Every 30 s Prometheus evaluates the rules in `alerts.yml`. A condition that
   holds becomes **pending**.
4. The rule's `for:` window (10 minutes for `NexoraSlowP95`) must pass with the
   condition still true. Then the alert becomes **firing**.
5. Prometheus pushes firing alerts to Alertmanager at `alertmanager:9093`.
6. Alertmanager groups alerts by `alertname`, `environment` and `severity`, and
   waits `group_wait: 30s` to see whether more alerts join the group.
7. A `POST` goes to the Slack incoming webhook. The message appears in
   `#nexora-alerts`.
8. When the condition clears, Prometheus sends a resolved alert. Because
   `send_resolved: true`, Slack receives a green `RESOLVED` message on the next
   `group_interval` (up to 5 minutes later).

A p95 breach therefore takes at least the rule's `for` window — ten minutes — to
reach Slack, plus up to one scrape interval, one evaluation tick and one
`group_wait`. That delay is intentional: it avoids paging on a single slow
minute.

---

## 4. Prometheus

### 4.1 What it is

Prometheus is a single binary that does four things: it **pulls** metrics from
HTTP endpoints on a schedule, stores them in a local time-series database,
allows queries through **PromQL**, and evaluates **alerting rules**. It is not a
log store, not a dashboard, and not a notification system.

It is built around a pull model. A target must be reachable from wherever
Prometheus runs. Render hosts only the API, so the Prometheus container cannot
live there; it runs on a laptop, a small VPS, or is replaced by Grafana Cloud.
A free Render instance that sleeps is a target that temporarily cannot be
scraped — that is what the `up` metric records.

### 4.2 The data model

Everything Prometheus stores is a **sample**: a float value at a millisecond
timestamp, identified by a **series**. A series is a metric name plus a set of
labels:

```text
nexora_http_requests_total{
  method="GET",
  route="/api/v1/me",
  status="200",
  service="nexora-api",
  environment="local",
  instance="host.docker.internal:4100",
  job="nexora-api-local"
} 42  1699372800000
```

- `method`, `route`, `status` come from the application.
- `service` and `environment` are attached by the scrape configuration, so the
  same build works locally and on Render.
- `instance` and `job` are added by Prometheus automatically.

The label set is the identity of the series. Two samples with the same metric
name but different labels are different series. Every distinct combination is
stored separately, which is why unbounded labels (`product_id`, `user_id`, raw
URL paths) are forbidden here — see §4.7.

### 4.3 Metric types and what this API publishes

| Type          | Use                                              | Series in this repo                                                  |
| ------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| **Counter**   | Monotonically increasing total                   | `nexora_http_requests_total` (`method`, `route`, `status`)           |
| **Histogram** | Distribution of observations, exposed as buckets | `nexora_http_request_duration_seconds` (`method`, `route`, `status`) |
| **Gauge**     | A value that goes up and down                    | `nexora_http_requests_in_flight` (`method`), `nexora_build_info`     |
| **Summary**   | Client-side quantiles; not used here             | —                                                                    |

The histogram buckets are `0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
10` seconds. They define the resolution of every percentile: `histogram_quantile`
interpolates inside a bucket, so p95 is approximate. Buckets around the
thresholds that matter (2 s here) give the useful answer.

`collectDefaultMetrics` from `prom-client` adds the process families under the
same prefix: `nexora_process_cpu_user_seconds_total`,
`nexora_process_resident_memory_bytes`, `nexora_nodejs_heap_size_used_bytes`,
`nexora_nodejs_eventloop_lag_p99_seconds`, `nexora_nodejs_gc_duration_seconds`
and others. They are collected every 10 seconds in-process.

The HTTP middleware deserves one note: it records on the response's `finish` (or
`close` for aborted calls), because that is the only point where the final
status code is known. Nest sets `201` for a successful POST after the handler
returns, so an interceptor would have recorded `200`. The route label is Express's
route pattern (`/api/v1/catalog/items/:id`); a wildcard match is charted as
`unmatched` so that unknown paths do not each become a series.

### 4.4 Scrape configuration

[`prometheus.yml`](../infra/observability/prometheus/prometheus.yml) sets the
defaults and three jobs:

| Job                 | Target                                    | Interval | Timeout | Auth              | Labels added                                   |
| ------------------- | ----------------------------------------- | -------- | ------- | ----------------- | ---------------------------------------------- |
| `prometheus`        | `localhost:9090`                          | 30 s     | 10 s    | none              | —                                              |
| `nexora-api-local`  | `host.docker.internal:4100`               | 30 s     | 10 s    | none              | `service=nexora-api`, `environment=local`      |
| `nexora-api-render` | `nexora-web-service.onrender.com` (HTTPS) | 60 s     | 45 s    | Bearer token file | `service=nexora-api`, `environment=production` |

Globals: `scrape_interval: 30s`, `scrape_timeout: 10s`,
`evaluation_interval: 30s`, `external_labels.monitor: nexora-observability`.
`rule_files` loads `alerts.yml`; `alerting` points at `alertmanager:9093`.

The Render job is deliberately more patient than the local one: a sleeping free
instance can take 30–50 s to wake, so a 10 s timeout would record a failure that
is really just a cold start. `scrape_timeout` must stay below
`scrape_interval`.

Authentication uses `authorization.credentials_file`, not an inline token, so the
secret is a file that can be mounted read-only and never enters git:

```yaml
authorization:
  type: Bearer
  credentials_file: /etc/prometheus-secrets/metrics_token
```

The token itself is the same `METRICS_TOKEN` the API validates. Without it in
production the API answers `404`, which is a deliberate fail-closed choice; a
`404` on the target therefore means "wrong token, missing token, or an old
deploy", not "route not found".

`extra_hosts: host.docker.internal:host-gateway` is what lets the container reach
an API running on the Docker host. On Docker Desktop it works out of the box; on
Linux the mapping is required.

### 4.5 PromQL: the operations this stack uses

PromQL is a functional query language over series. Every dashboard panel and
alert in this repository is built from a small set of operations:

| Query (simplified)                                                     | What it means                                       | Trap                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| `rate(nexora_http_requests_total[5m])`                                 | Per-second increase, corrected for counter resets   | Needs at least two samples in the window; a deploy restart resets |
| `sum by (route) (rate(...[$__rate_interval]))`                         | Aggregate across instances, keep route              | Omitting `by` collapses everything into one line                  |
| `sum(rate(...{status=~"5.."}[...])) / clamp_min(sum(rate(...)), 1e-9)` | Error ratio                                         | Division by zero produces `NaN`; `clamp_min` prevents it          |
| `histogram_quantile(0.95, sum by (le) (rate(..._bucket[...])))`        | p95 from histogram buckets                          | `le` must survive aggregation; dropping it makes the result wrong |
| `topk(8, histogram_quantile(0.95, sum by (le, route) (...)))`          | Worst routes                                        | `topk` on raw series shows per-instance noise                     |
| `increase(nexora_http_requests_total[24h])`                            | Extrapolated increase over a day                    | A partially covered window is extrapolated, not exact             |
| `sum(nexora_http_requests_in_flight)`                                  | Concurrency now                                     | It is a gauge; never wrap it in `rate()`                          |
| `time() - max(nexora_process_start_time_seconds)`                      | Process uptime                                      | Uses wall clock; clock skew shows up here                         |
| `sum(up{job=~"nexora-api-.*"})`                                        | How many API targets are being scraped successfully | `up` exists only after the first scrape attempt                   |

`$__rate_interval` is a Grafana variable, not PromQL. Grafana expands it to a
window that is at least four scrape intervals long, so `rate()` always sees
enough samples. In Alertmanager rules, where Grafana is not involved, the windows
are literal (`[5m]`).

`rate()` requires a range vector (`[5m]`); `sum()` and `topk()` operate on
instant vectors. Mixing the two is the most common PromQL error. A rule that says
`rate(metric)` without a window will not parse.

### 4.6 Alerting rules

Rules are plain YAML. The shape used here:

```yaml
- alert: NexoraSlowP95
  expr: |
    histogram_quantile(0.95, sum by (le, environment) (rate(nexora_http_request_duration_seconds_bucket[5m]))) > 2
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: 'p95 latency above 2 s on {{ $labels.environment }}'
    description: 'The p95 has stayed above 2 s for 10 minutes. Check database latency and the Render instance size.'
```

- **`expr`** is evaluated on the `evaluation_interval` (30 s).
- **`for`** is how long it must stay true before firing. Without it, a single
  blip notifies someone.
- **`labels`** are attached to the alert and drive Alertmanager routing
  (`severity` here). `environment` comes from the scraped series and is preserved
  automatically.
- **`annotations`** are human text, not routing input. `{{ $labels.x }}` reads a
  label from the alert; `{{ $value }}` would read the sample value.

The five rules in [`alerts.yml`](../infra/observability/prometheus/alerts.yml):

| Alert                  | Condition                       | `for` | Severity |
| ---------------------- | ------------------------------- | ----- | -------- |
| `NexoraApiDown`        | `up{job=~"nexora-api-.*"} == 0` | 5 m   | critical |
| `NexoraHighErrorRate`  | 5xx / all requests > 5%         | 10 m  | critical |
| `NexoraSlowP95`        | p95 latency > 2 s               | 10 m  | warning  |
| `NexoraMemoryPressure` | RSS > 450 MB                    | 15 m  | warning  |
| `NexoraEventLoopLag`   | p99 event-loop lag > 500 ms     | 10 m  | warning  |

`NexoraApiDown` is the only rule based on Prometheus's own `up` metric, so it
also covers a sleeping free Render instance. That is why the annotation says so
rather than telling you the API crashed.

Recording rules (precomputing an expensive query into a new series) are not used
here; the dashboard queries are cheap at this cardinality. The same file format
would support them under `record:` instead of `alert:`.

### 4.7 Storage and cardinality

Prometheus stores samples in a local TSDB under `/prometheus` (the
`prometheus-data` volume). Retention is `PROMETHEUS_RETENTION`, default `15d`.
At this series count that is a few hundred megabytes.

Two behaviours worth knowing:

- **Counter resets.** A redeploy starts counters at zero. `rate()` and
  `increase()` treat a decrease as a reset and compensate, so graphs stay
  meaningful. Raw counter panels would show a cliff.
- **Cardinality.** Memory and disk grow with the number of distinct label
  combinations, not the number of requests. `route` is bounded by the number of
  Express route patterns; `status` by the number of status codes; `environment`
  by the number of scrape jobs. Adding `product_id` or a raw URL would create a
  new series per product/URL and is not acceptable.

There is no remote write, no long-term storage and no HA pair. If history beyond
15 days is required, add remote write to Grafana Cloud/Mimir or use a larger
retention with disk headroom; do not silently raise retention on a small disk.

### 4.8 Operating Prometheus

| What                        | Where                                   |
| --------------------------- | --------------------------------------- |
| Targets and scrape health   | http://localhost:9090/targets           |
| Rule state (pending/firing) | http://localhost:9090/alerts            |
| Ad-hoc queries              | http://localhost:9090/graph             |
| Configuration               | http://localhost:9090/config            |
| Service discovery           | http://localhost:9090/service-discovery |

Useful API endpoints (all under `/api/v1`): `query`, `query_range`, `series`,
`labels`, `label/<name>/values`, `targets`, `rules`, `alerts`, `metadata`,
`status/buildinfo`, `status/runtimeinfo`, `status/tsdb`.

Reload rules or config without restarting:

```bash
curl -X POST http://localhost:9090/-/reload
```

That endpoint exists because Compose passes `--web.enable-lifecycle`. It is not
enabled by default in a stock Prometheus, and it is safe here because the port is
loopback-only.

Validate before reloading:

```bash
cd infra/observability
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose exec prometheus promtool check rules /etc/prometheus/alerts.yml
```

`promtool` is the same binary's offline checker. It parses the file, resolves the
rule files and reports syntax or semantic errors without touching the running
server. It is the fastest way to catch a bad query in a rule.

### 4.9 Failure modes

| Symptom                          | Likely cause                                                   | Fix                                                              |
| -------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Target `down`, error `404`       | token missing/wrong on Render, or a stale deploy               | set the variable, redeploy, compare with `secrets/metrics_token` |
| Target `down`, error `timeout`   | free Render instance asleep, or the local API is not running   | retry after the instance wakes; start the API locally            |
| Target `up` but panels empty     | variable filter excludes the series, or too short a window     | set Environment/Route to All; widen the time range               |
| Rule stays `pending` forever     | condition not continuously true, or `for` longer than expected | inspect the expression in Graph; shorten `for` only if justified |
| Graph drops to zero after deploy | counters restarted; not a bug                                  | use `rate()`/`increase()` panels; uptime panel shows the restart |
| Prometheus memory grows          | unbounded label values                                         | remove the label; query Postgres for per-entity detail           |
| `/-/reload` answers `404`        | lifecycle API not enabled                                      | add `--web.enable-lifecycle`, recreate the container             |

---

## 5. Alertmanager

### 5.1 Why it is a separate service

Prometheus knows when a condition is true. Alertmanager knows **who should hear
about it, how often, and whether anyone already acknowledged it**. Separating
them means rules can be edited without touching delivery, and delivery can be
tested without waiting for a real incident. Alertmanager also deduplicates:
Prometheus re-sends a firing alert on every evaluation; Alertmanager turns that
stream into one notification per group.

### 5.2 Alert lifecycle and timings

```text
condition true ──► pending ──(for: 10m)──► firing ──► notification
                                                        │
condition false ◄───────────────────────────────────────┘
      └──► resolved ──(send_resolved: true, next group_interval)──► green message
```

| Setting           | Value here | Effect                                                              |
| ----------------- | ---------- | ------------------------------------------------------------------- |
| rule `for`        | 5–15 m     | must stay true before firing; set per rule in Prometheus            |
| `group_wait`      | 30 s       | wait after the first alert in a group before notifying              |
| `group_interval`  | 5 m        | minimum time between updates to the same group (including resolved) |
| `repeat_interval` | 4 h        | re-send while the group is still firing                             |

A group is identified by the `group_by` labels. While it is firing, a new alert
that matches the same group is appended to the next notification rather than
starting its own.

### 5.3 Routing

The configuration is a routing tree. This repository has one route and one
receiver:

```yaml
route:
  receiver: slack
  group_by: ['alertname', 'environment', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

receivers:
  - name: slack
    slack_configs:
      - api_url_file: /etc/alertmanager-secrets/slack_webhook
        send_resolved: true
```

Routing decisions are made on **labels on the alert**. Here every alert goes to
`slack`. To send critical alerts somewhere else, add a child route with a
matcher; the first matching child wins:

```yaml
route:
  receiver: slack
  routes:
    - matchers: ['severity="critical"']
      receiver: pager
```

`severity` exists because each rule sets it. `environment` exists because the
scrape job adds it. An alert that lacks a label used by `group_by` gets an empty
value for it, which is legal but makes grouping less precise.

Check a routing decision without waiting for a real alert:

```bash
docker compose exec alertmanager amtool config routes test \
  --config.file=/etc/alertmanager/alertmanager.yml \
  --verify.receivers=slack \
  alertname=NexoraSlowP95 environment=production severity=warning
```

`--config.file` takes precedence over `--alertmanager.url`, so this works even
if Alertmanager is not running.

### 5.4 Receivers and the Slack configuration

A **receiver** is a named set of integrations. The fields used here:

| Field           | Meaning                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `api_url_file`  | Path to a file containing the incoming-webhook URL. Preferred over `api_url`, which would put the secret in git. |
| `send_resolved` | Send a follow-up when the alert clears. Off by default.                                                          |
| `title`         | One-line heading; here it renders `FIRING: NexoraSlowP95 (production)`.                                          |
| `text`          | Message body; here it ranges over `.Alerts` and prints severity, summary and description.                        |

The template sees two kinds of labels: `.CommonLabels` (present on every alert in
the group — `alertname`, `environment`, `severity`) and `.Labels` (per alert,
inside the `range`). `.Status` is `firing` or `resolved`. The full template
reference is in the Alertmanager documentation. Keep the inline template small:
`check-config` catches syntax, not every evaluation error, so a mistake here
shows up as a failed notification in the log.

Alertmanager refuses to start if `api_url_file` points at a missing file. That is
a useful failure: a half-configured notifier never runs silently.

### 5.5 Grouping behaviour you will observe

- One message per `alertname` + `environment` + `severity` — one group, not one
  message per scrape target or per series.
- Alerts that start while a group is firing are appended to that group's next
  notification, not sent separately.
- A still-firing alert is re-sent every 4 hours. That is the heartbeat that
  proves delivery still works, not a new incident.
- A resolved alert produces one green message, after at most one
  `group_interval`. If the alert never fired (it resolved during `pending`), no
  message is sent.

### 5.6 Silences and inhibition

A **silence** suppresses notifications for alerts matching a set of matchers
for a fixed duration. Alerts still exist and are visible as suppressed in the
UI; nothing is lost. Typical use: a known maintenance window, or a shop that
closes at night and should not page for an expected 5xx.

```bash
docker compose exec alertmanager amtool silence add \
  alertname=NexoraApiDown environment=production \
  --comment='Render maintenance window' \
  --duration=2h \
  --alertmanager.url=http://localhost:9093

docker compose exec alertmanager amtool silence query \
  --alertmanager.url=http://localhost:9093

docker compose exec alertmanager amtool silence expire <silence-id> \
  --alertmanager.url=http://localhost:9093
```

**Inhibition** is different: it suppresses alerts _because another alert is
firing_, with `equal` labels deciding the relationship (for example, mute every
warning in an environment while `NexoraApiDown` fires there). This repository
has `0 inhibit rules`; silences cover the current need. If inhibition is added,
validate it with `amtool check-config` and test a real pair of alerts before
trusting it.

### 5.7 Operating Alertmanager

| What              | Where                                              |
| ----------------- | -------------------------------------------------- |
| Alerts and groups | http://localhost:9093                              |
| Silences          | http://localhost:9093/#/silences                   |
| Status and config | http://localhost:9093/#/status                     |
| Notification log  | `alertmanager-data` volume; used for deduplication |

`amtool` is the CLI shipped in the same image. The subcommands available in this
stack include `alert query`, `alert add`,
`silence add|expire|import|query|update`, `check-config`, `cluster show`,
`config show`, `config routes show|test` and `template render`.

```bash
# Validate the file (does not contact the server)
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# What Alertmanager is currently holding
docker compose exec alertmanager amtool alert query \
  --alertmanager.url=http://localhost:9093

# Inject a test alert
docker compose exec alertmanager amtool alert add NexoraTestSend \
  severity=warning environment=local \
  --annotation=summary='Test alert from Alertmanager' \
  --alertmanager.url=http://localhost:9093
```

`amtool template render` only accepts template **files** (`--template.glob`);
this configuration uses inline `title`/`text` templates, so `check-config` is the
offline check and a template error appears in the Alertmanager log at send time.

On Git Bash for Windows, prefix commands with `MSYS_NO_PATHCONV=1` when a
container path is passed as an argument; otherwise `/etc/alertmanager/...` is
rewritten to a Windows path before Docker sees it.

HTTP API (v2): `GET/POST /api/v2/alerts`, `GET/POST /api/v2/silences`,
`DELETE /api/v2/silence/{id}`, `GET /api/v2/status`, `GET /api/v2/receivers`,
`GET /api/v2/alerts/groups`.

Alertmanager reloads its configuration on restart. This repository uses
`docker compose restart alertmanager` after editing `alertmanager.yml`; a
message sent before the restart uses the old configuration.

### 5.8 Failure modes

| Symptom                               | Likely cause                                              | Fix                                                              |
| ------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Container exits on start              | `secrets/slack_webhook` missing or unreadable             | create the file (§7.5), then `docker compose up -d alertmanager` |
| Alert fires; no Slack message         | webhook file contains a newline, quotes, or the wrong URL | `wc -c` the file; rewrite with `printf '%s'`; check logs         |
| `Notify attempt failed: invalid_auth` | webhook revoked or app uninstalled                        | create a new webhook in Slack and replace the file               |
| Messages delayed several minutes      | normal `group_wait`/`group_interval` behaviour            | lower the waits only if the noise trade-off is acceptable        |
| Duplicate notifications after restart | pending group re-sent; dedupe state lives in the volume   | expected once; do not `down -v` casually                         |
| "View in Alertmanager" link is dead   | `--web.external-url` still the container hostname         | set `ALERTMANAGER_EXTERNAL_URL`, recreate the container          |
| Silence does not suppress anything    | matcher spelling differs from the alert's labels          | copy labels from the Alertmanager UI; `amtool silence query`     |

---

## 6. Grafana

### 6.1 What it is here

Grafana is the query client and the picture. It stores no metrics; it sends
PromQL to Prometheus through a **server-side proxy datasource** and renders the
result. The browser talks to Grafana only, which is why Prometheus can stay on
loopback and why the datasource URL is the Compose hostname
`http://prometheus:9090`, not `localhost`.

Grafana does store its own state: users, the admin password hash, annotations
posted through its API, and dashboard metadata. That is the `grafana-data`
volume. The dashboard definition itself is a file in git.

### 6.2 Provisioning: files are the source of truth

Provisioning happens at startup from read-only mounts:

| File                                                                  | Purpose                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `infra/observability/grafana/provisioning/datasources/prometheus.yml` | Declares the Prometheus datasource, uid `nexora-prometheus`   |
| `infra/observability/grafana/provisioning/dashboards/nexora.yml`      | Dashboard provider: folder `Nexora`, scans the mounted folder |
| `infra/observability/grafana/dashboards/nexora-api.json`              | The dashboard itself, uid `nexora-api`                        |

The provider is configured with `allowUiUpdates: false` and
`disableDeletion: true`: a provisioned dashboard cannot be saved from the UI or
deleted there. The workflow is: edit the JSON, run Prettier, commit, then
`docker compose restart grafana` (or wait for `updateIntervalSeconds: 30`).
Treating the JSON as source means a dashboard change is reviewable and
recoverable, like any other code.

### 6.3 The datasource

```yaml
datasources:
  - name: Prometheus
    uid: nexora-prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      httpMethod: POST
      timeInterval: 30s
```

- **`access: proxy`** — Grafana's server queries Prometheus; the browser never
  needs network access to 9090.
- **`httpMethod: POST`** — long PromQL expressions exceed comfortable URL
  lengths; POST is the safer transport.
- **`timeInterval: 30s`** — tells Grafana the scrape cadence, which is what
  `$__rate_interval` uses to choose a sensible window.
- **`editable: false`** — the UI cannot silently drift from the file.

### 6.4 The dashboard model

The dashboard (`Nexora API`, uid `nexora-api`) opens on the last 6 hours and
refreshes every 30 seconds. It has two **variables**, both query variables
backed by the datasource:

| Variable      | Query                                                   | Values                                   |
| ------------- | ------------------------------------------------------- | ---------------------------------------- |
| `environment` | `label_values(nexora_http_requests_total, environment)` | `local`, `production`                    |
| `route`       | `label_values(nexora_http_requests_total, route)`       | Express route patterns, plus `unmatched` |

Variables make one dashboard serve both environments without duplicating panels.
Selecting All includes every value; selecting a single route narrows every panel
that filters on `$route`.

Panel types used:

- **Stat** — one current number and, by default, a sparkline. Used for request
  rate, error ratio, p95, in-flight requests, uptime, target count and 24-hour
  volume. Units matter: `reqps`, `percentunit`, `s`, `bytes`, `short`,
  `dtdurations`.
- **Time series** — a line per label combination. Used for rate by route,
  latency percentiles (p50/p95/p99), responses by status, slowest routes, memory
  and event-loop lag.

The full panel-by-panel table is in
[`observability.md` §5](observability.md#5-the-dashboard). The one query worth
reading twice is the error ratio: it divides 5xx rate by total rate, clamps the
denominator to `1e-9` to avoid `NaN`, and appends `or vector(0)` so an empty
series renders as `0%` instead of "No data".

### 6.5 Annotations

Annotations are vertical markers on time-series panels. Grafana has two sources
here:

1. **Built-in annotations** (`-- Grafana --` datasource): anything posted to
   `/api/annotations`, and dashboard alerts.
2. **Tag queries**: two annotation queries on the dashboard — `API test runs`
   (tag `api-tests`, purple) and `E2E test runs` (tag `e2e-tests`, orange) —
   each limited to 100 markers.

Any process that can reach Grafana can add a marker:

```bash
curl -u admin:"$GRAFANA_ADMIN_PASSWORD" \
  -H 'content-type: application/json' \
  -X POST http://localhost:3001/api/annotations \
  -d '{"text":"api tests: 352 passed, 0 failed","tags":["api-tests","passed"],"time":1699372800000}'
```

Two scripts wrap this:

| Script                                                | Who runs it     | What it posts                                           |
| ----------------------------------------------------- | --------------- | ------------------------------------------------------- |
| `infra/observability/scripts/record-test-run.sh`      | a person or CI  | one annotation: suite, pass/fail counts, duration, tags |
| `infra/observability/scripts/sync-ci-annotations.mjs` | the host (Node) | one annotation per finished main-branch CI suite step   |

The poller exists because a hosted GitHub runner cannot reach a dashboard bound
to loopback. It reads the public Actions API for finished runs, maps each job to
its suite step, posts the step's span, and records run ids in
`.state/ci-annotations.json` (gitignored) so polling never draws the same marker
twice. It authenticates with a Grafana service-account token when
`GRAFANA_TOKEN` is set, or with the admin password from the environment or
`infra/observability/.env`.

Annotations are metadata, not metrics: they do not affect retention, alerts or
queries except to explain a change in the graph ("the p95 moved here, right after
this test run").

### 6.6 Security and persistence

| Control                        | Value / behaviour                                   |
| ------------------------------ | --------------------------------------------------- |
| Port                           | `127.0.0.1:3001` → container 3000, loopback only    |
| Sign-up                        | `GF_USERS_ALLOW_SIGN_UP=false`                      |
| Anonymous access               | `GF_AUTH_ANONYMOUS_ENABLED=false`                   |
| Analytics / update checks      | disabled                                            |
| Admin password                 | `GRAFANA_ADMIN_PASSWORD`, required by Compose       |
| Root URL                       | `GRAFANA_ROOT_URL`, default `http://localhost:3001` |
| Datasource and dashboard edits | file-based, UI edits not persisted                  |

The admin password is applied when Grafana first creates the admin user. Changing
`.env` later does not reset an existing password; the value in the database
wins. To change it, use the UI (or reset the admin password through the CLI), and
keep `.env` in sync so the scripts can authenticate.

Back up the `grafana-data` volume for users, annotations and settings. The
dashboard JSON is already in git and needs no backup.

### 6.7 Operating Grafana

| What                       | Where                                                       |
| -------------------------- | ----------------------------------------------------------- |
| Dashboard                  | http://localhost:3001/d/nexora-api                          |
| Explore (ad-hoc)           | http://localhost:3001/explore                               |
| Datasources                | http://localhost:3001/connections/datasources               |
| Annotations                | dashboard settings → Annotations                            |
| Users and service accounts | http://localhost:3001/admin/users, `/admin/serviceaccounts` |

API endpoints used by this repository and for diagnosis: `GET /api/health`,
`GET /api/datasources`, `GET /api/dashboards/uid/nexora-api`,
`POST /api/annotations`, `GET /api/annotations?tags=api-tests`,
`POST /api/ds/query` (used by Explore).

Grafana logs to the container's stdout: `docker compose logs -f grafana`.
Provisioning errors (a bad datasource YAML, a malformed dashboard JSON) appear
there at startup and prevent the object from appearing, rather than failing the
container.

### 6.8 Failure modes

| Symptom                               | Likely cause                                             | Fix                                                                    |
| ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Login fails after editing `.env`      | password only applies at first boot                      | use the existing password, or reset it; then update `.env`             |
| Dashboard missing after edit          | malformed JSON, or provider path wrong                   | `docker compose logs grafana`; validate JSON; restart                  |
| Panel says "No data"                  | variable selects an empty combination, or no scrapes yet | set variables to All; wait one scrape; widen the range                 |
| "Datasource error"                    | Prometheus container down or datasource URL wrong        | `docker compose ps`; check `http://prometheus:9090` from the network   |
| UI save is disabled for the dashboard | `allowUiUpdates: false` — expected                       | edit `nexora-api.json` instead                                         |
| Annotation markers absent             | tag mismatch or time outside the range                   | query `GET /api/annotations?tags=api-tests`; check the script's `time` |
| Grafana container restarts on boot    | `GRAFANA_ADMIN_PASSWORD` unset                           | set it in `infra/observability/.env`                                   |

---

## 7. Slack

### 7.1 Role and boundaries

Slack is the last mile: the place where a human sees `FIRING: NexoraSlowP95
(production)`. It is not an alert store. Alertmanager keeps the state, the
notification log and the silences; Slack keeps the conversation. Anything that
needs to be acknowledged, escalated or audited should live in Alertmanager or a
paging tool, not in a channel scrollback.

The integration is an **app + incoming webhook**, not a bot token and not the
Slack Web API. A webhook is a single URL that accepts a JSON POST; it is the
smallest possible credential and needs no scopes beyond the install.

### 7.2 Creating the webhook

1. Open `https://api.slack.com/apps` and create an app (here: `Nexora Alerts`).
2. **Incoming Webhooks** → enable → **Add New Webhook to Workspace**.
3. Choose the destination channel. Here it is the private channel
   `#nexora-alerts`. The Slack consent screen must be approved by a workspace
   member; the app is then installed with only the `incoming-webhook` scope.
4. Copy the URL (`https://hooks.slack.com/services/...`) and write it to
   `infra/observability/secrets/slack_webhook` — see §7.5.

Two limits are set by Slack, not by Alertmanager:

- The webhook always posts to the channel chosen at install time. You cannot
  override the channel, username or icon per message with an app webhook. Use a
  separate webhook/receiver per destination channel.
- Posting faster than about one message per second per channel is throttled.
  Alertmanager's grouping is what keeps the stack under that limit.

For a private channel, the app must be installed with access to it; if messages
stop after moving a channel, reinstall or create a new webhook.

### 7.3 Message anatomy

The receiver renders a title and a text from the alert group:

```yaml
title: '{{ .Status | toUpper }}: {{ .CommonLabels.alertname }} ({{ .CommonLabels.environment }})'
text: |-
  {{ range .Alerts -}}
  *{{ .Labels.alertname }}* — {{ .Labels.severity }}
  {{ .Annotations.summary }}
  {{ if .Annotations.description }}{{ .Annotations.description }}{{ end }}
  {{ end }}
```

| Template fragment                 | Renders                                         |
| --------------------------------- | ----------------------------------------------- |
| `{{ .Status \| toUpper }}`        | `FIRING` or `RESOLVED`                          |
| `{{ .CommonLabels.alertname }}`   | label shared by the group, e.g. `NexoraSlowP95` |
| `{{ .CommonLabels.environment }}` | `local` or `production`                         |
| `{{ range .Alerts }}`             | repeats the block for every alert in the group  |
| `{{ .Annotations.summary }}`      | the rule's one-line summary                     |
| `{{ .Annotations.description }}`  | optional longer explanation                     |

Observed in `#nexora-alerts` during verification:

```text
FIRING: NexoraTestSend (local)
NexoraTestSend — warning
Test alert from Alertmanager

FIRING: NexoraSlowP95 (production)
NexoraSlowP95 — warning
p95 latency above 2 s on production
...

RESOLVED: NexoraTestLink (local)
NexoraTestLink — info
LinkCheck
```

Each message carries a "View in Alertmanager" link built from
`--web.external-url`. With `ALERTMANAGER_EXTERNAL_URL=http://localhost:9093` the
link opens on the machine running the stack; on a VPS set it to the tunnel or
public address, otherwise the link points at a container hostname that resolves
nowhere outside Docker.

### 7.4 Delivery semantics

- **Grouping first.** `group_by: [alertname, environment, severity]` means one
  message per logical incident, not one per scrape target.
- **Retries.** If the webhook call fails (network, `invalid_auth`, rate limit),
  Alertmanager logs `Notify attempt failed` and retries; the alert stays firing
  in its UI. Repeated failures in `docker compose logs alertmanager` are the
  first thing to check when Slack is quiet.
- **Resolved messages.** Only sent when `send_resolved: true` and the alert
  actually fired. They arrive on the next `group_interval`, so up to five
  minutes after the condition clears.
- **History.** Slack is the display; Alertmanager's UI and notification log are
  the record. A message deleted in Slack is not re-sent until
  `repeat_interval` (4 h) while the alert still fires.

### 7.5 Storing and rotating the credential

The URL is a secret: anyone holding it can post to the channel. It is never
committed, never pasted into chat, and never put in `alertmanager.yml`.

```bash
cd infra/observability
printf '%s' 'https://hooks.slack.com/services/...' > secrets/slack_webhook
chmod 600 secrets/slack_webhook
docker compose up -d alertmanager
```

The file must contain **only** the URL: no trailing newline, no quotes, no shell
prompt. `printf '%s'` (not `echo`) guarantees that. A newline produces
`net/url: invalid control character in URL` in the logs and no message.

The whole `secrets/` directory is mounted read-only at
`/etc/alertmanager-secrets`; `api_url_file` reads from there. Git ignores
everything in that directory except the `*.example` placeholders.

To rotate: in Slack, remove the old webhook (or uninstall/reinstall the app),
create a new one for the same channel, overwrite the file, restart Alertmanager.
The old URL stops working immediately, so do both steps in one sitting.

### 7.6 Alternatives

The same receiver list supports other integrations without changing Prometheus
rules: `email_configs` (SMTP), `pagerduty_configs`, `opsgenie_configs`,
`webhook_configs` (a JSON payload to any endpoint), `victorops_configs` and
others. A common split is Slack for warnings and a pager for `severity=critical`
via a child route (§5.3). Keep the webhook-URL pattern for anything with a
credential: `*_file` or an environment-injected value, never a literal in git.

### 7.7 Failure modes

| Symptom                              | Likely cause                                                 | Fix                                                               |
| ------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| No message at all                    | file missing, Alertmanager not restarted, or wrong channel   | check container status and `docker compose logs alertmanager`     |
| `invalid_auth` / `channel_not_found` | webhook revoked, app uninstalled, or channel access lost     | create a new webhook for the channel, replace the file, restart   |
| Message text is garbled              | template error or a newline in the URL                       | check `docker compose logs alertmanager`; `wc -c` the secret file |
| Link points to `http://<hash>:9093`  | `--web.external-url` not applied                             | set `ALERTMANAGER_EXTERNAL_URL`, recreate the container           |
| Duplicate messages                   | alert re-fired after resolving, or `repeat_interval` elapsed | expected; adjust `repeat_interval` only after checking the alert  |
| Messages throttled                   | more than ~1 message/second to the channel                   | group more aggressively; do not add per-alert routes without need |

---

## 8. Supporting tools

| Tool               | Role in this stack                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker Compose** | Runs the three containers, pins image versions, creates the shared network, named volumes and read-only mounts, interpolates `.env`. Loopback port bindings keep the UIs private. |
| **`prom-client`**  | The Node library inside the API. Holds the registry, defines counters/histograms/gauges, adds process metrics, and exposes the text format Prometheus parses.                     |
| **`promtool`**     | Offline validation of `prometheus.yml` and rule files, shipped in the Prometheus image. Run before reloading.                                                                     |
| **`amtool`**       | Alertmanager's CLI, shipped in its image: validate config, test routes, render template files, inject alerts, manage silences.                                                    |
| **`curl`**         | Probes `/metrics`, calls the Prometheus and Grafana APIs, triggers `/-/reload`.                                                                                                   |
| **Node.js**        | Runs `sync-ci-annotations.mjs` (fetch GitHub, post Grafana annotations) and the scripts' JSON handling.                                                                           |
| **Bash**           | Runs `record-test-run.sh` and the validation/reload commands in this document.                                                                                                    |
| **GitHub Actions** | Produces the test-run signal that becomes a dashboard annotation. It never talks to the loopback dashboard directly.                                                              |
| **Render**         | Hosts the API and the `METRICS_TOKEN` environment variable; its free-tier sleep behaviour shapes the scrape job.                                                                  |
| **OpenSSL**        | Generates `METRICS_TOKEN` (`openssl rand -hex 32`).                                                                                                                               |
| **Prettier**       | Keeps the YAML, JSON and Markdown in this tree consistently formatted; not part of the runtime.                                                                                   |

Two of these deserve a note:

**Docker Compose** is not an orchestrator. `depends_on` only controls start
order; none of these services has a healthcheck. Grafana can come up before
Prometheus is ready and show a datasource error until the first successful
query, which is acceptable for a single-host stack. `restart: unless-stopped`
keeps the containers running across reboots of the Docker daemon, but not if you
`docker compose stop` them.

**`prom-client`** runs inside the API process, so its numbers disappear when the
process restarts. That is why every dashboard panel is built on rates and
increases rather than raw totals, and why the uptime panel exists. The library
also imposes no tenancy: labels are chosen by this code, and the chosen labels
(`method`, `route`, `status`) are deliberately bounded. A future metric must keep
that property.

---

## 9. Integration points

| From             | To           | Endpoint / mechanism                        | Auth                         | Format                     |
| ---------------- | ------------ | ------------------------------------------- | ---------------------------- | -------------------------- |
| Prometheus       | Nexora API   | `GET /metrics` (local 4100 / Render HTTPS)  | `Authorization: Bearer` file | Prometheus text exposition |
| Prometheus       | itself       | `GET /metrics` on `localhost:9090`          | none                         | text                       |
| Prometheus       | Alertmanager | `POST /api/v2/alerts`                       | none (internal network)      | JSON                       |
| Alertmanager     | Slack        | `POST https://hooks.slack.com/services/...` | URL is the credential        | JSON                       |
| Grafana          | Prometheus   | `POST /api/v1/query`, `/query_range`        | none (internal network)      | JSON                       |
| Scripts / poller | Grafana      | `POST /api/annotations`                     | Basic auth or service token  | JSON                       |
| Poller           | GitHub       | `GET api.github.com/repos/.../actions/runs` | optional `GITHUB_TOKEN`      | JSON                       |
| Operator         | all three    | loopback UIs and CLIs                       | local access only            | HTML / CLI                 |

All internal calls use the Compose network by service name (`prometheus`,
`alertmanager`). The loopback mappings are the only exposed ports; the only
outbound calls are Prometheus → Render, Alertmanager → Slack, and the poller →
GitHub.

---

## 10. Configuration reference

### 10.1 Files

| Path                                                                  | Read by        | Purpose                                             |
| --------------------------------------------------------------------- | -------------- | --------------------------------------------------- |
| `infra/observability/docker-compose.yml`                              | Docker Compose | Services, ports, volumes, environment, versions     |
| `infra/observability/.env`                                            | Docker Compose | Local values; gitignored                            |
| `infra/observability/.env.example`                                    | humans         | Template for `.env`                                 |
| `infra/observability/prometheus/prometheus.yml`                       | Prometheus     | Global settings, scrape jobs, rule and alert wiring |
| `infra/observability/prometheus/alerts.yml`                           | Prometheus     | The five alert rules                                |
| `infra/observability/alertmanager/alertmanager.yml`                   | Alertmanager   | Route, receiver, Slack templates                    |
| `infra/observability/grafana/provisioning/datasources/prometheus.yml` | Grafana        | Datasource declaration                              |
| `infra/observability/grafana/provisioning/dashboards/nexora.yml`      | Grafana        | Dashboard provider                                  |
| `infra/observability/grafana/dashboards/nexora-api.json`              | Grafana        | The Nexora API dashboard                            |
| `infra/observability/secrets/metrics_token`                           | Prometheus     | Scrape token; `0600`, gitignored                    |
| `infra/observability/secrets/slack_webhook`                           | Alertmanager   | Incoming-webhook URL; `0600`, gitignored            |
| `infra/observability/.state/ci-annotations.json`                      | poller         | Run ids already annotated; gitignored               |

### 10.2 Environment variables

| Variable                            | Consumed by            | Default                      | Notes                                        |
| ----------------------------------- | ---------------------- | ---------------------------- | -------------------------------------------- |
| `GRAFANA_ADMIN_USER`                | Compose → Grafana      | `admin`                      |                                              |
| `GRAFANA_ADMIN_PASSWORD`            | Compose → Grafana      | required (Compose fails)     | Applied at first boot only                   |
| `GRAFANA_ROOT_URL`                  | Compose → Grafana      | `http://localhost:3001`      | Public URL behind a proxy                    |
| `PROMETHEUS_RETENTION`              | Compose → Prometheus   | `15d`                        | Disk-bound; raise with headroom only         |
| `ALERTMANAGER_EXTERNAL_URL`         | Compose → Alertmanager | `http://localhost:9093`      | Builds the link in Slack messages            |
| `METRICS_TOKEN`                     | API (Render and local) | empty                        | Empty means open in dev, `404` in production |
| `GRAFANA_URL`                       | scripts                | `http://localhost:3001`      |                                              |
| `GRAFANA_TOKEN`                     | scripts                | empty                        | Service-account token; preferred in CI       |
| `GRAFANA_USER` / `GRAFANA_PASSWORD` | scripts                | `admin` / from `.env`        | Basic-auth fallback                          |
| `GITHUB_REPOSITORY`                 | poller                 | `ou2sema/Nexora`             |                                              |
| `CI_BRANCH`                         | poller                 | `main`                       |                                              |
| `CI_RUN_LIMIT`                      | poller                 | `10`                         | Runs inspected per poll                      |
| `CI_MAX_AGE_HOURS`                  | poller                 | `72`                         | Older runs are ignored                       |
| `CI_SYNC_STATE`                     | poller                 | `.state/ci-annotations.json` |                                              |
| `GITHUB_TOKEN` / `GH_TOKEN`         | poller                 | empty                        | Raises the anonymous API rate limit          |

Secrets are files, not variables, wherever a file mount is possible. Environment
variables leak into `docker inspect`, process listings and crash dumps; a
read-only mounted file does not.

---

## 11. Day-2 operations

```bash
cd infra/observability

# Lifecycle
docker compose up -d
docker compose ps
docker compose logs -f prometheus
docker compose restart alertmanager
docker compose down          # keeps the three named volumes

# Configuration and rules
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose exec prometheus promtool check rules /etc/prometheus/alerts.yml
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
docker compose exec alertmanager amtool config routes test \
  --config.file=/etc/alertmanager/alertmanager.yml --verify.receivers=slack \
  alertname=NexoraSlowP95 environment=production severity=warning
docker compose config      # resolves .env and prints the effective file

# Apply
curl -X POST http://localhost:9090/-/reload          # rules and scrape config
docker compose restart alertmanager                   # alertmanager.yml
docker compose restart grafana                        # provisioning (or wait 30 s)
```

**Upgrading.** Change one image tag at a time, read the release notes for
breaking configuration changes, run the validators above, then recreate the
container. Prometheus major versions can change flag or storage behaviour;
Alertmanager occasionally deprecates receiver fields. Never use `latest` on this
stack: an unattended `docker compose pull` should not be able to break delivery.

**Backups.** `prometheus-data` holds the TSDB (metrics history, expendable),
`alertmanager-data` holds the notification log (dedupe state, mildly important),
`grafana-data` holds users, annotations and settings (the only one that is hard
to reconstruct). Dashboards, rules and configuration are already in git. Back up
by stopping the stack and archiving the volumes, or by using volume snapshots on
the host. Restoring a `grafana-data` volume from before a password change also
restores the old password.

**Moving to a server.** Keep the ports on loopback, set
`ALERTMANAGER_EXTERNAL_URL` and `GRAFANA_ROOT_URL` to the tunnel or public
addresses, put TLS in front of Grafana, and recreate the stack. The scrape target
for the local job may disappear; the Render job is unaffected. Prometheus must
run wherever it can reach both targets — it cannot run inside Render.

---

## 12. Glossary

| Term                 | Meaning                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Sample**           | One value at one timestamp.                                                        |
| **Series**           | A metric name plus a unique label set; what the TSDB stores over time.             |
| **Label**            | A key/value dimension on a metric or alert (`environment`, `severity`).            |
| **Cardinality**      | The number of distinct series; the main cost driver in Prometheus.                 |
| **Scrape**           | One HTTP fetch of a target's `/metrics`.                                           |
| **Target / job**     | A URL to scrape / a named group of targets with shared configuration.              |
| **Exporter**         | Anything that exposes metrics in Prometheus format; here, the API itself.          |
| **PromQL**           | Prometheus's query language for selecting and aggregating series.                  |
| **Recording rule**   | A rule that precomputes a query into a new series. Not used here.                  |
| **Alert rule**       | A PromQL condition plus `for`, labels and annotations.                             |
| **Pending / firing** | Condition true but still inside `for` / condition true for the whole `for` window. |
| **Receiver**         | A named set of notification integrations in Alertmanager.                          |
| **Route**            | A node in the Alertmanager routing tree; matches labels, selects a receiver.       |
| **Grouping**         | Combining related alerts into one notification.                                    |
| **Silence**          | A time-boxed, label-matched suppression of notifications.                          |
| **Inhibition**       | Suppression of one alert because another is firing.                                |
| **Notification log** | Alertmanager's record of what was sent, used for deduplication.                    |
| **Datasource**       | Grafana's connection to a query backend (Prometheus here).                         |
| **Panel**            | One visualization on a dashboard.                                                  |
| **Variable**         | A dashboard-level filter interpolated into queries (`$environment`).               |
| **Annotation**       | A timestamped marker on a graph, used here for test runs.                          |
| **Webhook**          | A URL that accepts an HTTP POST; the Slack credential and transport.               |

---

## 13. Further reading

| Topic                            | Link                                                                       |
| -------------------------------- | -------------------------------------------------------------------------- |
| Prometheus overview and concepts | https://prometheus.io/docs/introduction/overview/                          |
| Data model                       | https://prometheus.io/docs/concepts/data_model/                            |
| PromQL basics                    | https://prometheus.io/docs/prometheus/latest/querying/basics/              |
| Alerting rules                   | https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/ |
| Alertmanager configuration       | https://prometheus.io/docs/alerting/latest/configuration/                  |
| Alertmanager concepts            | https://prometheus.io/docs/alerting/latest/alertmanager/                   |
| `prom-client`                    | https://github.com/siimon/prom-client                                      |
| Grafana provisioning             | https://grafana.com/docs/grafana/latest/administration/provisioning/       |
| Grafana variables                | https://grafana.com/docs/grafana/latest/dashboards/variables/              |
| Grafana annotations              | https://grafana.com/docs/grafana/latest/dashboards/annotations/            |
| Slack incoming webhooks          | https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks  |
| Docker Compose                   | https://docs.docker.com/compose/                                           |
