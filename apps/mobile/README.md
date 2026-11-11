# Nexora mobile client

Android-first Flutter client for the Nexora API. Every business read and write
goes through the NestJS API (`/api/v1`); the app never talks to PostgREST and
never re-implements tenant, role, stock, total, payment or device rules. The API
and database stay authoritative, and stock writes are never queued offline.

## Prerequisites

- Flutter 3.47.x / Dart 3.13.x (tested with Flutter 3.47.5).
- JDK 17 and Android SDK Platform 36 (build-tools + platform-tools).
- A reachable Nexora API and a Supabase project that issues the Auth session.
- `flutter doctor --android-licenses` accepted once.

The APK embeds only the Supabase **publishable (anon)** key. The service-role
key, the database password and the JWT secret are never passed to the app and
never exist in Dart assets.

## Flavors

| Flavor  | Application id            | App name       | Default API URL |
| ------- | ------------------------- | -------------- | --------------- |
| dev     | `tn.nexora.app.dev`       | Nexora Dev     | `http://10.0.2.2:4100/api/v1` |
| staging | `tn.nexora.app.staging`   | Nexora Staging | none, must be set |
| prod    | `tn.nexora.app`           | Nexora         | `https://nexora-web-service.onrender.com/api/v1` |

`AppFlavor` is read from the `APP_FLAVOR` dart-define, so pass it together with
`--flavor`. A build without the Supabase settings opens a screen that names
what is missing instead of pointing at the wrong backend. The API address can
be changed on the device afterwards (see below), so only Supabase fixes the
build.

Cleartext HTTP is allowed only by the debug manifest (`android/app/src/debug`).
Release builds keep the Android default and only talk HTTPS.

## Configuration

All values are compile-time `--dart-define`s (defaults in
`lib/core/config/app_config.dart`):

| Define             | Meaning |
| ------------------ | ------- |
| `APP_FLAVOR`       | `dev`, `staging` or `prod` |
| `API_BASE_URL`     | API origin **including** `/api/v1`, no trailing slash |
| `SUPABASE_URL`     | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY`| Publishable/anon key only |

Example (dev, against the local API from an emulator):

```sh
flutter run --flavor dev \
  --dart-define=APP_FLAVOR=dev \
  --dart-define=SUPABASE_URL=https://<project-ref>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<publishable-anon-key> \
  --dart-define=API_BASE_URL=http://10.0.2.2:4100/api/v1
```

On a physical phone replace `10.0.2.2` with the LAN address of the API and
append `:4100/api/v1`.

### API address on the device

The address is not frozen at build time. **More → API connection** (owners,
admins and platform admins) or the **API connection** link on the sign-in
screen opens a screen where the address can be typed, tested and saved:

- The saved address lives in `SharedPreferences` under
  `nexora.v1.connection.api_base_url` and wins over the built-in one. It is
  stored on that device only; it is not a secret and it changes neither the
  account nor the data.
- `Test` calls `<origin>/health` with a 60 s limit, which also reports how long
  a sleeping Render instance took to wake. `Save` applies immediately: the API
  client is rebuilt, every screen refetches, and the session re-reads `/me`. No
  restart is needed.
- The built-in address is restored with **Use the built-in address**.
- Supabase remains build-time configuration, because the auth client is
  initialised before the first frame; changing project requires a rebuild.
- Release builds only speak HTTPS (Android default). A `http://` LAN address
  works on emulators and on devices running Android 8 or older; use `https://`
  on modern phones.

The production API is `https://nexora-web-service.onrender.com/api/v1` and is
the default for the `prod` flavor. A free Render instance spins down when idle
and wakes in about 30–50 s, so `ApiClient` allows 75 s for the response and the
first screen of the day may wait that long once.

## Networking and state

- `lib/core/api/api_client.dart` is the single HTTP entry point. It attaches the
  Supabase bearer token, an `x-request-id` correlation id, bounded connect/send/
  receive timeouts and optional cancel tokens. Every failure becomes a typed
  `ApiException` carrying the server code, status and request id.
- Writes carry an idempotency key. `IdempotencyGuard` keeps the same key across
  timeouts, cancellations, dropped connections and 5xx answers (the outcome is
  unknown), and rotates it only after a definitive answer. Retrying an uncertain
  write never creates a duplicate receipt or invoice.
- Downloads (PDFs, CSVs, label sheets) stream through the same client; the server
  chooses the filename from `Content-Disposition`.
- Riverpod providers in `lib/data/providers.dart` are keyed by the active
  organization. The session controller reloads and re-scopes them when the
  account or organization changes.
- Drafts and the cashier basket live in `ScopedStore`, namespaced by user id and
  organization id, and are cleared on sign-out. The Supabase session is stored
  through `SecureSessionStorage` (Android Keystore-backed) instead of plain
  preferences.

## Screens

Bottom navigation: **Home**, **Inventory**, **Scan**, **Sell**, **More**. The
More tab is searchable and reaches every secondary area.

- Auth: sign-in/sign-up, organization chooser, invitations, organization
  creation, platform admin.
- Home dashboard: stock summary, low stock, recent movements, quick actions.
- Catalog: product list with search/status filters, product detail, editor
  (barcode, category, brand, tax, reorder level, serialized flag).
- Stock: levels, movements ledger, manual movement, transfer, reservations,
  reconciliation, cycle counts.
- Scan: camera, typed code, or keyboard-wedge scanner (the text field submits on
  Enter). Every code is resolved by the server's scan endpoint, so product
  barcode, device serial and IMEI follow the server rules.
- Counter sale: basket, customer, payments, invoice creation; the basket is
  persisted per user and organization.
- Devices: serialized unit list, registration, movement and status changes.
- Purchasing: purchase orders, receiving (bulk and serialized), purchase
  returns.
- Sales: sales orders, fulfilment, sales returns (goods and money).
- Invoices: list, detail, PDF; suppliers and customers with activation.
- Reports: overview, low stock, supplier performance, CSV exports.
- Team and invitations, branding (logo), warehouses/locations, catalog
  settings, platform administration (organizations, audit log).

## Localization and money

English, French and Arabic are bundled with full RTL support. Money is an
integer number of TND millimes and always renders three decimals
(`1,234.567 TND`). Money and quantities keep Latin digits in Arabic. The
language can be pinned in More, or left on the system locale.

## Tests

```sh
cd apps/mobile
flutter pub get
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
```

`flutter test` covers money formatting/parsing, the API error envelope and
status mapping, idempotency-key reuse across uncertain failures, the
unconfigured-build screen, and Arabic RTL with Latin money digits.

There is no `integration_test` suite yet: it needs a device plus a live API and
Supabase project.

## Building

Debug APK (dev flavor):

```sh
flutter build apk --debug --flavor dev \
  --dart-define=APP_FLAVOR=dev \
  --dart-define=SUPABASE_URL=... \
  --dart-define=SUPABASE_ANON_KEY=...
```

Output: `build/app/outputs/flutter-apk/app-dev-debug.apk`. With flavors defined,
`--flavor` is required: a bare `flutter build apk --debug` still makes Gradle
build `app-dev-debug.apk`, `app-staging-debug.apk` and `app-prod-debug.apk`, but
the Flutter tool cannot pick one and reports that it found no APK.

Release signing is intentionally incomplete. The Gradle file reads
`android/key.properties` **if it exists** and otherwise leaves the release
unsigned; no keystore is created or committed. Build an AAB only after real
release signing is configured:

```sh
flutter build appbundle --release --flavor prod \
  --dart-define=APP_FLAVOR=prod ...
```

## Layout

```
lib/
  core/api/        Dio client, idempotency guard
  core/auth/       role permissions
  core/config/     flavors and dart-define configuration
  core/errors/     typed ApiException
  core/money/      TND millimes and quantity parsing/formatting
  core/session/    session controller (Supabase auth, memberships)
  core/storage/    secure session storage, user+org scoped drafts
  core/theme/      Material 3 Nexora theme and typography
  core/ui/         shared widgets, pickers, labels, documents, failure text
  data/models/     typed JSON models
  data/            NexoraApi (endpoints) and Riverpod providers
  features/        one folder per area (auth, home, inventory, sale, scan, ...)
  l10n/            ARB files and generated localizations
  router/          go_router configuration and guards
```

## Verification results

Run on 2026-11-06:

- `flutter pub get` — resolved.
- `dart format --set-exit-if-changed lib test` — 0 changed.
- `flutter analyze` — no issues.
- `flutter test` — 30 tests passing.
- `flutter build apk --debug --flavor dev` — `app-dev-debug.apk` (about 224 MB
  debug), installed and launched on a Nox emulator (Android 7.1.2) against the
  local API. Nox cannot reach `10.0.2.2`, so the build was pointed at the host's
  LAN address (`http://<host-lan-ip>:4100/api/v1`).
- `flutter build apk --profile --flavor dev --dart-define=PERF_LOG=true` —
  installed and measured on Nox; numbers and method in Performance above.
- Runtime checks on Nox: sign-in screen in French, language picker
  (System default/English/Français/العربية), Arabic RTL with Latin e-mail, money
  and time, English UI, Home dashboard with live data (organization, role, API
  online, stock totals), More hub with search and sections, and a typed scan
  that resolves through the API and shows the not-found state.
- Runtime API address, on the same Nox build: **More → API connection** opened
  with the built-in LAN address, the field was replaced with
  `https://nexora-web-service.onrender.com/api/v1`, **Test** answered
  `Reachable, answered in 1381 ms.` and **Save** applied without a restart.
  Logcat then showed `GET nexora-web-service.onrender.com/api/v1/me ok 2729ms`,
  reports overview 1691 ms, low stock 1883 ms and stock movements 2068 ms, and
  Home rendered live Render data with `API online`.
- Recovery path, same build: a saved `http://127.0.0.1:9/api/v1` was rejected by
  **Test** with `Connection refused`; after **Save** the app fell back to the
  boot failure screen (`The API could not be reached.`) with **Try again**,
  **API connection** and **Sign out**. Re-entering the Render address from that
  screen restored Home with live data (`Reachable, answered in 363 ms.`).
- Repository gates: `npm run lint`, `npm run typecheck`, `npm test` — pass.

## Performance

The client is measured with a profiling (AOT) build that carries two build-time
switches. Both are compiled out of a normal build:

```sh
flutter build apk --profile --flavor dev \
  --dart-define=PERF_LOG=true \
  --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
```

- `PERF_LOG` installs `FrameMonitor` (`lib/core/perf/frame_monitor.dart`): it
  prints `[perf] first-frame Nms` and, every three seconds, one window with
  frame count, average build and raster time, the worst frame and the share of
  frames over 16.67 ms.
- `PERF_LOG` also adds a timing interceptor to `ApiClient`, which prints
  `[perf] GET <path> ok Nms` per call. Request start times are visible from the
  logcat timestamps, which shows whether calls run in parallel.

`tool/perf_stress.sh` drives read-only load: 15 tab switches, inventory flings,
counter scroll, six pull-to-refreshes and eight typed codes that the server
answers with 404. Nothing is written and no credentials are used. Coordinates
target the 1600x900 Nox screen and are overridable through environment
variables.

### Measurements

Nox emulator (Android 7.1.2, OpenGL ES 3.0, 1600x900), profile build, local API
and hosted Supabase, 2026-11-06. Three rounds of the same protocol; medians.

| What | Result |
| --- | --- |
| Cold start, first frame | 816–912 ms |
| Cold start to dashboard data | about 4.4 s: `/me` 1.43 s, then overview, low-stock and movements in parallel at 1.23–1.43 s |
| Warm tab switch | build 2.0–5.4 ms, raster 9–14 ms, worst frame 19–69 ms |
| Inventory scroll, 24 flings | 21% of frames over 16.67 ms, raster about 10.5 ms, worst frame 20–65 ms |
| Inventory first load | categories 621 ms and products 778 ms, in parallel |
| Scan lookup (invalid code) | 725 ms, then the not-found state |
| Pull-to-refresh | three reads in parallel, 650–1190 ms |
| Twelve back-to-back refreshes (36 reads in about 20 s) | all 200, no 429; overview 1.13–1.25 s, low-stock 0.57–0.67 s, movements 0.72–0.81 s |
| Memory after 30 tab switches and 9 flings | 96.5 MB → 102.2 MB |
| Memory after scan burst, then 45 s idle | 106.0 MB → 105.5 MB |
| Second identical stress cycle | 105.5 MB → 101.8 MB, so the retained few MB are caches, not a growing leak |

### Findings

- Request behaviour is already the ideal shape: dashboard and inventory reads
  are issued together, and returning to an already-built tab does not refetch.
  Screen latency is the API's read latency (0.6–1.4 s against the hosted
  Supabase pooler), not client work.
- Frame time is set by the emulator's raster path: build stays at 2–4 ms while
  raster is 9–11 ms on a plain scroll. A first navigation right after install
  shows single frames of 200–1000 ms (shader warm-up); the same navigation is
  20–70 ms warm.
- A `RepaintBoundary` experiment (per card and around the shell body and nav
  bar) measured no change on Nox once the shader cache was warm, so it was
  reverted rather than kept as unproven extra layers.
- `NexoraCard` lists now build lazily (`ListView.builder`), so a page only
  builds the rows on screen instead of all 25.

## Known limitations

- No physical Android device was available during the build; runtime behaviour
  was checked on a Nox emulator (Android 7.1.2) against the local API.
- Camera scanning needs a real camera; the Nox emulator has none, so only the
  typed/keyboard-wedge path can be exercised there.
- `API_BASE_URL` is joined verbatim by Dio, so the client normalizes a missing
  trailing slash itself; still pass the origin exactly as documented above.
- On short landscape windows (such as the 1600x900 Nox screen) the scan preview
  is capped and the manual code field sits just below it, so that field needs a
  small scroll. Portrait phones show the whole scan screen without scrolling.
- The app is a thin client by design: no offline stock queue, no client-side
  business rules, no local stock arithmetic.
