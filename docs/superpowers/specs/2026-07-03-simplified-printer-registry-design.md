# Simplified Printer Registry — Design

**Date:** 2026-07-03
**Status:** Approved (design), pending implementation plan
**Area:** Settings → "เครื่องพิมพ์เอกสาร" tab, server print pipeline

## Problem

The current printer settings bind one printer configuration to each **document type** (`slug`).
There are 5 cards (ฉลากตัวอย่าง, COA, ใบคำขอ, ฉลากขวด Standard, รายงาน Daily Check), each carrying a
local-printer dropdown, a CUPS URL, copies, and paper size.

In practice the lab has essentially **two physical destinations**: an A4 laser printer and a
label/sticker printer. Maintaining a printer per document type is redundant. The user wants to:

- Delete all the per-document-type printer configs.
- Replace them with just two printer kinds: **A4** and **Sticker**.
- Keep **only a CUPS printer URL** per printer (no local-printer dropdown, no copies, no paper-size field).
- Be able to **add** printer URLs.

## Key facts discovered

- `copies` and `paperSize` are **already not user-editable** in the current card. `PrintConfigCard` only
  edits `printerName` (local dropdown) + `cupsPrinterUrl`. `copies` is supplied at print time by
  `PrintPreviewDialog`; `paperSize` is derived server-side from the document type. Dropping both from the
  config is a no-op for behaviour.
- The server print pipeline (`server/routes/print.js`) decides **media/paper size by `docType`**, not by the
  stored `paperSize` field:
  - `sample-label` → forced `label-100x50` (rendered as PNG, DPI-tagged)
  - `stock-label` → `label-6x4`
  - `coa` / `service-request` / `daily-check-report` → A4
  - This stays unchanged: a single sticker printer still receives the correct `media-col` per job.
- Callers of `printDocument`:
  - `PrintPreviewDialog` passes an explicit `copies`.
  - Stock-label callers (`ReceiveBottlesDialog`, `WithdrawDialog`, `StandardUnitsPanel`, `ReceiveCart`) pass no
    copies → default 1. Removing config-level `copies` keeps this behaviour.
- Local printing (`pdf-to-printer`) is unused in production (prod prints via CUPS at
  `https://192.168.0.237:631`). It will be removed.

## Design

### Concept

Stop binding printers to document types. Bind printing to **two printer kinds** — `a4` and `sticker` — and map
each document type to a kind. Paper size / media keeps being derived from the document type inside the pipeline.

| Document type        | Printer kind | Media (unchanged, derived in pipeline) |
|----------------------|--------------|----------------------------------------|
| `sample-label`       | `sticker`    | 100×50 mm (PNG)                         |
| `stock-label`        | `sticker`    | 6×4 in                                  |
| `coa`                | `a4`         | A4                                      |
| `service-request`    | `a4`         | A4                                      |
| `daily-check-report` | `a4`         | A4                                      |

The `docType → kind` map lives in **one shared place** (a small function/table) mirrored on the client
(`src/lib/printConfig.ts`) and server (`server/routes/print.js`), matching the existing pattern of mirrored
constants in this codebase.

### Data model — replace `PrintConfig`

New Mongoose model `PrinterConfig` (`server/models/PrinterConfig.js`). A printer is a destination, not a
per-document row:

```js
{
  kind: 'a4' | 'sticker',   // required, indexed
  label: String,            // display name, e.g. "HP LaserJet ชั้น 2"; optional (falls back to URL)
  cupsPrinterUrl: String,   // required; validated http/https/ipp/ipps and must resolve a queue
  isDefault: Boolean,       // the printer used when printing a document of this kind
  // timestamps
}
```

Rules:
- Exactly **one default per kind** is used at print time. When a kind has a single printer it is treated as the
  default automatically. Setting a new default unsets the previous default of the same kind.
- Removed fields vs old model: `slug`, `printerName`, `copies`, `paperSize`.
- Soft-delete plugin applies as with other models (per repo convention); the unique constraint is not on
  `slug` anymore, so no compound-index migration is needed — it is a fresh collection.

### "Delete all" / migration

- The old `printconfigs` collection is dropped (the user explicitly asked to delete all). The new
  `printerconfigs` collection starts empty; the user enters the two CUPS URLs fresh.
- Update `server/seed-data/` accordingly (remove `printconfigs.json`; a `printerconfigs.json` will appear on the
  next `seed:export`). Run `npm run seed:export` after the manual data reset so `seed-data/` stays current.

### API (`server/routes/print.js`)

New CRUD endpoints (mounted at both `/api/*` and `/LIS/api/*` as usual):

- `GET    /print/printers-config` — list all printer configs.
- `POST   /print/printers-config` — add `{ kind, label?, cupsPrinterUrl }`. First printer of a kind becomes its
  default.
- `PUT    /print/printers-config/:id` — edit `{ label?, cupsPrinterUrl? }` (kind is fixed once created).
- `DELETE /print/printers-config/:id` — remove. If it was the default and siblings remain, promote another to
  default.
- `PUT    /print/printers-config/:id/default` — set as default for its kind (unsets siblings).

Changed:
- `POST /print` — resolve `kind` from `docType`, load the default `PrinterConfig` of that kind, use its
  `cupsPrinterUrl`. If none configured → `400` with the existing Thai "ยังไม่ได้ตั้งค่าเครื่องพิมพ์…" message.
- Remove the `GET /print/printers` local-printer listing and the `pdf-to-printer` print branch.
- Remove `inferredCupsPrinterUrl` (queue-name guessing) and `printerName` fallbacks in `cupsTargetFromUrl`
  (the queue always comes from the URL path now).

Validation stays: CUPS URL must parse and use `http/https/ipp/ipps`; the URL must contain a
`/printers/<queue>` (or `/classes/<queue>`) segment so a destination can be resolved.

### Client

- `src/lib/printConfig.ts`:
  - Replace `PrintConfig`/`PrintConfigInput` with `PrinterConfig` (`{ id, kind, label, cupsPrinterUrl, isDefault }`)
    and an input type.
  - Add `PRINTER_KINDS` (`a4`, `sticker`) with Thai labels, and `docTypeToKind(docType)` mirroring the table
    above. Keep `PrintDocType` as-is (callers unchanged).
  - Keep a `validatePrinterUrl` helper mirroring the server validation.
- `src/lib/api.ts`: replace `getPrintConfigs` / `updatePrintConfig` / `getPrinters` with
  `getPrinterConfigs` / `createPrinterConfig` / `updatePrinterConfig` / `deletePrinterConfig` /
  `setDefaultPrinterConfig`.
- UI: replace `PrintConfigCard` with `PrinterRegistryCard` (or a small section component) rendering two groups:
  **A4** and **Sticker (ฉลาก)**. Each group lists its printers (label + CUPS URL), a "ใช้เป็นค่าเริ่มต้น" radio,
  edit + delete, and a **"+ เพิ่มเครื่องพิมพ์"** button. Follows the repo convention of explicit add (show only
  real rows; at least the add button, no auto-trailing blank card).
- `SettingsPage.tsx`: the `printers` tab renders the new component; drop the `printers` (local list) query and
  the old `printConfigs.map(...)`.

### Testing

- `printConfig.test.ts`: update to the new shape — `docTypeToKind` mapping (all 5 doc types), URL validation
  (valid CUPS URL, bad protocol, non-URL, missing queue).
- Server: unit-test the default-resolution helper (one printer auto-default; setting default unsets siblings;
  delete-default promotes a sibling) if a pure helper is extracted; otherwise cover via the route.
- `SettingsPage.test.tsx`: update expectations for the two-group printer UI.
- Manual E2E on the user's box: add an A4 URL + a Sticker URL, print one A4 doc (COA) and one sticker
  (sample-label + stock-label) end-to-end via CUPS.

## Out of scope / YAGNI

- No per-document-type printer overrides (that is exactly what we are removing).
- No local (`pdf-to-printer`) printing path.
- No configurable copies/paper-size in settings (copies stay a print-time argument; paper size stays derived).
- No auto-migration of old `printconfigs` rows — the user asked to delete all and re-enter two URLs.

## Open decisions (resolved)

1. **Layout** — dynamic list with one default per kind (superset of the "two fixed cards" option). **Approved.**
2. **Drop local printing** — yes, CUPS-only. **Approved.**
