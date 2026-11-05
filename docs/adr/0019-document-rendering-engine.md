# ADR-0019 — Document rendering engine for French and Arabic documents

- **Status:** accepted — implemented on 2026-11-05; the product owner read this memo and gave the
  go-ahead for Phase 15
- **Date:** 2026-11-05
- **Deciders:** product owner, engineering
- **Amends:** ADR-0014 decision 4 (server-rendered artifacts stay English)
- **Related:** ADR-0010 (purchase documents), ADR-0017 (counter sales), ADR-0018 (organization logos)

## Context

Six document families leave the server today: purchase order, purchase return note, sales
invoice, goods issue note, product label sheet and device label sheet. All six are drawn by
`pdf-lib` with the three standard Type 1 fonts (Helvetica, Helvetica-Bold, Courier) — the four A4
documents through the shared `pdf-layout.ts`, the two label sheets from `scanning/labels.service.ts`
— and all six were proven on hosted with the tenant mark embedded
(ADR-0018, docs/setup.md "Hosted document-family sweep").

None of them can carry French or Arabic text. The reason is one function,
`sanitizeText` in `apps/api/src/documents/document-format.ts`:

```ts
/** Standard PDF fonts use WinAnsi, so non-Latin text is transliterated or replaced. */
export function sanitizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // é -> e, â -> a
    ...
    .replace(/[^\x20-\x7e\n]/g, '?');  // every Arabic letter -> '?'
}
```

Measured against the production build (`apps/api/dist/documents`, the model and renderer that
serve the hosted routes), an Arabic invoice renders 3,179 bytes containing **135 `?`** and zero
surviving Arabic characters. The stripping is not a fallback path: `pdf-lib`'s WinAnsi encoder
_throws_ `WinAnsi cannot encode "ه" (0x0647)` if the sanitizer is bypassed. French is a smaller
problem — the same standard fonts do draw `é`, `â`, `—`, `«` and `»` correctly, so only our own
sanitizer damages it; the labels ("Total excl. tax", "Goods issue note", "Issue date") are
hard-coded English strings in the two document models.

## What any replacement must keep

These are properties of the current renderer that the product depends on, each verified in the
hosted family sweep or read from the code:

- A4 pages (595.28 × 841.89 pt) and the margins/row heights in `apps/api/src/documents/pdf-layout.ts`;
- the column header band redrawn on every page (`pdf-layout.ts:251`), and `Page ${i} of ${n}` on every page (`pdf-layout.ts:304`);
- a `DRAFT` / `CANCELLED` watermark on every page of a multi-page document;
- the tenant mark in a 44 × 30 pt box on page one only (ADR-0018), plus `/Title` and `/Creator Nexora` metadata;
- identifiers, SKUs, serials, IBANs and amounts staying left-to-right inside right-to-left sentences;
- integer-millimes money from `packages/domain`, read back from the database, never from the browser;
- deterministic bytes: two renders of the same document are identical;
- byte-level test assertions (`pdfText`, `pdfImages`, `pdfGeometry` in `apps/api/test/api/pdf.ts`, 14 call sites across 3 test files) and the logo upload probe that embeds the image exactly as the renderer does (`assertLogoEmbeddable`);
- the route layer (`runAsMember`, `RenderedDocument`) and the label/barcode path (`bwip-js` PNGs).

## Spike method

Both engines were measured on the same machine (Windows 11, Node 26.13) across 2026-11-04 and
2026-11-05. The
pdf-lib numbers come from the **production build** of the models and renderers, not a rewrite;
the Chromium numbers come from one HTML/CSS invoice template with the same columns, totals
block, watermark and base64 mark, printed with `page.pdf({ printBackground: true,
preferCSSPageSize: true })`. PDF text was read back with `pdftotext -enc UTF-8` (poppler, already on
PATH) as well as by inflating content streams. Scripts and the probe PDFs they wrote are scratch
files in gitignored `logs/spike/`. Everything below is a measurement, except where marked untested.

## Measured comparison

|                                               | pdf-lib today                                                                                  | pdf-lib + fontkit + Arabic TTF                                                      | HTML/CSS + headless Chromium                                                                                                                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arabic letters survive                        | no (`?`)                                                                                       | yes                                                                                 | yes                                                                                                                                                                                                                                                                       |
| Arabic joins letters                          | n/a                                                                                            | **yes** — 11 code points of `لالالا محلل` become 8 glyph ids (three `لا` ligatures) | yes                                                                                                                                                                                                                                                                       |
| Arabic reading order                          | n/a                                                                                            | **wrong** — advances left→right from the left margin                                | correct RTL, marks top-right, codes/amounts stay LTR                                                                                                                                                                                                                      |
| French accents                                | blocked only by our sanitizer                                                                  | yes                                                                                 | yes                                                                                                                                                                                                                                                                       |
| Same one-page letter, no mark                 | 3,110 B (en) / 3,234 B (fr) / 3,179 B (ar)                                                     | 7,782–11,335 B for one Arabic line                                                  | 19,023 B (en) / 19,714 B (fr) / 22,995 B (ar)                                                                                                                                                                                                                             |
| Full invoice + the 117,384 B app icon as mark | ≈ 3–4 KB                                                                                       | + font subset                                                                       | 186,701 B (en) / 187,555 B (fr) / 202,421 B (ar)                                                                                                                                                                                                                          |
| Tenant 399,980 B photo mark                   | +476,677 B (embedded raw)                                                                      | same                                                                                | **+333,747 B** (re-encoded and downsampled)                                                                                                                                                                                                                               |
| Latency                                       | 50.6 ms cold, 5–8 ms after                                                                     | same                                                                                | browser launch 274–557 ms; one invoice on a fresh page 365–923 ms; 835 ms for launch + render + close from cold; 96–181 ms for a short page; 6–28 ms reusing one warm page                                                                                                |
| Throughput                                    | sub-ms to 8 ms each                                                                            | same                                                                                | 10 renders sequential 3.4–4.0 s, concurrent **1.4–1.7 s**                                                                                                                                                                                                                 |
| Runtime weight                                | 0 (already a dependency)                                                                       | one TTF, `@pdf-lib/fontkit`                                                         | 278 MB headless shell / 437 MB full Chromium + 13.3 MB `playwright-core`; browser tree 223 MB working set                                                                                                                                                                 |
| Page footers / page numbers                   | hand-drawn                                                                                     | hand-drawn                                                                          | verified: `Page 1 of 2`, `Page 2 of 2` on the right pages, with both `displayHeaderFooter` and a CSS `@page` margin box                                                                                                                                                   |
| `<thead>` on every page                       | hand-drawn                                                                                     | hand-drawn                                                                          | free — `Seq Amount` extracted from both pages of a 60-row table                                                                                                                                                                                                           |
| Text readable from bytes                      | yes — `<hex> Tj` whose bytes _are_ WinAnsi code points, so latin1-decoding them gives the text | same                                                                                | **not with that trick** — also `<hex> Tj`, but 2-byte glyph ids from a subset that is renumbered per render. The text is genuinely there: `pdftotext -enc UTF-8` recovered 39 Arabic letters and the `—` from the Arabic probe. Only a ToUnicode-aware reader can see it. |
| Operators our tests grep for                  | 56 `1 0 0 1 x y Tm <hex> Tj` runs, 5 `m … l … S` stroked rules                                 | same                                                                                | **0 of each** — text is placed inside a page-wide `cm` scale and rules are 128 filled `re` rectangles                                                                                                                                                                     |
| Byte-deterministic output                     | yes                                                                                            | yes                                                                                 | yes on one host (two renders identical); **fonts are host-dependent** — the subsets embedded were `AAAAAA+SegoeUI-Bold` and `BAAAAA+SegoeUI`, i.e. the Windows UI font                                                                                                    |
| Extra dependency                              | none                                                                                           | a licensed TTF + fontkit                                                            | a browser on every machine that runs the API                                                                                                                                                                                                                              |

## Options

### A — Keep pdf-lib, fix French only

Stop `sanitizeText` from stripping accents (the standard fonts can draw them, as measured), move
the document labels into per-locale catalogs, and pass a locale through the PDF routes. Arabic
stays refused: the engine throws on Arabic code points and there is no bidi layout.

Cheapest by far — no new dependency, no size or latency change, all byte-level tests keep
passing, and the hosted family proof stays valid. It answers half the requirement and leaves
Arabic invoices printing `?` forever. **Viable only if Arabic documents are dropped.**

### B — pdf-lib + `@pdf-lib/fontkit` + an Arabic TTF + a hand-built RTL layer

The subset embedder works and OpenType substitution runs, which was the uncertain part: letter
joining and `لا` ligatures happen. But `pdf-lib` positions glyphs by advance from a caller-chosen
x, so reading order is left-to-right no matter what the font does — confirmed by eye on the
probe PDF. Producing correct Arabic needs a bidi reordering pass, run segmentation, per-run
reversal, right-to-left cursor arithmetic, shaping advances for width measurement, and
mixed-direction handling for codes and amounts inside RTL sentences. That is writing a text
layout engine inside a document that already has 583 lines of hand-placed geometry, and it costs
7.8–18.7 KB of subset font per document. **Rejected: highest effort, highest correctness risk,
and the least-tested code would be exactly the part that decides whether an invoice is readable.**

### C — HTML/CSS templates printed by headless Chromium

One template per family, styled with the existing geometry as CSS, `dir="rtl"` for Arabic, the
mark as a `data:` image, the watermark as `position: fixed`, the header band as `<thead>`, the
page number as a `@page` margin box. Correct shaping and ordering come from the same engine that
already renders the app, and the three properties we hand-draw today are free.

The costs are real and measured: two orders of magnitude more bytes per document, a browser as a
runtime dependency of the API, 0.4–0.9 s on a cold context (mitigated to 6–28 ms per page by
reusing one warm browser), host-dependent embedded fonts, and our byte-scanning text helpers stop
working. CI already installs Chromium in two of the four jobs (`npx playwright install
--with-deps chromium`, ci.yml:111 and ci.yml:169); the `quality` job that runs the pdf-lib unit
tests does not. **Recommended.**

### D — Print from the browser instead of the server

The web app only ever receives a finished PDF blob and opens it through an object URL
(`apps/web/src/lib/download.ts`, `features/scanning/label-dialog.tsx`), so this option means
building a print-styled HTML view per document and letting the browser print it. Rejected: the
label sheets and any future email or archive path need a server-produced artifact, and what a
print job produces depends on the dialog the operator is standing in front of. **Not a document
engine.**

## Decision

### 1. Adopt Chromium for the four A4 document families

Purchase order, purchase return note, sales invoice and goods issue note move to HTML templates
printed by a warm, single long-lived browser inside the API. The label sheets keep pdf-lib and
`bwip-js`: their geometry is barcode-and-dimensions-critical, their text is SKU-heavy Latin, and
they are the only family where Arabic product names are a nice-to-have. `pdf-layout.ts` shrinks
to whatever the label path still needs; the rest is deleted, not kept behind a flag.

### 2. Bundle the fonts, so a document does not depend on the host

The Segoe UI result is unacceptable for a legal artifact: the same invoice would embed different
bytes on a technician's laptop and a Linux box, and a host with no Arabic font at all would print
boxes. This was tested and it works: a TTF declared with `@font-face` is embedded as its own
subset (`/FontFile2`, base font `AAAAAA+ArabicTypesetting` from Windows' arabtype.ttf, `AAAAAA+Tahoma`
from tahoma.ttf) and the host UI font is then not used at all. On the same four-paragraph Arabic
page the cost is 23,907 B with the host font, 30,827 B with Tahoma declared, 46,548 B with the Naskh
face — i.e. a bundled Arabic face adds 7–23 KB, not megabytes, even though the source TTF is
0.5–0.9 MB. Both PDFs extracted back to correct, logically ordered Arabic with the em-dash and the
`FI-2026-0001` intact.

Ship one Latin + Arabic family under `apps/api/src/documents/fonts/`, chosen with the owner for its
licence and its look, and assert the embedded base font name in the tests so a document that quietly
fell back to a host font fails CI. The unmeasured detail here — whether the same embedding survives a
`data:` URI instead of a `file://` page — settled in the implementation: it does, and the shipped faces
are inlined base64 IBM Plex Sans Arabic (see "Settled after the decision").

### 3. Locale travels with the download request

`GET .../pdf?locale=fr|ar|en`, validated by the contract, defaulting to English. The web app
passes its own `mystock.locale` (ADR-0014 decision 1). Document strings move into the same
three-locale catalog shape already used by the UI, so the Arabic and French label sets are
compile-time complete; the models stop holding literals. This is the amendment to ADR-0014
decision 4. It does touch the API contract, which ADR-0014 predicted, but it does not touch
stored documents — there are none: the only `bytea` in the schema is the logo
(`supabase/migrations/20261103120000_organization_logos.sql:12`), and every document is rendered
from rows at download time.

### 4. Assert documents through text extraction, not stream grep

Both engines write `<hex> Tj`, and our helpers rely on the pdf-lib half of that contract: the hex
bytes are WinAnsi code points, so `pdfText` decodes them with latin1, and `pdfGeometry` looks for
`1 0 0 1 x y Tm` before the run plus `m … l … S` for rules. None of that exists in Chromium
output — 0 matching runs, 0 stroked rules, and the whole page is drawn inside one scaling `cm`
with rules as filled rectangles. Structure assertions keep working unchanged (`/Subtype /Image`,
`/SMask`, page count, `/Title`), and Chromium's RGBA mark is still image + SMask = two objects,
exactly what `branding.spec.ts:68` counts today.

Text assertions therefore move to a maintained ToUnicode-aware extractor as a dev dependency.
`pdftotext -enc UTF-8` proved the text is really in the file (39 Arabic letters and the `—`
recovered from the Arabic probe, in logical order); the hand-rolled CMap parser written during the
spike produced mojibake, so we buy that decoder rather than trying to write a second one. Arabic
assertions must check joined, ordered words — that is the regression this phase exists to prevent.
Page numbering uses a CSS `@page` margin box, which printed the same `Page 1 of 2` / `Page 2 of 2`
as Chromium's own `displayHeaderFooter`, and it stays inside the template.

### 5. Guards, because the API now owns a browser

One browser process for the whole API, created lazily, one page per render, closed in `finally`;
a hard timeout per render that kills and restarts the browser rather than hanging the route; a
serialized queue cap so a busy counter cannot fork fifty renderers; and the readiness probe
reports the renderer's state so a missing browser is a boot-time failure, not a 500 at the
moment a customer is waiting. The spike did not test crash or restart behaviour.

## Consequences

- Arabic documents become possible and French stops being damaged by our own sanitizer; the
  sanitizer keeps its transliteration job for the label path only.
- Documents grow from ~3 KB to 187–202 KB, and a tenant that uploads a 400 KB mark now gets a
  _smaller_ PDF than today (357 KB vs 478 KB) — the 400 KB logo cap is a document-size decision
  with a different shape under this engine, worth revisiting together with the Step 5 warning at
  ~100 KB.
- Running the API requires Chromium (278–437 MB) plus this repo's 13 MB, and the machine that
  prints documents must be able to run a browser. That is new for an operator who hosts the API
  somewhere minimal; it is already true for anyone who runs the E2E suite. Decision 2 adds a
  licensed font to the repository (0.5–0.9 MB per face, only a subset per document).
- The `quality` CI job must install a browser (or the renderer unit tests move to the local-stack
  job that already has one). Font availability on `ubuntu-latest` is **untested** — this machine
  has no Docker and no WSL distribution, so the Linux font-fallback question is a gate, not an
  assumption; bundled fonts (decision 2) are the mitigation, and the check is one CI run.
- `assertLogoEmbeddable` (ADR-0018's write barrier) must be re-pointed at the new engine, or an
  upload could pass the probe and fail at print.
- Re-rendering an archived document years later is only faithful if the template, fonts and
  browser version are pinned — the artifact itself is not stored, so the browser upgrade is a
  document-format change. Bundle fonts and pin the Playwright version in the lockfile.
- The migration surface was the two document renderers (288 lines) plus the parts of `pdf-layout.ts`
  they used, the locale plumbing through contracts and routes, the logo probe, the 3 API test files that
  use the byte helpers (14 call sites), and the download assertions in
  `apps/web/e2e-local/{operations,counter-sale,branding}.spec.ts`. All of it landed in Phase 15; see the
  implementation record below.
- The label sheets keep today's defect for Arabic product names: they stay on pdf-lib by decision,
  so an Arabic product name still prints as a row of `?` on a sticker while it prints correctly on
  the invoice beside it. Fixing that is a separate, smaller decision.

## Settled after the decision

The three open measurements above were taken on the implemented engine on 2026-11-05; the full set of
numbers is in docs/setup.md, "Document rendering engine verification".

1. **`data:`-URI fonts — settled.** The faces ship as base64 inside the page and embed exactly as they
   did from `file://`: `/FontFile2` present, base fonts `AAAAAA+IBMPlexSansArabic-Regular` and
   `BAAAAA+IBMPlexSansArabic-Bold`, and no host face in the file. The API tests assert that set, so a
   document that fell back to Segoe UI or a Linux default fails the suite rather than shipping.
2. **Linux — settled only by CI.** Still unrunnable from this machine, so the `quality` job now installs
   Chromium and `poppler-utils` and the first Actions run after this commit is the check.
3. **Failure behaviour — settled.** A page that stops answering is cut off by its own deadline, the
   browser is SIGKILLed and the next request prints from a fresh one. Teardown detail the spike could
   not foresee: `BrowserServer.close()` never returns for a wedged browser — it waits on the connection
   the frozen page owns — while `server.kill()` returned in 744 ms on the same process, so `kill()` is
   what the timeout path and the `disconnected` handler use. A browser SIGKILLed from outside is noticed
   by the `disconnected` event: the in-flight request rejected in 1,595 ms and the next render succeeded
   from a new launch. Recovery to a printed document measured ~1.9 s; readiness answers in 0 ms on a warm
   browser and `503` when no browser can start.

## Implementation record

Shipped as decided, with three choices the spike had not made:

- **A post-pass over the browser's bytes.** Chromium stamps `/CreationDate` with second resolution, so
  output is deterministic only inside one second. `pdf-lib` re-stamps `/Title`, `/Creator`,
  `/CreationDate` and `/ModificationDate` to the render instant with `useObjectStreams: false`, which
  also keeps `/FontFile2`, `/BaseFont`, `/Title` and `/Subtype /Image` in plain objects for the byte
  probes — object streams pack them away and break both.
- **Concurrency is capped at three renders**, queueing beyond that, rather than one page at a time. A
  counter printing an invoice while the back office exports a purchase order should not wait behind it.
- **The unit suite runs three workers.** Each API test file brings its own database and, now, the document
  files bring a Chromium each; at the default `cpus - 1` an 8-core box oversubscribes badly enough that a
  render misses the engine's own deadline — the kill test measured 15.5 s of wall clock against a 750 ms
  budget — and another file's teardown hook timed out. `test.maxWorkers = 3` in `apps/api/vitest.config.mts`
  fixes both; Vitest 4 retired `poolOptions.forks`, so a cap written there is silently ignored by v5. With
  the cap, 43 files and 341 API tests pass in 178 s.
- **Every CI job that boots the API installs the browser.** Run #14 came back red on the `database` job: the
  virgin-database drill waits for `/health/ready` to answer `200`, readiness now prints a document, and that
  job never installed Chromium. Reproduced on this machine with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
  directory — the API starts, `/health/live` answers `200`, `/health/ready` answers `503` naming the missing
  executable — and fixed by giving the job the same `playwright-core install` step `quality` already runs.
  A browser is now part of the API's runtime contract, so a CI job that boots it without one is testing a
  deployment that cannot exist.
- **Arabic is matched by letters, not by reader order.** The two `pdftotext` builds disagree about a printed
  Arabic word: Chromium gives each shaped glyph its own position, and the reader has to rebuild the word from
  those positions. poppler (CI) reports some of them transposed — in every pair recorded from run #14 the
  letter that moves is one whose box drops below the baseline (final ـي، ـئ، ـر، the hamza under an alif), so
  the reading looks like a grouping by vertical extent — while Xpdf 4.00 on this machine keeps the run whole.
  Same bytes, two readings: `المعرف الجبائي` versus `المعرفالجبايئ`, `أمر شراء` versus `أمررشاء`. Nothing here
  says the page is wrong — the Arabic pages were converted to images during the spike and read back correctly,
  and the same template and browser build print on CI. So `expectArabicPhrase` in `apps/api/test/api/pdf.ts`
  compares the phrase's letters over a sliding window and the exact spelling stays pinned in the `/Title` every
  document writes, which no reader touches. Latin and digits keep verbatim assertions, and the
  English-must-be-absent checks compare the de-spaced text — poppler drops the space between English words
  as well, reporting `Deliver before noon.` as `Deliverbeforenoon`.

The retired code is deleted, not guarded: `pdf-layout.ts`, `purchase-documents.pdf.ts` and
`sales-documents.pdf.ts` are gone, `document-format.ts` keeps the ASCII formatters and the WinAnsi
sanitizer for the label path, and the byte-level test helpers now read printed text with `pdftotext`
(`apps/api/test/api/pdf.ts`) while the label sheets keep content-stream geometry checks.

## The first page the owner read: what the download found

The engine shipped green through 341 API tests that read _text_, and text cannot show a collision:
an amount that belongs to a line but prints 380 pt away from it extracts as the same two strings.
The first real download (`nexora-FI-2026-0008.pdf`, French, printed from the hosted API) was turned
into images and read the way a counter reads it. Five things were wrong, and none of them was the
renderer:

1. **The payments row was a flex row inside a 220 pt box**, so the method and its reference wrapped
   while the amount stayed on the first baseline — the money looked detached from the payment. It is
   now a table across the full content column with a 96 pt amount column, which is the same end edge
   the line table and the totals already finish at: every figure on the page is in one vertical line.
2. **The totals repeated the payment method.** `sales_invoices.payment_method` is a projection that
   each new payment overwrites (migration `20261102180000`, `set payment_method = p_method`), so the
   row restated — and on a mixed-cash-then-transfer invoice _contradicted_ — the list below it. The
   method now prints in the totals only when no payment row exists, which is the one case where the
   invoice is the only source: an unpaid on-account sale has nothing else that says «Sur compte».
3. **Empty fields printed a hyphen next to their own label** («RÉFÉRENCE -»). `compactMeta` drops an
   entry with nothing to print, and the row divides whatever width is left among what remains. A value
   too long for its column broke onto a second line rather than ending in an ellipsis: the probe
   «DEVIS-11-TRÈS-LONG-RÉFÉRENT-2026» printed whole instead of «…RÉ...».
4. **Identifiers were truncated with an ellipsis** at 96 pt, so a long SKU printed as
   `CHARGEUR-USB-C-65W-PD-202…`. The SKU, serial and description columns wrap; the money columns and
   the line number stay on one line, and the widths were re-measured for the three- and four-digit
   amounts the real ledger produces.
5. **Two rules under the last line** — the table's own bottom border plus the totals box's top
   border — read as an empty row. The last row is now unruled and the box draws the single rule.

What that pass cannot fix is the missing issuer: a Tunisian VAT invoice has to carry the seller's
address and tax number, and `public.organizations` holds only `id, name, slug, created_at, updated_at`
(no migration has ever added a column). That is a schema decision, not a layout one, and it is open.

## Open questions for the product owner

1. Arabic invoices: printed alongside the French copy, or only when the operator's device is in
   Arabic? The spike assumes the latter (one locale per download); a bilingual document is a
   second page per document, not a second column.
2. Which Arabic font, and is bundling it in the repository acceptable for the licence? Latin and
   Arabic metrics differ enough that the choice is visible on the page. — Settled during implementation:
   IBM Plex Sans Arabic (regular and bold), bundled with its Open Font Licence text, so the printed page
   does not depend on a host font being installed.
3. Where will the API run once this ships — this Windows machine, a VPS, a container image? The
   answer decides whether a browser install is a one-line setup step or a Dockerfile change.
4. Is a 187 KB PDF acceptable for anything that emails or archives documents, or should the
   renderer compress/flatten the mark before embedding?
