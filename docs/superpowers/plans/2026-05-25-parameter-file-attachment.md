# Parameter File Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `file` value-field type to the Parameter system so lab staff can configure a parameter that requires document attachments (PDF, Excel, Word, CSV).

**Architecture:** Mirror the existing `photo` type pattern — add `'file'` to the Mongoose enum, add `maxFiles`/`allowedFileTypes` fields to the schema, add a new multer route for document uploads, extend the TypeScript types, and wire up the settings UI editor. No changes to `server/index.js` or `vite.config.ts` — static serving at `/LIS/uploads/` and the Vite proxy already cover any new subdirectory.

**Tech Stack:** Node.js + Express + Multer + Mongoose (backend); React 18 + TypeScript + shadcn/ui (frontend); `src/lib/api.ts` as the API boundary.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `server/models/Parameter.js` | Modify | Add `'file'` to type enum; add `maxFiles`, `allowedFileTypes` fields |
| `server/routes/uploads.js` | Modify | Add param-files dir, doc multer config, POST/DELETE `/param-file` routes |
| `src/lib/api.ts` | Modify | Add `'file'` to type union; add fields to `ParameterValueField`; add `uploadParamFile`/`deleteParamFile` |
| `src/pages/ParameterSettings.tsx` | Modify | Add `file` type option, meta, editor UI, summary, validation |

---

## Task 1: Backend — Parameter Schema

**Files:**
- Modify: `server/models/Parameter.js`

- [ ] **Step 1: Add `'file'` to the type enum and add new fields**

  Open `server/models/Parameter.js`. Make these three edits:

  **Edit 1** — extend the type enum on line 5 (add `'file'`):
  ```js
  type: { type: String, enum: ['text', 'number', 'float', 'enum', 'photo', 'file', 'timer'], required: true },
  ```
  > Note: `'timer'` was missing from the enum despite being handled in the pre-validate hook and supported in the frontend. This fixes that latent bug.

  **Edit 2** — add the two new fields after the `maxPhotos` line (currently line 26):
  ```js
  maxFiles: { type: Number, default: 5, min: 1, max: 20 },
  allowedFileTypes: { type: [String], default: ['pdf'] },
  ```

  The `ValueFieldSchema` block should now look like:
  ```js
  const ValueFieldSchema = new mongoose.Schema({
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'number', 'float', 'enum', 'photo', 'file', 'timer'], required: true },
    unit: { type: String, default: '' },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    options: { type: [String], default: [] },
    requireNoteOn: { type: [String], default: [] },
    expectedValues: { type: [String], default: [] },
    standardValue: { type: Number, default: null },
    standardOperator: {
      type: String,
      enum: ['lt', 'lte', 'eq', 'gte', 'gt', 'between', 'tolerance', null],
      default: null,
    },
    standardValue2: { type: Number, default: null },
    timerDurationSec: { type: Number, default: null },
    timerUnit: {
      type: String,
      enum: ['minute', 'hour', 'day', 'month', null],
      default: null,
    },
    required: { type: Boolean, default: false },
    maxPhotos: { type: Number, default: 5, min: 1, max: 20 },
    maxFiles: { type: Number, default: 5, min: 1, max: 20 },
    allowedFileTypes: { type: [String], default: ['pdf'] },
  }, { _id: false });
  ```

- [ ] **Step 2: Verify server starts without error**

  ```bash
  cd server && node -e "require('./models/Parameter')" && echo "OK"
  ```
  Expected: `OK` with no error output.

- [ ] **Step 3: Commit**

  ```bash
  git add server/models/Parameter.js
  git commit -m "feat(schema): add file type, maxFiles, allowedFileTypes to ValueFieldSchema"
  ```

---

## Task 2: Backend — Upload Route for Documents

**Files:**
- Modify: `server/routes/uploads.js`

- [ ] **Step 1: Add the param-files directory, MIME map, and multer config**

  After the existing `ALLOWED_MIME` constant (line 11), insert:
  ```js
  const PARAM_FILES_DIR = path.join(__dirname, '..', 'uploads', 'param-files');
  fs.mkdirSync(PARAM_FILES_DIR, { recursive: true });

  const ALLOWED_DOC_MIME = new Set([
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'text/plain',
  ]);

  const DOC_MIME_EXT = {
    'application/pdf': '.pdf',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/csv': '.csv',
    'text/plain': '.txt',
  };

  const paramFileStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PARAM_FILES_DIR),
    filename: (_req, file, cb) => {
      const ext = DOC_MIME_EXT[file.mimetype] || '.bin';
      cb(null, `${randomUUID()}${ext}`);
    },
  });

  const uploadParamFileMiddleware = multer({
    storage: paramFileStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_DOC_MIME.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('ประเภทไฟล์ไม่รองรับ: รับเฉพาะ PDF, Excel, Word, CSV'));
      }
    },
  });
  ```

- [ ] **Step 2: Add POST and DELETE routes**

  Before the existing multer error handler (the `router.use(...)` at the bottom), insert:
  ```js
  // POST /api/uploads/param-file
  // Body: multipart/form-data with field "file"
  // Returns: { url: "/LIS/uploads/param-files/<filename>", name: <original>, size: <bytes> }
  router.post('/param-file', uploadParamFileMiddleware.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'ไม่พบไฟล์' });
    }
    const url = `/LIS/uploads/param-files/${req.file.filename}`;
    res.json({ url, name: req.file.originalname, size: req.file.size });
  });

  // DELETE /api/uploads/param-file
  // Body: { url: "/LIS/uploads/param-files/<filename>" }
  router.delete('/param-file', (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
    }
    const filename = path.basename(url);
    if (filename.includes('/') || filename.includes('\\') || filename !== path.basename(filename)) {
      return res.status(400).json({ error: 'Invalid url' });
    }
    const filePath = path.join(PARAM_FILES_DIR, filename);
    if (!filePath.startsWith(PARAM_FILES_DIR + path.sep) && filePath !== PARAM_FILES_DIR) {
      return res.status(400).json({ error: 'Invalid url' });
    }
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true });
    });
  });
  ```

- [ ] **Step 3: Verify the server starts and routes exist**

  Start the backend server (if not already running):
  ```bash
  cd server && node index.js
  ```
  In a separate terminal, test with a real PDF file (replace the path):
  ```bash
  curl -s -o - -w "\n%{http_code}" \
    -X POST http://localhost:3001/LIS/api/uploads/param-file \
    -F "file=@C:/Windows/System32/cmd.exe"
  ```
  Expected: `{"error":"ประเภทไฟล์ไม่รองรับ..."}` with status 400 (blocked non-document).

  If you have a PDF handy:
  ```bash
  curl -s -o - -w "\n%{http_code}" \
    -X POST http://localhost:3001/LIS/api/uploads/param-file \
    -F "file=@/path/to/any.pdf"
  ```
  Expected: `{"url":"/LIS/uploads/param-files/<uuid>.pdf","name":"any.pdf","size":<N>}` with 200.

- [ ] **Step 4: Commit**

  ```bash
  git add server/routes/uploads.js
  git commit -m "feat(uploads): add POST/DELETE /param-file route for document attachments"
  ```

---

## Task 3: Frontend — API Types and Functions

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add `'file'` to the type union**

  Find the line:
  ```ts
  export type ParameterValueFieldType = "text" | "number" | "float" | "enum" | "photo" | "timer";
  ```
  Change to:
  ```ts
  export type ParameterValueFieldType = "text" | "number" | "float" | "enum" | "photo" | "file" | "timer";
  ```

- [ ] **Step 2: Add fields to `ParameterValueField`**

  Find the `ParameterValueField` type (after `TimerUnit`). After the `maxPhotos?: number;` line, add:
  ```ts
  maxFiles?: number;
  allowedFileTypes?: string[];
  ```

- [ ] **Step 3: Add `uploadParamFile` and `deleteParamFile` functions**

  After the closing brace of `deleteQcPhoto`, add:
  ```ts
  export async function uploadParamFile(file: File): Promise<{ url: string; name: string; size: number }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${APP_API_BASE}/uploads/param-file`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText })) as any;
      const message = body?.error || body?.message || res.statusText;
      throw new Error(String(message));
    }
    return res.json();
  }

  export async function deleteParamFile(url: string): Promise<void> {
    const res = await fetch(`${APP_API_BASE}/uploads/param-file`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText })) as any;
      const message = body?.error || body?.message || res.statusText;
      throw new Error(String(message));
    }
  }
  ```

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/api.ts
  git commit -m "feat(api): add file type, maxFiles/allowedFileTypes fields, uploadParamFile/deleteParamFile"
  ```

---

## Task 4: Frontend — Settings UI

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

### 4a: Imports + constants

- [ ] **Step 1: Import `Paperclip` from lucide-react**

  Find the lucide-react import block at the top of the file. Add `Paperclip` to it:
  ```tsx
  import {
    AlertCircle,
    Check,
    ChevronDown,
    ChevronUp,
    GripVertical,
    Hash,
    Image as ImageIcon,
    List as ListIcon,
    Paperclip,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    SlidersHorizontal,
    Timer as TimerIcon,
    Trash2,
    Type as TypeIcon,
    X,
  } from "lucide-react";
  ```

- [ ] **Step 2: Add `FILE_TYPE_OPTIONS` constant**

  After the `OPERATOR_OPTIONS` array, add:
  ```ts
  const FILE_TYPE_OPTIONS: { value: string; label: string; accept: string }[] = [
    { value: 'pdf',   label: 'PDF',   accept: 'application/pdf' },
    { value: 'excel', label: 'Excel', accept: '.xls,.xlsx' },
    { value: 'word',  label: 'Word',  accept: '.doc,.docx' },
    { value: 'csv',   label: 'CSV',   accept: '.csv' },
  ];
  ```

- [ ] **Step 3: Add `file` to `VALUE_TYPE_OPTIONS`**

  Find `VALUE_TYPE_OPTIONS`. Add the file entry after `photo`:
  ```ts
  const VALUE_TYPE_OPTIONS: { value: ParameterValueFieldType; label: string }[] = [
    { value: "text",  label: "ข้อความ (Text)" },
    { value: "number", label: "จำนวนเต็ม (Number)" },
    { value: "float", label: "ทศนิยม (Float)" },
    { value: "enum",  label: "ตัวเลือก (Enum)" },
    { value: "photo", label: "ภาพถ่าย (Photo)" },
    { value: "file",  label: "แนบไฟล์ (File)" },
    { value: "timer", label: "จับเวลา (Timer)" },
  ];
  ```

- [ ] **Step 4: Add `file` to `FIELD_TYPE_META`**

  Find `FIELD_TYPE_META`. Add the `file` entry after `photo`:
  ```ts
  file: {
    label: "แนบไฟล์",
    Icon: Paperclip,
    accent: "bg-teal-500",
    tint: "bg-teal-50/50",
    text: "text-teal-700",
    iconText: "text-teal-500",
  },
  ```

  The complete record will include: `text`, `number`, `float`, `enum`, `timer`, `photo`, `file`.

### 4b: Default value and summary

- [ ] **Step 5: Add defaults to `emptyValueField()`**

  Find `emptyValueField`. Add `maxFiles` and `allowedFileTypes` to the returned object:
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
    maxFiles: 5,
    allowedFileTypes: ['pdf'],
  });
  ```

- [ ] **Step 6: Add `case "file"` to `summarizeField`**

  Find `summarizeField`. After the `case "photo"` line, add:
  ```ts
  case "file": {
    const types = (field.allowedFileTypes ?? ['pdf'])
      .map((t) => t.toUpperCase())
      .join(', ');
    return `${types} (สูงสุด ${field.maxFiles ?? 5} ไฟล์)`;
  }
  ```

### 4c: Editor — type reset and file UI section

- [ ] **Step 7: Add file field resets in the type `Select` `onValueChange` handler**

  Find the `onValueChange` inside `ValueFieldEditor`'s `<Select>` for the type field. Add two lines to the spread — `maxFiles` and `allowedFileTypes` — so switching away from `file` preserves the values (no data loss on accidental type change):
  ```tsx
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
      maxFiles: v === "file" ? (field.maxFiles ?? 5) : field.maxFiles,
      allowedFileTypes: v === "file"
        ? (field.allowedFileTypes?.length ? field.allowedFileTypes : ['pdf'])
        : field.allowedFileTypes,
    })
  }
  ```

- [ ] **Step 8: Add the file editor section in `ValueFieldEditor`**

  In `ValueFieldEditor`'s expanded body, after the `{field.type === "timer" ? ... : null}` block, add:
  ```tsx
  {field.type === "file" ? (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-sm">จำนวนไฟล์สูงสุด (1–20)</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={field.maxFiles ?? 5}
          onChange={(e) => {
            const v = Math.min(20, Math.max(1, Number(e.target.value) || 1));
            onChange({ ...field, maxFiles: v });
          }}
          className="h-10 w-28"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">ประเภทไฟล์ที่รับได้ *</Label>
        <div className="flex flex-wrap gap-4">
          {FILE_TYPE_OPTIONS.map((opt) => {
            const checked = (field.allowedFileTypes ?? []).includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-1.5 text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const current = field.allowedFileTypes ?? [];
                    const next = v
                      ? [...current, opt.value]
                      : current.filter((t) => t !== opt.value);
                    onChange({ ...field, allowedFileTypes: next });
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        {(field.allowedFileTypes ?? []).length === 0 ? (
          <p className="text-xs text-destructive">ต้องเลือกอย่างน้อย 1 ประเภท</p>
        ) : null}
      </div>
    </div>
  ) : null}
  ```

### 4d: Validation and badges

- [ ] **Step 9: Add `file` validation in `validate()`**

  Inside `ParameterDialog`'s `validate()` function, after the `timer` validation block, add:
  ```ts
  if (f.type === "file") {
    if (!f.allowedFileTypes || f.allowedFileTypes.length === 0) {
      return `ช่อง "${f.label}": ต้องเลือกประเภทไฟล์อย่างน้อย 1 ชนิด`;
    }
  }
  ```

- [ ] **Step 10: Add `file` detail in `ValueFieldBadges`**

  Find `ValueFieldBadges`. Update the `detail` variable to handle `file`:
  ```tsx
  const detail =
    f.type === "enum"
      ? ` (${(f.options ?? []).slice(0, 3).join("/")}${
          (f.options?.length ?? 0) > 3 ? "..." : ""
        })`
      : f.type === "number" || f.type === "float"
        ? f.unit
          ? ` [${f.unit}]`
          : ""
        : f.type === "file"
          ? f.allowedFileTypes?.length
            ? ` [${f.allowedFileTypes.map((t) => t.toUpperCase()).join("/")}]`
            : ""
          : "";
  ```

- [ ] **Step 11: Type-check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 12: Manual smoke test**

  Start the dev server (`npm run dev`) and open the app in the browser. Navigate to **พารามิเตอร์การตรวจสอบ** → **เพิ่มพารามิเตอร์**.

  Verify:
  1. "ชนิดข้อมูล" dropdown shows **แนบไฟล์ (File)** as an option
  2. Selecting it shows "จำนวนไฟล์สูงสุด" input and four checkboxes (PDF ✓, Excel, Word, CSV)
  3. Unchecking all shows the red "ต้องเลือกอย่างน้อย 1 ประเภท" message
  4. Trying to save with no type selected shows the toast error
  5. Filling in a name, checking PDF only, and saving creates a parameter successfully
  6. The parameter list shows the badge `· file [PDF]`
  7. Switching type away from `file` and back preserves the maxFiles/allowedFileTypes values

- [ ] **Step 13: Commit**

  ```bash
  git add src/pages/ParameterSettings.tsx
  git commit -m "feat(ui): add file attachment type to Parameter settings editor"
  ```

---

## Self-Review Checklist

- [x] **Schema** — `'file'` in enum, `maxFiles`, `allowedFileTypes` fields: Task 1
- [x] **Backend routes** POST + DELETE `/param-file`: Task 2
- [x] **`uploadParamFile` / `deleteParamFile` exported from api.ts**: Task 3
- [x] **`ParameterValueFieldType` includes `'file'`**: Task 3, Step 1
- [x] **`ParameterValueField` has `maxFiles` and `allowedFileTypes`**: Task 3, Step 2
- [x] **Settings dropdown includes file option**: Task 4, Step 3
- [x] **FIELD_TYPE_META includes file with Paperclip icon**: Task 4, Step 4
- [x] **emptyValueField defaults**: Task 4, Step 5
- [x] **summarizeField handles file**: Task 4, Step 6
- [x] **Type-change Select resets correctly**: Task 4, Step 7
- [x] **File editor UI (maxFiles + checkboxes)**: Task 4, Step 8
- [x] **Validation**: Task 4, Step 9
- [x] **ValueFieldBadges**: Task 4, Step 10
- [x] **No placeholders or TBDs**: confirmed
- [x] **Type consistency**: `allowedFileTypes: string[]` and `maxFiles: number` used consistently across all tasks
