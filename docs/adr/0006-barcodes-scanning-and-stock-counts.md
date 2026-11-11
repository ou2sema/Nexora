# ADR-0006 — Barcodes, scanning, labels, and inventory counts

- **Status:** accepted
- **Date:** 2026-10-30
- **Deciders:** product owner, engineering

## Context

Phase 4 makes the catalog usable at the shelf. Operators need to identify an item from a
printed barcode or serial number, receive stock without retyping identifiers, print labels
for products that have no manufacturer barcode, and reconcile a physical location against
the ledger. The phase must satisfy:

- **Gate A — correct identification:** a scan resolves to exactly one product or device in
  the caller's organization, and a bad check digit cannot masquerade as a product.
- **Gate B — fallback behavior:** scanning works when the browser has no barcode API, when
  the camera is denied or absent, and when a label is damaged — manual entry and serial/SKU
  lookup always remain available.
- **Gate C — duplicate prevention:** a double scan, a double submit, or a retried posting
  cannot move stock twice.
- **Gate D — count integrity:** a count posts one adjustment per real variance, respects
  reservations, and cannot be posted twice or against a stale open session.

## Decisions

### 1. Generated barcodes live in the GS1 `2` prefix and are minted in the database

`app.internal_barcode_seq` supplies a sequence; `app.assign_product_barcode` locks the
product row, returns an existing barcode unchanged, and otherwise builds an EAN-13 whose
payload starts with `2` — the GS1 range reserved for in-store numbering — plus a computed
check digit. Barcodes generated here therefore cannot collide with a manufacturer's printed
code, and a retry returns the same value instead of minting a second one.

The API never generates a barcode in application code: two concurrent "assign" clicks would
otherwise race for the same number. The database function is `security definer`, requires
owner/admin/manager, and is tenant-scoped by `organization_id`.

### 2. GTIN validity is enforced twice

`packages/domain/src/barcode/gs1.ts` computes and validates the GS1 check digit for lengths
8, 12, 13, and 14, and is unit-tested. The migration mirrors the algorithm in
`app.gtin_check_digit` / `app.is_valid_gtin` and adds
`products_barcode_gtin_check`, so an invalid barcode cannot be stored even if a future
client bypasses the API. Manufacturer barcodes may be entered as-is; a value that fails the
check digit is rejected rather than silently repaired.

### 3. One scan pipeline with a fixed resolution order

`GET /organizations/:id/scan?code=` resolves in this order:

1. individually tracked unit code (case-insensitive) — ADR-0020,
2. device serial number (case-insensitive) or IMEI,
3. product barcode (exact),
4. SKU (case-insensitive),
5. internal code (case-insensitive).

Unit and device identities win over products because each names a single physical object,
while a product code is a quantity. Everything is scoped by `organization_id`; a code that
exists only in another tenant returns `404 scan_not_found`. The response is a discriminated
union: a tracked-item result carries the unit, its product and its event history; a device
result carries the device row; a product result carries the product, its per-location stock
lines, and totals. All members, including viewers, may scan; only mutations are role-gated.

### 4. Labels are rendered by the server as a print-ready PDF

`POST /organizations/:id/labels` accepts 1–50 product/device targets with 1–20 copies each
and returns an A4 PDF (3 columns × 8 rows) built with `pdf-lib`. Each barcode is rendered
with `bwip-js`: EAN-8, UPC-A, EAN-13, or ITF-14 when the code is a valid GTIN of that
length, otherwise Code 128. Rendering server-side keeps the symbology rules in one place and
avoids shipping a barcode library to every browser. Labels use the product barcode when one
exists, then the internal code, then the SKU; device labels print the serial as the code.

The PDF is fetched with the session bearer token and saved as a blob. A plain `<a href>` is
not used because the access token must not travel in a URL.

### 5. Camera scanning is progressive enhancement, never the only path

`camera-scanner.tsx` prefers the native `BarcodeDetector`, and lazily imports
`@zxing/browser` when the API is missing. Both paths feed the same scan handler and surface
the active engine so an operator can see which decoder is running. The component releases
the media stream, animation frame, and ZXing controls on unmount and when the camera is
toggled off. If permission is denied, no camera exists, or decode fails, the manual entry
field and the serial/SKU lookup remain fully usable. Frames never leave the device; there is
no server-side image decoding in this phase.

### 6. Duplicate prevention is layered

- **UI:** the scanning console ignores an identical code repeated within 1.5 s of the
  previous scan and tells the operator it did so.
- **Database:** a partial unique index allows only one `open` count per
  `(organization, warehouse, location)`, so a second counter cannot work from a stale
  session.
- **Posting:** `app.post_stock_count` claims an `Idempotency-Key` through
  `app.claim_stock_operation` (`operation = 'stock_count'`) and stores the response. A replay
  returns the original result with `duplicate: true`; a second key against an already-posted
  count returns `stock_count_not_open`.
- **Receiving:** reuse of the Phase 3 `POST /stock-movements` path means every receipt is
  already idempotent per key.

### 7. A stock count is a persisted session, not a form submission

`stock_counts` records the location, status (`open → posted | cancelled`), author, and
posting metadata. `stock_count_lines` holds one counted quantity per product;
`app.record_stock_count` supports `increment` (scan one more unit) and `set` (correct the
line). Serialized products are rejected with `product_not_countable` because their quantity
is owned by `devices`, not by a count. Recording is possible only while the count is open.

Posting locks every affected balance, subtracts active reservations, and compares the count
to the current `on_hand` at that moment. It writes one `adjustment` movement per non-zero
variance with `reference_type = 'inventory_count'` and `reference_id = countId`, then
updates the projection. A count that would drop below a reservation fails with
`stock_count_below_reserved`; an empty count fails with `stock_count_empty`. Lines are
processed in product order so two posts on the same location queue rather than deadlock.

The count does not snapshot expected quantities. Variance is computed live in the count
detail view; a scan-assisted count therefore reflects stock that arrived or left during the
session, and posting deliberately reconciles to the physical count rather than to an old
snapshot.

### 8. Count tables are read-only to application roles

`stock_counts` and `stock_count_lines` have RLS select policies for members and grants only
for `SELECT`. Every write goes through a `security definer` function with a role check, the
same pattern as the ledger. This keeps the audit trail consistent and prevents a direct
insert from skipping the one-open-count rule.

## Consequences

- The API and UI depend on `supabase/migrations/20261030100000_barcode_workflows.sql`.
  It is verified locally (PGlite and API suites) and must be pushed to the hosted project
  before the signed-in scanning console can run there.
- Receiving is one scan → one posting. Batch receiving ("scan twenty units, post once") is
  future work; operators can already reuse the quantity field and the idempotent endpoint.
- Label PDFs use the standard Helvetica/Courier fonts, which cover the English interface.
  Non-Latin product names need an embedded font in a later phase.
- The camera path depends on browser support: `BarcodeDetector` is available in Chromium
  and Edge, while Firefox and older Safari fall back to ZXing. A device with neither a
  working camera nor a decoder still has manual entry.
- Counting serialized stock remains a device-by-device activity; a count cannot adjust
  serialized quantity, by design.
- Generated barcodes are sequential per project. The sequence is not tenant-specific, but
  uniqueness is only checked within the organization, so a collision across tenants is
  harmless and the GS1 in-store prefix keeps them out of manufacturer space.
