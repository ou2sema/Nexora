# ADR-0002 — Currency and interface language

- **Status:** accepted
- **Date:** 2026-10-29
- **Deciders:** product owner, engineering
- **Supersedes:** the Phase 0 defaults proposing FR/EN UI and per-organization EUR + MAD

## Context

Phase 0 proposed a bilingual FR/EN interface and an organization-level choice between
EUR and MAD. The product owner has since fixed the operating context: the business trades
in Tunisia and reports in Tunisian dinars. Carrying two currencies and a language toggle
would add configuration, formatting, and test surface without serving any real operation.

## Decisions

### 1. TND is the only currency

No `currency` column, no organization-level currency setting, no currency switcher, and no
exchange-rate handling anywhere. If multi-currency is ever needed it gets its own ADR,
because it changes how every amount is stored and summed.

### 2. Money is stored as integer millimes

TND has three decimal places (1 TND = 1000 millimes). Amounts are integers in the currency's
smallest unit: `bigint` in PostgreSQL, safe integers in TypeScript, and integer millimes on
the wire. Floating-point arithmetic is never used to add, subtract, or store money, and
`toFixed(2)` is never used to render it — two decimals is a EUR/USD habit that silently
corrupts TND totals.

### 3. Display goes through one formatter

`formatTnd` in `packages/domain` uses `Intl.NumberFormat` with the `fr-TN` locale by default:

| Locale  | `1234.567` TND renders as |
| ------- | ------------------------- |
| `fr-TN` | `1 234,567 DT`            |
| `en-TN` | `TND 1,234.567`           |

Reports, exports, and receipts use the same helper so a total rendered in two places can
never disagree.

### 4. The interface is single-language

The FR/EN toggle is dropped. UI copy is English and lives in components; no i18n framework,
message catalogs, or locale negotiation is introduced for Phase 1–7. This is a reversible
decision: if French becomes required, strings move into a catalog and the routing gains a
locale segment — no data-model change.

## Consequences

- Totals are additive and exact: integer millimes cannot drift the way floats do.
- Every price input and display must accept exactly three decimals; validation rejects
  finer precision instead of rounding it away (`toMinorUnits` throws).
- CSV and label exports must preserve three decimals.
- Turkish, Arabic, or French UI would require a separate decision; currency does not.
