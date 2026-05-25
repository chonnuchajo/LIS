# QC Photo Attachment — Design Spec

**Date:** 2026-05-25
**Feature:** Multi-photo attachment for `photo` type fields in QC test results
**Approach:** Upload to server (Approach A) — multer → disk → static serve

---

## 1. Data Model

### Backend: `server/models/Parameter.js`

Add `maxPhotos` to `ValueFieldSchema`:

```js
maxPhotos: { type: Number, default: 5 }
```

### Frontend: `src/lib/api.ts`

Add to `ParameterValueField` type:

```ts
maxPhotos?: number;
```

### QC Result value format

Photo field values are stored in `QCTestResult.values` as an array of URL strings, keyed by the field label:

```json
{ "ภาพถ่าย": ["/LIS/uploads/qc-photos/uuid-1.jpg", "/LIS/uploads/qc-photos/uuid-2.jpg"] }
```

---

## 2. Backend — Upload Infrastructure

### Dependency

Install `multer` in `server/`:

```bash
npm install multer
```

### Static file serving (`server/index.js`)

```js
app.use('/LIS/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

### New route: `server/routes/uploads.js`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/uploads/qc-photo` | Upload one photo file |
| DELETE | `/api/uploads/qc-photo` | Delete one photo file by URL |

**POST `/api/uploads/qc-photo`**
- Accepts: `multipart/form-data`, field name = `"photo"`
- Constraints: max 10MB, JPEG/PNG/WEBP only (validated by mimetype)
- Saves to: `server/uploads/qc-photos/<uuid>.<ext>`
- Returns: `{ url: "/LIS/uploads/qc-photos/<uuid>.<ext>" }`

**DELETE `/api/uploads/qc-photo`**
- Body: `{ url: "/LIS/uploads/qc-photos/<filename>" }`
- Validates the path stays inside `uploads/qc-photos/` (no path traversal)
- Deletes file from disk
- Returns: `{ ok: true }`

### Mount in `server/index.js`

```js
mountApi('/uploads', require('./routes/uploads'));
```

---

## 3. Frontend — Parameter Settings

**File:** `src/pages/ParameterSettings.tsx`

When a field has `type === "photo"`, show an additional input in the field editor:

```
จำนวนภาพสูงสุด: [  5  ] ภาพ
```

- Integer input, min = 1, max = 20, default = 5
- Saved as `maxPhotos` on the field definition

---

## 4. Frontend — PhotoField Component

**New file:** `src/components/lis/PhotoField.tsx`

Props:
```ts
interface PhotoFieldProps {
  field: ParameterValueField;   // contains maxPhotos
  value: string[];              // array of photo URLs
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}
```

Behavior:
- **Add photo**: hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`, triggered by "+ เพิ่มภาพ" button
  - On file select → POST `/api/uploads/qc-photo` → receive URL → append to array → call `onChange`
  - Show loading spinner during upload
  - Button hidden when `urls.length >= field.maxPhotos` or `disabled`
- **Thumbnail grid**: display all current photos as small thumbnails (80×80px)
  - Click thumbnail → open lightbox/modal showing full-size image
  - Each thumbnail has an `×` delete button (hidden when `disabled`)
- **Delete**: DELETE `/api/uploads/qc-photo` with URL → remove from array → call `onChange`
- **Disabled mode**: thumbnails visible, no add/delete buttons

---

## 5. Frontend — QCTestingDetailPage Integration

**File:** `src/pages/QCTestingDetailPage.tsx`

Replace the placeholder:
```tsx
// Before
field.type === 'photo' ? (
  <div className="text-xs text-grey-400 italic py-1">แนบรูปภาพ (ยังไม่รองรับในเวอร์ชันนี้)</div>
)

// After
field.type === 'photo' ? (
  <PhotoField
    field={field}
    value={Array.isArray(value) ? value : []}
    onChange={(urls) => onChange(urls)}
    disabled={disabled}
  />
)
```

The existing `onChange` handler already calls `PUT /api/qc-results` with the new value — no other changes needed for saving.

---

## 6. Frontend — API Layer (`src/lib/api.ts`)

Add two functions:

```ts
async function uploadQcPhoto(file: File): Promise<{ url: string }>
async function deleteQcPhoto(url: string): Promise<void>
```

Both use `fetch` directly with `FormData` / `JSON` body (not the existing `api` wrapper, since the wrapper assumes JSON).

---

## 7. Files Changed

| File | Change |
|------|--------|
| `server/models/Parameter.js` | Add `maxPhotos` to `ValueFieldSchema` |
| `server/routes/uploads.js` | New — upload/delete endpoints |
| `server/index.js` | Add static serve + mount uploads route |
| `server/package.json` | Add `multer` dependency |
| `src/lib/api.ts` | Add `maxPhotos` to type, add `uploadQcPhoto`/`deleteQcPhoto` |
| `src/pages/ParameterSettings.tsx` | Add `maxPhotos` input for photo fields |
| `src/components/lis/PhotoField.tsx` | New — photo upload/display component |
| `src/pages/QCTestingDetailPage.tsx` | Replace placeholder with `<PhotoField>` |

---

## 8. Out of Scope

- Cleanup of orphaned files (uploaded but then QC deleted) — manual admin task
- Photo display in QC approval/report pages (separate feature)
- Image compression/resize on upload
