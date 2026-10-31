# ADR-0014 — Interface localization (English, French, Arabic)

- **Status:** accepted
- **Date:** 2026-10-31
- **Deciders:** product owner, engineering
- **Supersedes:** ADR-0002 decision 4 (the interface is single-language)

## Context

ADR-0002 dropped the Phase 0 FR/EN toggle to keep the early phases small, and recorded
that adding French later would mean moving strings into catalogs without a data-model
change. The product owner now needs French and Arabic for the people who run the shop in
Tunisia. The requirement is interface copy only:

- every screen, navigation item, dialog, empty state, and validation message
- API and Supabase authentication errors shown in the UI
- no schema change, no organization-level setting, and no hosted migration

PDFs, CSV exports, labels, and invitation emails are produced by the server and stay
English for now; translating them would require passing a locale through the API and
would touch stored documents.

## Decisions

### 1. Locale is a device preference

Supported locales are `en`, `fr`, and `ar` (Tunisian). The choice is stored in
`localStorage` under `mystock.locale` and chosen on first visit from the browser's
language list, falling back to English. A switcher in the top bar and on the sign-in
screen changes it immediately. There is no URL locale segment and no per-user setting:
the same account can use French on a phone and English on a desktop, and nothing about
the tenant data changes.

This keeps routing, links shared between users, and RLS untouched. Moving the locale into
the URL later is additive.

### 2. Catalogs are flat, namespaced, and compile-time complete

`apps/web/src/i18n/messages` holds one file per namespace (`common`, `nav`, `layout`,
`auth`, `errors`, `organizations`, `dashboard`, `catalog`, `stock`, `devices`, `scanning`,
`suppliers`, `purchasing`, `sales`, `returns`, `team`, `admin`, `warehouses`) for each
locale. Keys are flat dotted strings (`stock.movements.title`), which keeps greps and
duplicate detection trivial.

The English catalog is canonical: `en/index.ts` exports `MessageKey` as the union of its
keys, and the French and Arabic catalogs are typed as `Record<MessageKey, string>`. A
missing translation, a typo in a key, or an extra key fails `tsc`, so a namespace cannot
ship half-translated. At runtime a missing entry falls back to English, then to the key
itself, so a copy omission degrades rather than blanking the page.

Components call `t(key)` through `useI18n()`. No component holds display copy; the only
literals left in JSX are brand names and example values such as a sample serial number.

### 3. Plurals cover all six CLDR categories

Noun phrases are stored as groups (`common.noun.products.zero`, `.one`, `.two`, `.few`,
`.many`, `.other`) in every locale, and `plural(base, count)` selects the category with
`Intl.PluralRules` for the active locale. English and French use a subset, but storing all
six keeps the catalogs interchangeable and makes Arabic correct: Arabic distinguishes
zero, one, two, few (3–10), many (11–99), and other.

Counts are formatted with `Intl.NumberFormat` before interpolation, so `{count}` reads
naturally in each language.

### 4. Formatting uses locale tags with Latin digits

Locale tags are `en-TN`, `fr-TN`, and `ar-TN-u-nu-latn`. The `-u-nu-latn` extension keeps
Arabic numerals in Latin digits, matching the owner's choice and prices printed on local
receipts: `1.234,568 د.ت.` rather than `١٬٢٣٤٫٥٦٨ د.ت.`. Money still goes through
`formatTnd` from `packages/domain`, so TND stays three decimals everywhere and
`Intl.NumberFormat` resolves the currency label (`TND` in English, `DT` in French,
`د.ت.` in Arabic).

Dates, date-times, and quantities are formatted inside the i18n provider. Quantities use
at most four decimals; no page calls `toLocaleString`, `toFixed`, or `Intl` directly.

### 5. RTL uses logical properties and direction-aware layout

Switching to Arabic sets `document.documentElement.lang` and `.dir`, and the shell uses
Tailwind logical utilities (`start-0`, `ps-64`, `end-4`, `ms-*`, `pe-*`) so the sidebar,
drawer, dialogs, and pagination mirror without a second layout. Icons that imply direction
(the sign-out arrow) flip with `rtl:-scale-x-100`. Identifiers, emails, serial numbers, and
barcodes get `dir="ltr"` so they stay readable inside RTL text. Arabic gets a Naskh-capable
font stack and normal letter spacing.

### 6. Server errors are localized by code and by stable message

The API's error envelope carries a stable `code`; the UI maps known codes to
`errors.code.*` keys. Some failures (database constraints, validation raised inside
Postgres) only carry an English message, so `apps/web/src/i18n/errors.ts` also maps every
stable server message — the `AppError` messages, database descriptors, not-found and
validation messages, and Supabase authentication messages — to catalog keys. Anything
unrecognized is shown verbatim, as before. `export_too_large` interpolates its row limit.

This keeps the API English-only and free of locale negotiation while giving users
translated feedback for every error the system actually produces.

### 7. English copy is a test contract

The Playwright suites assert English copy byte-for-byte. The Phase 12 conversion kept
English strings identical, including punctuation and capitalization, so those tests remain
the regression check for the migration. A new `e2e-local/i18n.spec.ts` adds French and
Arabic passes: pre-auth copy, sign-in, money and date formatting, RTL layout, Latin digits,
live switching, persistence across reloads, and a localized authentication error.

## Consequences

- No migration, no contract change, and no new hosted configuration are required.
- A locale is a device preference, not an account setting; users must choose it on each
  device once.
- Adding a fourth language is a catalog plus a type error list, not a refactor. Removing a
  key from English breaks French and Arabic at compile time until they follow.
- React Hook Form captures its Zod resolver at mount, so validation messages inside a
  dialog that is already open keep the language they were opened in; the next open uses
  the current locale.
- Server-rendered artifacts (PDFs, CSV, labels, invitation emails) stay English and are
  out of scope.
- `formatTnd`'s default locale remains `fr-TN` for non-UI callers; the UI always passes the
  active tag.
