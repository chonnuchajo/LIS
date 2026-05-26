# Parameter File Attachment — Design Spec

**Date:** 2026-05-25  
**Status:** Approved

## Overview

Add a new `file` value-field type to the Parameter system, allowing lab staff to configure a parameter that requires document attachments (PDF, Excel, Word, CSV). This is separate from the existing `photo` type which handles image uploads only.

---

## Schema (`server/models/Parameter.js`)

Add `'file'` to the `type` enum in `ValueFieldSchema`:

```js
type: { type: String, enum: ['text', 'number', 'float', 'enum', 'photo', 'file', 'timer'], required: true }
```

Add two new fields to `ValueFieldSchema`:

| Field | Type | Default | Constraint |
|-------|------|---------|------------|
| `maxFiles` | Number | `5` | min: 1, max: 20 |
| `allowedFileTypes` | [String] | `['pdf']` | values: `'pdf'`, `'excel'`, `'word'`, `'csv'` |

No validation changes needed for the pre-validate hook — `file` type has no unit/options/timer requirements.

---

## Backend Routes (`server/routes/uploads.js`)

New upload directory: `server/uploads/param-files/`  
Created with `fs.mkdirSync` on startup (same pattern as `qc-photos`).

### MIME type mapping

| Key | MIME types |
|-----|-----------|
| `pdf` | `application/pdf` |
| `excel` | `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `word` | `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `csv` | `text/csv`, `text/plain` |

### `POST /api/uploads/param-file`

- Multipart field name: `file`
- Max file size: 20 MB
- MIME filter: accepts all four document MIME types above
- Filename: `randomUUID() + extension derived from mimetype`
- Returns: `{ url: "/LIS/uploads/param-files/<filename>", name: <original name>, size: <bytes> }`

### `DELETE /api/uploads/param-file`

- Body: `{ url: "/LIS/uploads/param-files/<filename>" }`
- Same path-traversal protection as `DELETE /api/uploads/qc-photo`
- Returns: `{ ok: true }`

### Multer error handler

Reuse the same router-level error handler pattern already in the file.

### Note on allowedFileTypes enforcement

The backend route accepts **all four document MIME types** regardless of `allowedFileTypes`. The `allowedFileTypes` field is enforced client-side only: the file input's `accept` attribute is built from the configured types, so the OS file picker filters accordingly. This matches the simplicity of the existing photo upload — no per-parameter backend enforcement needed.

---

## API Types (`src/lib/api.ts`)

### `ParameterValueFieldType`

```ts
export type ParameterValueFieldType =
  "text" | "number" | "float" | "enum" | "photo" | "file" | "timer";
```

### `ParameterValueField` — new optional fields

```ts
maxFiles?: number;
allowedFileTypes?: string[];  // 'pdf' | 'excel' | 'word' | 'csv'
```

### New functions (bare fetch, same pattern as `uploadQcPhoto`)

```ts
uploadParamFile(file: File): Promise<{ url: string; name: string; size: number }>
deleteParamFile(url: string): Promise<void>
```

---

## Frontend Settings UI (`src/pages/ParameterSettings.tsx`)

### `VALUE_TYPE_OPTIONS`

Add entry:
```ts
{ value: "file", label: "แนบไฟล์ (File)" }
```

### `FIELD_TYPE_META`

Add `file` entry with Paperclip icon (import from lucide-react), teal color palette:
```ts
file: {
  label: "แนบไฟล์",
  Icon: Paperclip,
  accent: "bg-teal-500",
  tint: "bg-teal-50/50",
  text: "text-teal-700",
  iconText: "text-teal-500",
}
```

### `emptyValueField()`

Add defaults for the two new fields:
```ts
maxFiles: 5,
allowedFileTypes: ['pdf'],
```

### `ValueFieldEditor` — file type section

When `field.type === 'file'`, render:

1. **จำนวนไฟล์สูงสุด** — Number input, range 1–20, bound to `field.maxFiles`
2. **ประเภทไฟล์ที่รับได้** — Four checkboxes in a row: PDF / Excel / Word / CSV, bound to `field.allowedFileTypes`. At least one must be checked (validated on save).

### `summarizeField`

```ts
case "file": {
  const types = (field.allowedFileTypes ?? ['pdf']).join(', ').toUpperCase();
  const max = field.maxFiles ?? 5;
  return `${types} (สูงสุด ${max} ไฟล์)`;
}
```

### `ValueFieldBadges`

Show `· file` with the allowed type list in the badge detail, same pattern as other types.

### `validate()` in `ParameterDialog`

Add check: when `field.type === 'file'` and `allowedFileTypes` is empty, return error `"ต้องเลือกประเภทไฟล์อย่างน้อย 1 ชนิด"`.

---

## File structure changes

```
server/
  uploads/
    param-files/        ← new (gitignored)
  routes/
    uploads.js          ← add new routes + multer config for documents
  models/
    Parameter.js        ← add 'file' type, maxFiles, allowedFileTypes

src/
  lib/
    api.ts              ← add type, fields, uploadParamFile, deleteParamFile
  pages/
    ParameterSettings.tsx  ← add UI for file type
```

---

## Out of scope

- The actual file upload UI when a lab user is filling in results (that's a separate feature on the results-entry page)
- File download/preview UI
- Per-user upload quotas
- Virus scanning
