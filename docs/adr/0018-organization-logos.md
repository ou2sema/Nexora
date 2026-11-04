# ADR-0018 — Organization logos on the dashboard and on every generated document

- **Status:** accepted
- **Date:** 2026-11-03
- **Deciders:** product owner, engineering
- **Amends:** ADR-0010 decision 2, ADR-0014 out-of-scope list
- **Related:** ADR-0003 (tenancy and RLS), ADR-0017 (counter sales)

## Context

Every document the depot hands over — the counter invoice, the goods issue note, the purchase
documents, the shelf labels — currently carries the organization's _name_ and nothing else. The owner
wants each organization to bring its own mark: a manager uploads one image, and that image appears on
the signed-in dashboard and in the header of every file the server generates.

Three existing constraints shape the answer. Tenant data lives in Postgres behind row security with
`SECURITY DEFINER` writers (ADR-0003, ADR-0004), so a new per-organization asset has to enter that
same pattern rather than beside it. Documents are rendered in-process by `pdf-lib` with the standard
fonts (ADR-0010), which can embed only the image formats its own decoders understand. And the whole
screen set is localized with an RTL shell (ADR-0014), so the mark has to sit in a layout that can be
mirrored and that also has to look right when the header is drawn by a renderer that knows nothing
about the language of the document.

## Decisions

### 1. The logo is a database asset, not a Supabase Storage object

`public.organization_logos` holds one row per organization: the mime type, the bytes, and who last
changed it. Storage would add a bucket, a second set of policies that must agree with the row
policies already written, a public or signed URL the browser has to construct, and a byte source the
API would have to fetch over HTTPS on every document render. The renderer needs the bytes in-process,
the tenant boundary needs to be the same boundary every other table uses, and one small image per
organization is well inside what a `bytea` column is for. The asset is therefore read with the same
`app.is_org_member(organization_id)` policy as `customers` and `sales_invoices`, and written only
through a definer function.

### 2. Manager-tier write, member-tier read, no new role

Uploading or removing a logo is a catalog-branding action, so it uses the role set the repository
already has for it — `owner`, `admin`, `manager` — inside `app.set_organization_logo` and
`app.clear_organization_logo`, both of which raise `forbidden` (`42501`) through
`app.has_org_role`. Every member, including `viewer`, may read it: a viewer who can open an invoice
must be able to see the mark printed on it. `TenantAccessService.runAsMember` keeps enforcing the
tenancy boundary at the HTTP layer exactly as it does elsewhere, so a request for another tenant's
logo is a `404`, not a `403`.

### 3. PNG or JPEG, at most 400 KB, sent as the raw request body

`pdf-lib` embeds PNG (through its own decoder, alpha preserved as a soft mask) and JPEG (stream
copied as `DCTDecode`, baseline and progressive both accepted). Nothing else it can be handed
renders, so `image/webp` and `image/gif` are refused rather than silently mangled. SVG is refused for
a different reason: it is markup, and an SVG served back into the app's own origin is an inline XSS
carrier — an image asset in this product is not allowed to be a document.
`image/png` and `image/jpeg` are the only accepted `Content-Type` values, and the cap is 400 KB,
counted while the stream is read, not trusted from `content-length`. A PNG logo is decoded to RGBA and
re-compressed into the PDF, so the cap also bounds the memory a single upload can cost. Multipart was
not used because `@types/multer` is not in the dependency tree; a raw `PUT` needs no new dependency,
needs no global body-parser limit (Nest's default JSON limit stays exactly where it is), and lets the
browser send the `File` object as the body without base64-inflating it by a third.

### 4. An upload is validated by being embedded

Bytes that pass the mime check but fail the decoder are the one failure mode that matters, because the
renderer would then throw while producing an invoice — a tenant that cannot print a sale because
somebody uploaded a file three weeks ago. So the write path sniffs the signature (the PNG eight-byte
header, `FF D8 FF` for JPEG) instead of believing the header, then actually embeds the image into a
throwaway `PDFDocument`. If that succeeds, the stored bytes are provably renderable by the code that
will read them; if it fails, the upload is a `400` and nothing is written. The read path can then stay
simple, and `bytes → PDF image` never needs a fallback.

### 5. The mark goes in the page-one header of every document family

`DocumentHeading` gains an optional logo. `drawDocumentHeader` embeds it into a cap box of 44 × 30 pt
at the left margin, aspect ratio preserved and centred inside that box, and starts the organization
name 12 pt to the right of the box (`LOGO_BOX_WIDTH + LOGO_TEXT_GAP`); the title and number block
stays right-aligned exactly where it is today. A document with no logo draws byte-for-byte the layout
that exists now, so nothing about the current rendering is a compromise. The continuation header on
later pages keeps text only — a split table needs to stay traceable, not branded.

Labels take the mark somewhere else, because a pre-cut sheet has no free paper: the 3 × 8 grid is
placed from fixed geometry, so moving the whole grid down to make room for a header band would put
the printed barcodes off the die-cut labels. The identity instead goes in the bottom margin — the logo
at most 14 × 10 pt followed by the organization name at 7 pt — and the sheet title becomes
`<organization> labels` instead of the hardcoded `MyStock labels` it shipped with. The grid is
untouched; the mark is the last thing drawn on the sheet.

The same branding has to survive into the file's metadata. `pdf-lib` rewrites `/Producer` with its own
signature on every `save()` (`updateInfoDict` in `PDFDocument.js`), so `setProducer('Nexora')` is
silently undone and no assertion may depend on it. `/Creator` and `/Title` do survive, so
`brandDocument()` in `documents/pdf-layout.ts` sets the title to the document's own name and number and
`/Creator` to `Nexora`, and the tests assert `getCreator()`.

### 6. The dashboard shows the current organization's mark; sign-in stays platform-branded

The tenant mark replaces the generic `Building2` glyph in the top bar's organization switcher, on every
authenticated screen: `/me` reports the summary (mime, byte length, timestamp) or `null`, the shell
fetches the bytes with its authorized request, hands the browser a blob URL, and revokes it on change.
It is decoration beside the tenant name, so it carries `alt=""`.

It deliberately does not replace the sidebar `BrandMark`. That mark is the product's identity, not the
tenant's, and it is the same element on the sign-in page — where there is no organization context to
resolve, and inventing a lookup from an email domain would leak which tenants exist. Branding is
therefore a property of the workspace shown beside the workspace name, not of the product chrome. The
localized shell tests assert the Nexora mark on sign-in and on the dashboard, which is the second
reason the sidebar keeps drawing it.

### 7. Replaced immediately, cached privately and immutably

`GET /organizations/:id/logo` answers with the bytes, the stored mime, and
`Cache-Control: private, max-age=86400, immutable`. Because the response is immutable, the version is
part of the URL: the interface requests `?version=<updatedAt>` using the timestamp `/me` already
reports, so a replaced mark is a different resource and a different client cache key, and the old bytes
simply stop being referenced. Uploading and removing invalidate that logo key and the `/me` query, so
the switcher, the branding card and the presence flag all move together. There is no `ETag` or
revalidation machinery, no CDN in front of this response, and no public URL, so nothing outside the
tenant can cache it.

## Consequences

- The migration `20261103120000_organization_logos.sql` was applied to the hosted project on
  2026-11-03; it is the fifteenth migration, and the boot schema guard now verifies 17 objects instead
  of 14 (the table and both functions) so API code that assumes the asset exists cannot start against
  an un-migrated database.
- Tenant bytes now leave the database through an HTTP route. The route is member-gated, returns no
  JSON, and the bytes never enter a log line or a `response` column; `check:integrity` and the
  reconciliation views are untouched because a logo is not a quantity.
- Logo bytes live inside every generated PDF, so a document's size grows by the embedded image once
  per document (not per page). A 400 KB PNG inflates to raw RGBA and re-compresses, which is the
  reason the guidance in the UI asks for a small mark; the cap is enforced at the write. Measured on
  hosted: an 870-byte transparent mark took a purchase order from 2,554 to 4,723 bytes, because the
  alpha channel travels as a second image object, while a 959-byte opaque mark rendered the same
  document at 3,857 bytes. All six hosted families now carry it — invoice, goods issue note, purchase
  order, purchase return, and the product and device label sheets, each with the mark placed at 30 × 30
  pt in the header or 10 × 10 pt in a label's free margin. The cap's real purpose showed up when the
  same `pdf-lib` embed path was run over a tenant's actual 399,980-byte mark: 956 bytes became 477,633,
  so a 400 KB source costs roughly 477 KB **per document**. That is a print-queue and download
  consideration, not a database one, and it is why the UI guidance asks for a small mark rather than
  only enforcing the ceiling.
- `app.document_kind`, numbering, ledger, and device flows do not change. A logo is presentation, so
  no idempotency key, no operation type, and no new enum value.
- The upload is one row per organization with no history: replacing a mark discards the old bytes, and
  an invoice printed before the change is a finished artifact that keeps the image it was drawn with.
  Versioning the asset was rejected as a second feature nobody asked for; only the read URL is
  versioned, and only with the `updated_at` the row already carries.
- ADR-0014 decision 4 ("artifacts stay English") is still in force and this phase does not touch it.
  When the HTML/CSS renderer lands for French and Arabic documents, it reads the same
  `organization_logos` row and inlines the same bytes as a `data:` URL, so the branding work here
  carries over to that renderer unchanged.
- Phase state: implemented, verified locally and landed on hosted on 2026-11-03 — 382 Vitest tests
  (314 API across 39 files), the headed local-stack suite 54/54, the virgin-database drill on 15
  migrations, and the branding spec byte-checking a real invoice with and without the mark. The hosted
  project carries the migration, the restarted API verified 17 objects and mapped the three routes, and
  the signed-in app uploaded, replaced and re-uploaded a mark in the "MyStock" tenant. On 2026-11-04 the
  remaining families were downloaded from hosted and checked in the inflated streams, so the branding is
  now proven on every document the server generates, not only on the purchase order. `docs/setup.md`
  ("Logo verification") holds the gate output
  and the hosted record, including the pooler finding that came out of the same pass.
