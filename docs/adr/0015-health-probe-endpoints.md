# ADR-0015 — Liveness and readiness probes

- **Status:** accepted
- **Date:** 2026-11-01
- **Deciders:** product owner, engineering

## Context

The repository-audit action plan asked for `/health/live` and `/health/ready` before the private
beta. Until then the API exposed a single `GET /health` that answered from the process alone, so it
kept returning `200` while the database pool was down, and every probe paid the same rate limiter as
a user request. The dashboard's status card was the only thing that noticed an outage, and only when
a signed-in operator happened to look at it.

Constraints that shaped the design:

- Deployment is one API process talking to a hosted Supabase project through a session pooler; there
  is no orchestrator yet, but the probes should be usable by Docker `HEALTHCHECK`, a load balancer,
  or a platform health check without rework.
- A probe must never leak connection details. The database URL contains a password.
- A readiness check must not be able to hang a monitor. The driver's own connect timeout is 15
  seconds, far longer than any probe interval.

## Decisions

### 1. Three routes, one envelope each

`GET /health` keeps its exact shape (the dashboard polls it every 30 seconds). `GET /health/live`
returns the same snapshot and touches nothing outside the process. `GET /health/ready` adds
`database: { status: 'up', latencyMs, timeoutMs }` and answers `503` when the pool cannot run
`select 1`. All three stay outside the `api/v1` prefix.

### 2. The probe owns its deadline

`ReadinessService.checkDatabase()` races the query against a 2-second timer instead of inheriting the
driver timeout, and swallows the abandoned query's late rejection so a hung pool cannot surface as an
unhandled rejection. `checkDatabase(timeout)` takes the deadline as an argument, which keeps the
timeout path testable in 25 ms.

### 3. Failure classification without leakage

The service maps the failure to `unreachable`, `timeout`, or `error`, reusing the schema guard's
`isDatabaseUnreachable()` so both boot and probes classify the same way. The `503` goes through the
standard error envelope with code `service_unavailable`, and its details carry only the classification
— never the driver message, host, or port.

### 4. Probes are exempt from the throttle

`@SkipThrottle()` on the controller stops infrastructure polling from consuming the per-user budget
that protects the data endpoints. The routes return uptime and a boolean, so there is nothing to gain
from limiting them.

### 5. Readiness does not re-run the schema guard

A process that started already passed `assertSchemaCompatible()`. Probing migrations on every request
would add cost and a new failure mode without new signal, so readiness proves connectivity only and
the guard remains the migration authority.

### 6. The local E2E stack gates on readiness

`local-e2e-stack.mjs` and `playwright.local-stack.config.ts` now wait on `/health/ready`, so a suite
never begins against an API whose pool is not yet usable.

## Consequences

- Operators get an orthogonal answer for "the process is stuck" versus "the database is down", and a
  latency number they can chart without an APM.
- From this machine the hosted pool round trip measured ~0.7 s cold and warm, so the 2-second deadline
  is a network-distance decision, not a database-performance one; the measured headroom is documented
  in `docs/setup.md`.
- The deadline is a constant (`DATABASE_PROBE_TIMEOUT_MS`), not an environment variable. Promote it to
  configuration only when a deployment needs a different value.
- Nothing here implies multiple instances: replacing the in-memory throttle with distributed storage
  stays a separate decision that only matters once the API runs more than one replica.
