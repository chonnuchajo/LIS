# QC Photo Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement multi-photo attachment for `photo`-type parameter fields in QC test results, storing files on the Express server and returning URLs saved into the existing `values` map.

**Architecture:** Multer handles file uploads via `POST /api/uploads/qc-photo`; uploaded files are stored in `server/uploads/qc-photos/` and served as static assets. The frontend `PhotoField` component manages upload/delete per field, storing an array of URLs as the field value. Max photos per field is configured in Parameter Settings.

**Tech Stack:** Express + Multer (backend), React + Tailwind + shadcn/ui (frontend), Vitest (unit tests)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/models/Parameter.js` | Modify | Add `maxPhotos` field to `ValueFieldSchema` |
| `server/routes/uploads.js` | Create | POST upload + DELETE remove endpoints |
| `server/index.js` | Modify | Static serve + mount uploads route |
| `vite.config.ts` | Modify | Proxy `/LIS/uploads` to dev backend |
| `src/lib/api.ts` | Modify | Add `maxPhotos` to type, add `uploadQcPhoto`/`deleteQcPhoto` |
| `src/pages/ParameterSettings.tsx` | Modify | Add maxPhotos input for photo fields |
| `src/components/lis/PhotoField.tsx` | Create | Photo upload/display component |
| `src/pages/QCTestingDetailPage.tsx` | Modify | Replace placeholder with `<PhotoField>` |

---

## Task 1: Backend — Add maxPhotos to Parameter model

**Files:**
- Modify: `server/models/Parameter.js`

- [ ] **Step 1: Add `maxPhotos` to `ValueFieldSchema`**

In `server/models/Parameter.js`, find the `ValueFieldSchema` definition and add `maxPhotos` after `required`:

```js
// existing line:
  required: { type: Boolean, default: false },
// ADD after it:
  maxPhotos: { type: Number, default: 5 },
```

Full updated `ValueFieldSchema` should end with:
```js
  timerUnit: {
    type: String,
    enum: ['minute', 'hour', 'day', 'month', null],
    default: null,
  },
  required: { type: Boolean, default: false },
  maxPhotos: { type: Number, default: 5 },
}, { _id: false });
```

- [ ] **Step 2: Verify the server still starts**

```bash
cd server && node -e "require('./models/Parameter'); console.log('OK')"
```

Expected: `OK` (no error)

- [ ] **Step 3: Commit**

```bash
git add server/models/Parameter.js
git commit -m "feat(backend): add maxPhotos field to Parameter ValueFieldSchema"
```

---

## Task 2: Backend — Install multer and create uploads route

**Files:**
- Create: `server/routes/uploads.js`

- [ ] **Step 1: Install multer**

```bash
cd server && npm install multer
```

Expected: `added 1 package` (multer installs)

- [ ] **Step 2: Create `server/uploads/qc-photos/` directory**

```bash
mkdir -p server/uploads/qc-photos
```

On Windows PowerShell:
```powershell
New-Item -ItemType Directory -Force -Path "server\uploads\qc-photos"
```

- [ ] **Step 3: Create `server/routes/uploads.js`**

```js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'qc-photos');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('ประเภทไฟล์ไม่รองรับ: รับเฉพาะ JPEG, PNG, WEBP'));
    }
  },
});

// POST /api/uploads/qc-photo
// Body: multipart/form-data with field "photo"
// Returns: { url: "/LIS/uploads/qc-photos/<filename>" }
router.post('/qc-photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ไม่พบไฟล์ภาพ' });
  }
  const url = `/LIS/uploads/qc-photos/${req.file.filename}`;
  res.json({ url });
});

// DELETE /api/uploads/qc-photo
// Body: { url: "/LIS/uploads/qc-photos/<filename>" }
router.delete('/qc-photo', (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const filename = path.basename(url);
  // Prevent path traversal: filename must not contain separators
  if (filename.includes('/') || filename.includes('\\') || filename !== path.basename(filename)) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  // Confirm the resolved path is still inside UPLOAD_DIR
  if (!filePath.startsWith(UPLOAD_DIR + path.sep) && filePath !== UPLOAD_DIR) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      return res.status(500).json({ error: err.message });
    }
    res.json({ ok: true });
  });
});

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Upload error' });
});

module.exports = router;
```

- [ ] **Step 4: Verify syntax**

```bash
cd server && node -e "require('./routes/uploads'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add server/routes/uploads.js server/uploads/.gitkeep
git commit -m "feat(backend): add multer upload/delete route for QC photos"
```

> Note: add a `.gitkeep` inside `server/uploads/qc-photos/` so the directory is tracked in git.

---

## Task 3: Backend — Wire uploads route + static serve, add Vite proxy

**Files:**
- Modify: `server/index.js`
- Modify: `vite.config.ts`

- [ ] **Step 1: Add static serve + mount route in `server/index.js`**

After `app.use(express.json(...))` and before the API routes, add:

```js
// Serve uploaded files as static assets
app.use('/LIS/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

Then add the uploads route mount inside the API routes section:

```js
mountApi('/uploads', require('./routes/uploads'));
```

Place it alongside the other `mountApi(...)` calls, e.g. after `mountApi('/qc-results', ...)`.

- [ ] **Step 2: Add Vite proxy for `/LIS/uploads` in `vite.config.ts`**

In the `proxy` object in `vite.config.ts`, add a new entry alongside the existing `/LIS/api` proxy:

```ts
proxy: {
  "/LIS/api": {
    target: "http://localhost:3001",
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/LIS/, ""),
  },
  "/LIS/uploads": {
    target: "http://localhost:3001",
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/LIS/, ""),
  },
},
```

- [ ] **Step 3: Manual test — start server and test upload endpoint**

Start the backend:
```bash
cd server && node index.js
```

Test upload (from a second terminal, replace `photo.jpg` with any JPEG file on disk):
```bash
curl -X POST http://localhost:3001/api/uploads/qc-photo \
  -F "photo=@photo.jpg" \
  -H "Accept: application/json"
```

Expected response:
```json
{ "url": "/LIS/uploads/qc-photos/<uuid>.jpg" }
```

Test delete using the URL returned above:
```bash
curl -X DELETE http://localhost:3001/api/uploads/qc-photo \
  -H "Content-Type: application/json" \
  -d '{"url": "/LIS/uploads/qc-photos/<uuid>.jpg"}'
```

Expected:
```json
{ "ok": true }
```

- [ ] **Step 4: Commit**

```bash
git add server/index.js vite.config.ts
git commit -m "feat: wire uploads route, static serve, and Vite proxy for QC photos"
```

---

## Task 4: Frontend — Update api.ts (type + upload/delete functions)

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add `maxPhotos` to `ParameterValueField` type**

Find the `ParameterValueField` type definition (around line 255) and add `maxPhotos`:

```ts
export type ParameterValueField = {
  label: string;
  type: ParameterValueFieldType;
  unit?: string;
  standardValue?: number | null;
  standardOperator?: StandardOperator;
  standardValue2?: number | null;
  options?: string[];
  requireNoteOn?: string[];
  expectedValues?: string[];
  timerDurationSec?: number | null;
  timerUnit?: TimerUnit;
  required?: boolean;
  maxPhotos?: number;      // ← add this line
};
```

- [ ] **Step 2: Add `uploadQcPhoto` and `deleteQcPhoto` named exports at the bottom of `src/lib/api.ts`**

Add these two functions after the `export const api = { ... }` block:

```ts
export async function uploadQcPhoto(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch(`${APP_API_BASE}/uploads/qc-photo`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as any).error || 'Upload failed');
  }
  return res.json();
}

export async function deleteQcPhoto(url: string): Promise<void> {
  const res = await fetch(`${APP_API_BASE}/uploads/qc-photo`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as any).error || 'Delete failed');
  }
}
```

> Note: `APP_API_BASE` is already defined as a module-level `const` in `api.ts`. These functions can reference it directly since they're in the same file.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors related to the new fields/functions.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(frontend): add maxPhotos type + uploadQcPhoto/deleteQcPhoto to api.ts"
```

---

## Task 5: Frontend — ParameterSettings.tsx — maxPhotos input

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Add `maxPhotos` to `emptyValueField()`**

Find `emptyValueField` (around line 174) and add `maxPhotos`:

```ts
const emptyValueField = (): ParameterValueField => ({
  label: "",
  type: "text",
  unit: "",
  standardValue: null,
  standardOperator: undefined,
  standardValue2: null,
  options: [],
  requireNoteOn: [],
  expectedValues: [],
  timerDurationSec: null,
  timerUnit: undefined,
  required: false,
  maxPhotos: 5,       // ← add this line
});
```

- [ ] **Step 2: Reset `maxPhotos` when changing away from `photo` type**

Find the `onValueChange` handler for the type `<Select>` (around line 798–811) and add `maxPhotos` reset alongside the other resets:

```ts
onValueChange={(v) =>
  onChange({
    ...field,
    type: v as ParameterValueFieldType,
    unit: v === "number" || v === "float" ? field.unit ?? "" : "",
    options: v === "enum" ? field.options ?? [] : [],
    requireNoteOn: v === "enum" ? field.requireNoteOn ?? [] : [],
    expectedValues: v === "enum" ? field.expectedValues ?? [] : [],
    standardValue: v === "number" || v === "float" ? field.standardValue : null,
    standardOperator: v === "number" || v === "float" ? field.standardOperator : undefined,
    standardValue2: v === "number" || v === "float" ? field.standardValue2 ?? null : null,
    timerDurationSec: v === "timer" ? field.timerDurationSec ?? null : null,
    timerUnit: v === "timer" ? field.timerUnit : undefined,
    maxPhotos: v === "photo" ? (field.maxPhotos ?? 5) : undefined,   // ← add this
  })
}
```

- [ ] **Step 3: Add maxPhotos input block after the `timer` block**

Find the `{field.type === "timer" ? (...)  : null}` block (around line 1041) and add a sibling block directly after `</div>` for the timer block closure (`} : null}`):

```tsx
{field.type === "photo" ? (
  <div className="space-y-1.5">
    <Label className="text-sm">จำนวนภาพสูงสุด *</Label>
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        max={20}
        value={field.maxPhotos ?? 5}
        onChange={(e) => {
          const n = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
          onChange({ ...field, maxPhotos: n });
        }}
        className="h-10 w-24"
      />
      <span className="text-sm text-grey-500">ภาพ (สูงสุด 20)</span>
    </div>
  </div>
) : null}
```

Place it after the closing `} : null}` of the timer block and before the outermost closing `</div>` of the field editor card.

- [ ] **Step 4: Run dev server and manually verify**

```bash
npm run dev
```

1. Open Parameter Settings
2. Add a new field with type = "ภาพถ่าย (Photo)"
3. Confirm "จำนวนภาพสูงสุด" input appears with value 5
4. Change to a different type — confirm the input disappears
5. Change back to photo — confirm it reappears with value 5

- [ ] **Step 5: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(frontend): add maxPhotos config input in ParameterSettings for photo fields"
```

---

## Task 6: Frontend — Create PhotoField component

**Files:**
- Create: `src/components/lis/PhotoField.tsx`

- [ ] **Step 1: Create `src/components/lis/PhotoField.tsx`**

```tsx
import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadQcPhoto, deleteQcPhoto, type ParameterValueField } from '@/lib/api';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface PhotoFieldProps {
  field: ParameterValueField;
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function PhotoField({ field, value, onChange, disabled = false }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const maxPhotos = field.maxPhotos ?? 5;
  const canAdd = !disabled && value.length < maxPhotos;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    try {
      const { url } = await uploadQcPhoto(file);
      onChange([...value, url]);
    } catch (err: any) {
      toast.error(err.message || 'อัปโหลดล้มเหลว');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(url: string) {
    try {
      await deleteQcPhoto(url);
      onChange(value.filter((u) => u !== url));
    } catch (err: any) {
      toast.error(err.message || 'ลบไม่สำเร็จ');
    }
  }

  return (
    <div className="space-y-2">
      {/* Thumbnail grid */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url) => (
            <div key={url} className="relative group">
              <button
                type="button"
                onClick={() => setLightbox(url)}
                className="block w-20 h-20 rounded-md overflow-hidden border border-grey-200 bg-grey-50 hover:border-pink-300 transition-colors"
              >
                <img
                  src={url}
                  alt="QC photo"
                  className="w-full h-full object-cover"
                />
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(url)}
                  className={cn(
                    'absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5',
                    'flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
                    'hover:bg-red-600',
                  )}
                  title="ลบภาพ"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {canAdd && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-dashed',
            'border-pink-300 text-pink-600 bg-pink-50 hover:bg-pink-100 transition-colors',
            uploading && 'opacity-60 cursor-not-allowed',
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {uploading ? 'กำลังอัปโหลด...' : 'เพิ่มภาพ'}
          {!uploading && (
            <span className="text-pink-400 text-xs">
              ({value.length}/{maxPhotos})
            </span>
          )}
        </button>
      )}

      {/* Count display when at max */}
      {!canAdd && !disabled && (
        <p className="text-xs text-grey-400">ครบ {maxPhotos} ภาพแล้ว</p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-0">
          {lightbox && (
            <img
              src={lightbox}
              alt="QC photo full"
              className="w-full max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in `PhotoField.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/PhotoField.tsx
git commit -m "feat(frontend): add PhotoField component with upload, delete, and lightbox"
```

---

## Task 7: Frontend — Wire PhotoField into QCTestingDetailPage

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

- [ ] **Step 1: Add import for PhotoField**

At the top of `src/pages/QCTestingDetailPage.tsx`, alongside the existing `TimerField` import:

```ts
// existing:
import { TimerField } from '@/components/lis/TimerField';
// add:
import { PhotoField } from '@/components/lis/PhotoField';
```

- [ ] **Step 2: Replace the placeholder in `TestField`**

Find (around line 158–159):

```tsx
      ) : field.type === 'photo' ? (
        <div className="text-xs text-grey-400 italic py-1">แนบรูปภาพ (ยังไม่รองรับในเวอร์ชันนี้)</div>
      ) : (
```

Replace with:

```tsx
      ) : field.type === 'photo' ? (
        <PhotoField
          field={field}
          value={Array.isArray(value) ? value as string[] : []}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(frontend): wire PhotoField into QCTestingDetailPage, replacing placeholder"
```

---

## Task 8: End-to-end manual test

- [ ] **Step 1: Start dev server and backend**

Terminal 1 (backend):
```bash
cd server && node index.js
```

Terminal 2 (frontend):
```bash
npm run dev
```

- [ ] **Step 2: Configure a photo field in Parameter Settings**

1. Open `http://localhost:8000/LIS/parameter-settings`
2. Create or edit a parameter
3. Add a value field: label = "ภาพทดสอบ", type = "ภาพถ่าย (Photo)", maxPhotos = 3
4. Save the parameter

- [ ] **Step 3: Use the photo field in a QC test**

1. Open a QC test petition that uses the configured parameter
2. Find the "ภาพทดสอบ" field — confirm it shows "เพิ่มภาพ (0/3)" button instead of the old placeholder
3. Click "เพิ่มภาพ" → select a JPEG/PNG file
4. Confirm the thumbnail appears and the count increments to `1/3`
5. Click the thumbnail → confirm lightbox opens with the full image
6. Add 2 more photos → confirm button changes to "ครบ 3 ภาพแล้ว"
7. Hover a thumbnail → click `×` → confirm the photo is removed
8. Reload the page → confirm photos persist (fetched from DB as saved URLs)

- [ ] **Step 4: Verify file on disk**

```bash
ls server/uploads/qc-photos/
```

Expected: UUID-named files for the uploaded photos.

- [ ] **Step 5: Type mismatch guard — confirm photo value stored correctly**

In browser DevTools → Network tab → filter for `qc-results`:
- PUT body should show `"value": ["/LIS/uploads/qc-photos/uuid.jpg", ...]` for the photo field

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Data model (maxPhotos on field, URLs array in values) → Tasks 1, 4
  - Backend upload/delete endpoints → Task 2
  - Static serve + Vite proxy → Task 3
  - ParameterSettings maxPhotos input → Task 5
  - PhotoField component (add, delete, lightbox, disabled mode) → Task 6
  - QCTestingDetailPage integration → Task 7
- [x] **No placeholders:** All steps contain actual code
- [x] **Type consistency:** `ParameterValueField.maxPhotos?: number` defined in Task 4, used as `field.maxPhotos ?? 5` in Tasks 5 and 6. `uploadQcPhoto`/`deleteQcPhoto` defined in Task 4, imported in Task 6.
- [x] **Path traversal guard in uploads.js:** `path.basename` + prefix check in DELETE handler
- [x] **`disabled` mode in PhotoField:** No add/delete buttons shown
