# Standard Config (Redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the over-engineered Standard Config (override + auto-sync + 2 tabs) with a single-page form that records, per keyword-in-commonName, how many times a standard is used on GC and HPLC.

**Architecture:** One Mongo collection `StandardConfig` (keyword + keywordLower + gcTimes + hplcTimes + note). Plain CRUD REST route (no sync). One self-contained React page: searchable table + add/edit dialog with a keyword combobox (free-type or pick from master commonNames). Stock deduction + run-time matching are deferred to Phase 2.

**Tech Stack:** Node/Express + Mongoose (CommonJS server), React 18 + TypeScript + TanStack Query + shadcn/ui, Vitest (frontend only — `vitest.config` includes `src/**` only).

**Spec:** `docs/superpowers/specs/2026-05-29-standard-config-design.md`

**Conventions to follow:**
- Server routes mirror `server/routes/simpleMethods.js` (try/catch per handler, `{ message, field }` errors).
- No in-page permission gating (matches `ParameterSettings.tsx`); `PrivateRoute` already gates `/standard-config`.
- Type-check with `npx tsc --noEmit` (do **not** run `npm run build`). Run tests with `npx vitest run <file>`.

---

## File Structure

**Create:**
- `src/lib/standardConfig.ts` — shared type `StandardConfigDoc` + pure validation/normalize helpers.
- `src/lib/standardConfig.test.ts` — unit tests for the helpers.
- `src/pages/__tests__/StandardConfig.test.tsx` — component test for the page.

**Rewrite:**
- `server/models/StandardConfig.js`
- `server/routes/standardConfigs.js`
- `src/pages/StandardConfig.tsx`
- `src/lib/api.ts` (standard-config section)

**Modify:**
- `server/index.js` (remove `/standard-overrides` mount)

**Delete:**
- `server/models/StandardOverride.js`
- `server/routes/standardOverrides.js`
- `server/utils/substances.js` (after confirming no other requirer)
- `src/pages/standardConfig/` (whole folder: `OverridesTab.tsx`, `SubstancesTab.tsx`, `SlotEditor.tsx` if present, `types.ts`)
- `src/lib/resolveStandardConfig.ts`
- `src/lib/resolveStandardConfig.test.ts`

**Keep untouched:**
- `src/lib/substances.ts` (+ `src/lib/substances.test.ts`) — used by `MasterItems.tsx` + `PetitionAssignPage.tsx`.
- `src/App.tsx` route + `src/lib/navItems.ts` entry for `/standard-config` (already present).

---

## Task 1: Frontend type + validation helpers (TDD)

**Files:**
- Create: `src/lib/standardConfig.ts`
- Test: `src/lib/standardConfig.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/standardConfig.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeTimes,
  validateStandardConfigInput,
  MAX_KEYWORD_LEN,
  MAX_TIMES,
} from "./standardConfig";

describe("normalizeTimes", () => {
  it("maps empty/null/undefined to null", () => {
    expect(normalizeTimes("")).toBeNull();
    expect(normalizeTimes(null)).toBeNull();
    expect(normalizeTimes(undefined)).toBeNull();
  });
  it("parses numeric strings and numbers", () => {
    expect(normalizeTimes("3")).toBe(3);
    expect(normalizeTimes(5)).toBe(5);
    expect(normalizeTimes(0)).toBe(0);
  });
  it("maps non-numeric to null", () => {
    expect(normalizeTimes("abc")).toBeNull();
  });
});

describe("validateStandardConfigInput", () => {
  const ok = { keyword: "ANILOFOS", gcTimes: 3, hplcTimes: null, note: "" };

  it("accepts a valid input", () => {
    expect(validateStandardConfigInput(ok)).toBeNull();
  });
  it("rejects empty keyword", () => {
    expect(validateStandardConfigInput({ ...ok, keyword: "  " })?.field).toBe("keyword");
  });
  it("rejects keyword over max length", () => {
    const long = "x".repeat(MAX_KEYWORD_LEN + 1);
    expect(validateStandardConfigInput({ ...ok, keyword: long })?.field).toBe("keyword");
  });
  it("rejects negative times", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: -1 })?.field).toBe("gcTimes");
  });
  it("rejects decimal times", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: 1.5 })?.field).toBe("gcTimes");
  });
  it("rejects times over max", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: MAX_TIMES + 1 })?.field).toBe("gcTimes");
  });
  it("rejects when neither GC nor HPLC > 0", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: 0, hplcTimes: null })?.field).toBe("gcTimes");
  });
  it("accepts HPLC-only", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: null, hplcTimes: 2 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/standardConfig.test.ts`
Expected: FAIL — `Failed to resolve import "./standardConfig"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/standardConfig.ts`:

```ts
export type StandardConfigDoc = {
  _id: string;
  keyword: string;
  keywordLower: string;
  gcTimes: number | null;
  hplcTimes: number | null;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StandardConfigInput = {
  keyword: string;
  gcTimes: number | null;
  hplcTimes: number | null;
  note?: string;
};

export type ValidationError = { field: string; message: string };

export const MAX_KEYWORD_LEN = 200;
export const MAX_TIMES = 100000;

/** Parse a raw times input (string | number | null) → integer-or-null. Non-numeric → null. */
export function normalizeTimes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function validateStandardConfigInput(input: StandardConfigInput): ValidationError | null {
  const keyword = String(input.keyword ?? "").trim();
  if (!keyword) return { field: "keyword", message: "กรุณากรอก keyword" };
  if (keyword.length > MAX_KEYWORD_LEN) {
    return { field: "keyword", message: `keyword ยาวเกิน ${MAX_KEYWORD_LEN} ตัว` };
  }
  const checks: Array<["gcTimes" | "hplcTimes", number | null]> = [
    ["gcTimes", input.gcTimes],
    ["hplcTimes", input.hplcTimes],
  ];
  for (const [field, val] of checks) {
    if (val === null || val === undefined) continue;
    if (!Number.isInteger(val) || val < 0 || val > MAX_TIMES) {
      return { field, message: `จำนวนครั้งต้องเป็นจำนวนเต็ม 0–${MAX_TIMES}` };
    }
  }
  const gc = input.gcTimes ?? 0;
  const hplc = input.hplcTimes ?? 0;
  if (gc <= 0 && hplc <= 0) {
    return { field: "gcTimes", message: "ต้องกรอกจำนวนครั้งอย่างน้อย 1 เครื่อง (GC หรือ HPLC)" };
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/standardConfig.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/standardConfig.ts src/lib/standardConfig.test.ts
git commit -m "feat(standard-config): add type + validation helpers"
```

---

## Task 2: Rewrite server model

**Files:**
- Rewrite: `server/models/StandardConfig.js`

- [ ] **Step 1: Replace the file contents**

Overwrite `server/models/StandardConfig.js` with:

```js
const mongoose = require('mongoose');

const StandardConfigSchema = new mongoose.Schema(
  {
    // keyword matched (contains, case-insensitive) against a product's commonName
    keyword: { type: String, required: true, trim: true },
    keywordLower: { type: String, required: true, unique: true, index: true },
    // how many times a standard is normally used on each instrument (null = not used)
    gcTimes: { type: Number, default: null },
    hplcTimes: { type: Number, default: null },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('StandardConfig', StandardConfigSchema);
```

- [ ] **Step 2: Verify it loads without error**

Run: `node -e "require('./server/models/StandardConfig'); console.log('ok')"`
Expected: prints `ok` (no schema/syntax error).

- [ ] **Step 3: Commit**

```bash
git add server/models/StandardConfig.js
git commit -m "feat(standard-config): rewrite model — keyword + times schema"
```

---

## Task 3: Rewrite server route (CRUD, no sync)

**Files:**
- Rewrite: `server/routes/standardConfigs.js`

- [ ] **Step 1: Replace the file contents**

Overwrite `server/routes/standardConfigs.js` with:

```js
const express = require('express');
const StandardConfig = require('../models/StandardConfig');

const router = express.Router();

const MAX_KEYWORD_LEN = 200;
const MAX_TIMES = 100000;

function validateTimes(value, field) {
  if (value === null || value === undefined || value === '') return { ok: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_TIMES) {
    return { error: { message: `${field} ต้องเป็นจำนวนเต็ม 0–${MAX_TIMES}`, field } };
  }
  return { ok: n };
}

// Returns { value } on success or { error: { message, field } } on failure.
function buildBody(body) {
  const keyword = String((body && body.keyword) || '').trim();
  if (!keyword) return { error: { message: 'keyword required', field: 'keyword' } };
  if (keyword.length > MAX_KEYWORD_LEN) {
    return { error: { message: `keyword too long (max ${MAX_KEYWORD_LEN})`, field: 'keyword' } };
  }
  const gc = validateTimes(body && body.gcTimes, 'gcTimes');
  if (gc.error) return { error: gc.error };
  const hplc = validateTimes(body && body.hplcTimes, 'hplcTimes');
  if (hplc.error) return { error: hplc.error };
  if ((gc.ok || 0) <= 0 && (hplc.ok || 0) <= 0) {
    return { error: { message: 'ต้องมีจำนวนครั้งอย่างน้อย 1 เครื่อง', field: 'gcTimes' } };
  }
  return {
    value: {
      keyword,
      keywordLower: keyword.toLowerCase(),
      gcTimes: gc.ok,
      hplcTimes: hplc.ok,
      note: String((body && body.note) || '').trim(),
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    const docs = await StandardConfig.find().sort({ keywordLower: 1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const built = buildBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const existing = await StandardConfig.findOne({ keywordLower: built.value.keywordLower }).lean();
    if (existing) return res.status(409).json({ message: 'keyword นี้มีอยู่แล้ว', field: 'keyword' });
    const doc = await StandardConfig.create(built.value);
    res.status(201).json(doc.toObject());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const built = buildBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const clash = await StandardConfig.findOne({
      keywordLower: built.value.keywordLower,
      _id: { $ne: id },
    }).lean();
    if (clash) return res.status(409).json({ message: 'keyword นี้มีอยู่แล้ว', field: 'keyword' });
    const doc = await StandardConfig.findByIdAndUpdate(id, { $set: built.value }, { new: true }).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await StandardConfig.findByIdAndDelete(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Verify it loads without error**

Run: `node -e "require('./server/routes/standardConfigs'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add server/routes/standardConfigs.js
git commit -m "feat(standard-config): rewrite route — CRUD only, drop sync"
```

---

## Task 4: Remove StandardOverride + dead server util

**Files:**
- Delete: `server/models/StandardOverride.js`, `server/routes/standardOverrides.js`, `server/utils/substances.js`
- Modify: `server/index.js`

- [ ] **Step 1: Confirm `server/utils/substances.js` has no remaining requirer**

Use the Grep tool: pattern `utils/substances`, path `server`.
Expected: **no matches** after Task 3 (the only requirer was the old `standardConfigs.js`). If any match remains, stop and resolve before deleting.

- [ ] **Step 2: Remove the override mount in `server/index.js`**

Delete this line (currently at `server/index.js:39`):

```js
mountApi('/standard-overrides', require('./routes/standardOverrides'));
```

Leave the `/standard-configs` mount (line 38) intact.

- [ ] **Step 3: Delete the dead files**

```bash
git rm server/models/StandardOverride.js server/routes/standardOverrides.js server/utils/substances.js
```

- [ ] **Step 4: Verify the server module graph still resolves**

Run: `node -e "require('./server/routes/standardConfigs'); console.log('ok')"`
Expected: prints `ok` (no missing-module error from the deletions).

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "chore(standard-config): remove StandardOverride model/route + dead substances util"
```

---

## Task 5: Rewrite api.ts, the page, and delete old frontend files

> One commit so `tsc` stays green: the page stops importing the old tabs, `api.ts` stops importing the old types, and the orphaned files are removed together.

**Files:**
- Rewrite: `src/lib/api.ts` (standard-config section), `src/pages/StandardConfig.tsx`
- Delete: `src/pages/standardConfig/` (folder), `src/lib/resolveStandardConfig.ts`, `src/lib/resolveStandardConfig.test.ts`

- [ ] **Step 1: Update `src/lib/api.ts` imports**

At the top of `src/lib/api.ts`, the import block currently pulls from `@/pages/standardConfig/types`:

```ts
import {
  ...,
  StandardConfigDoc,
  StandardOverrideDoc,
  SyncResult,
  ...,
} from "@/pages/standardConfig/types";
```

Remove `StandardConfigDoc`, `StandardOverrideDoc`, and `SyncResult` from that import (and delete the whole import line if those were its only members). Then add near the other `@/lib` imports:

```ts
import type { StandardConfigDoc } from "@/lib/standardConfig";
```

(If `StandardConfigDoc` is referenced in a `type { ... }` re-export elsewhere in `api.ts`, point it at the new module too.)

- [ ] **Step 2: Replace the standard-config + standard-overrides API methods**

In `src/lib/api.ts`, replace the entire block from the `// Standard Config` comment through the end of the `deleteStandardOverride` method (currently lines ~265–289) with:

```ts
  // Standard Config
  getStandardConfigs: () => request<StandardConfigDoc[]>("/standard-configs"),
  createStandardConfig: (data: Partial<StandardConfigDoc>) =>
    request<StandardConfigDoc>("/standard-configs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStandardConfig: (id: string, data: Partial<StandardConfigDoc>) =>
    request<StandardConfigDoc>(`/standard-configs/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteStandardConfig: (id: string) =>
    request<{ ok: true }>(`/standard-configs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
```

(No `syncStandardConfigs`, no `*StandardOverride*` methods.)

- [ ] **Step 3: Rewrite `src/pages/StandardConfig.tsx`**

Overwrite `src/pages/StandardConfig.tsx` with:

```tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Pencil, Plus, Search, Trash2 } from "lucide-react";

import AppLayout from "@/components/lis/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import {
  normalizeTimes,
  validateStandardConfigInput,
  type StandardConfigDoc,
} from "@/lib/standardConfig";

const COMMON_NAME_KEYS = ["common_name", "commonname", "commonName"];

function pickCommonName(item: Record<string, unknown>): string {
  for (const k of COMMON_NAME_KEYS) {
    const v = item[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

type FormState = {
  id: string | null;
  keyword: string;
  gcTimes: string;
  hplcTimes: string;
  note: string;
};

const emptyForm: FormState = { id: null, keyword: "", gcTimes: "", hplcTimes: "", note: "" };

export default function StandardConfig() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const { data: configs = [], isLoading } = useQuery<StandardConfigDoc[]>({
    queryKey: ["standard-configs"],
    queryFn: () => api.getStandardConfigs(),
  });

  // Suggestions for the keyword combobox — distinct commonNames from master items.
  const { data: rawMaster } = useQuery<unknown>({
    queryKey: ["master-items"],
    queryFn: () => api.get<unknown>("/master-items"),
  });
  const commonNameSuggestions = useMemo(() => {
    const arr = Array.isArray(rawMaster)
      ? rawMaster
      : Array.isArray((rawMaster as { data?: unknown })?.data)
        ? ((rawMaster as { data: unknown[] }).data)
        : [];
    const set = new Set<string>();
    for (const it of arr as Record<string, unknown>[]) {
      const cn = pickCommonName(it);
      if (cn) set.add(cn);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rawMaster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return configs;
    return configs.filter((c) => c.keyword.toLowerCase().includes(q));
  }, [configs, search]);

  const saveMutation = useMutation({
    mutationFn: (payload: { id: string | null; data: Partial<StandardConfigDoc> }) =>
      payload.id
        ? api.updateStandardConfig(payload.id, payload.data)
        : api.createStandardConfig(payload.data),
    onSuccess: () => {
      toast.success("บันทึกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
      setForm(null);
      setFieldError(null);
    },
    onError: (err: Error & { field?: string }) => {
      if (err.field) setFieldError({ field: err.field, message: err.message });
      else toast.error(`บันทึกไม่สำเร็จ — ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStandardConfig(id),
    onSuccess: () => {
      toast.success("ลบแล้ว");
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
    },
    onError: (err: Error) => toast.error(`ลบไม่สำเร็จ — ${err.message}`),
  });

  const openAdd = () => {
    setFieldError(null);
    setForm({ ...emptyForm });
  };
  const openEdit = (c: StandardConfigDoc) => {
    setFieldError(null);
    setForm({
      id: c._id,
      keyword: c.keyword,
      gcTimes: c.gcTimes == null ? "" : String(c.gcTimes),
      hplcTimes: c.hplcTimes == null ? "" : String(c.hplcTimes),
      note: c.note ?? "",
    });
  };

  const submit = () => {
    if (!form) return;
    const input = {
      keyword: form.keyword,
      gcTimes: normalizeTimes(form.gcTimes),
      hplcTimes: normalizeTimes(form.hplcTimes),
      note: form.note,
    };
    const err = validateStandardConfigInput(input);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(null);
    saveMutation.mutate({ id: form.id, data: input });
  };

  return (
    <AppLayout title="Standard Config">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="w-6 h-6" />
            Standard Config
          </h1>
          <p className="text-sm text-muted-foreground">
            ตั้งค่าจำนวนครั้งที่ใช้ standard ต่อสาร (ใช้สำหรับตัดสต็อกในอนาคต)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา keyword..."
              className="pl-8"
            />
          </div>
          <Button onClick={openAdd} className="gap-1">
            <Plus className="h-4 w-4" /> เพิ่ม Standard
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword (ใน commonName)</TableHead>
                <TableHead className="w-28 text-right">GC</TableHead>
                <TableHead className="w-28 text-right">HPLC</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    กำลังโหลด...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    ยังไม่มีข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium">{c.keyword}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.gcTimes ? `${c.gcTimes} ครั้ง` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.hplcTimes ? `${c.hplcTimes} ครั้ง` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.note}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (window.confirm(`ลบ "${c.keyword}"?`)) deleteMutation.mutate(c._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "แก้ไข Standard" : "เพิ่ม Standard"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Keyword (ในชื่อ commonName) *</Label>
                <Input
                  list="standard-config-commonnames"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="พิมพ์ หรือเลือกจากรายการ — match แบบมีคำนี้อยู่ในชื่อ"
                />
                <datalist id="standard-config-commonnames">
                  {commonNameSuggestions.map((cn) => (
                    <option key={cn} value={cn} />
                  ))}
                </datalist>
                {fieldError?.field === "keyword" ? (
                  <p className="text-xs text-destructive">{fieldError.message}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">GC — จำนวนครั้ง</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={form.gcTimes}
                    onChange={(e) => setForm({ ...form, gcTimes: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">HPLC — จำนวนครั้ง</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={form.hplcTimes}
                    onChange={(e) => setForm({ ...form, hplcTimes: e.target.value })}
                  />
                </div>
              </div>
              {fieldError?.field === "gcTimes" || fieldError?.field === "hplcTimes" ? (
                <p className="text-xs text-destructive">{fieldError.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">อย่างน้อยต้องกรอก 1 เครื่อง</p>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm">หมายเหตุ</Label>
                <Input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="(ไม่บังคับ)"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              ยกเลิก
            </Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
```

- [ ] **Step 4: Delete the orphaned old files**

```bash
git rm -r src/pages/standardConfig
git rm src/lib/resolveStandardConfig.ts src/lib/resolveStandardConfig.test.ts
```

- [ ] **Step 5: Type-check the whole frontend**

Run: `npx tsc --noEmit`
Expected: no errors. (Common gotchas: a leftover import of `SyncResult`/`StandardOverrideDoc`/`@/pages/standardConfig/...`, or `api.get` not existing — confirm `api.get` is defined in `api.ts`; `MasterItems.tsx` uses `api.get<unknown>("/master-items")`, so it exists. If the wrapper uses a different name, match it.)

- [ ] **Step 6: Run the existing suite to confirm nothing else broke**

Run: `npx vitest run`
Expected: PASS, and no test references the deleted `resolveStandardConfig`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(standard-config): single-page keyword+times form; remove override/sync UI"
```

---

## Task 6: Component test for the page

**Files:**
- Create: `src/pages/__tests__/StandardConfig.test.tsx`

- [ ] **Step 1: Write the test**

Create `src/pages/__tests__/StandardConfig.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StandardConfig from "../StandardConfig";

vi.mock("@/lib/api", () => ({
  api: {
    getStandardConfigs: vi.fn(),
    createStandardConfig: vi.fn(),
    updateStandardConfig: vi.fn(),
    deleteStandardConfig: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <StandardConfig />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("StandardConfig page", () => {
  it("renders existing rows", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { _id: "1", keyword: "ANILOFOS", keywordLower: "anilofos", gcTimes: 3, hplcTimes: null, note: "" },
    ]);
    renderPage();
    expect(await screen.findByText("ANILOFOS")).toBeInTheDocument();
    expect(screen.getByText("3 ครั้ง")).toBeInTheDocument();
  });

  it("creates a config from the add form", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (api.createStandardConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
    renderPage();

    fireEvent.click(await screen.findByText("เพิ่ม Standard"));
    fireEvent.change(
      screen.getByPlaceholderText(/match แบบมีคำนี้อยู่ในชื่อ/),
      { target: { value: "GLYPHOSATE" } },
    );
    // GC times = first number input in the dialog
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "2" } });
    fireEvent.click(screen.getByText("บันทึก"));

    await waitFor(() =>
      expect(api.createStandardConfig).toHaveBeenCalledWith({
        keyword: "GLYPHOSATE",
        gcTimes: 2,
        hplcTimes: null,
        note: "",
      }),
    );
  });

  it("blocks submit when neither instrument has times", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByText("เพิ่ม Standard"));
    fireEvent.change(
      screen.getByPlaceholderText(/match แบบมีคำนี้อยู่ในชื่อ/),
      { target: { value: "ABC" } },
    );
    fireEvent.click(screen.getByText("บันทึก"));
    await screen.findByText(/อย่างน้อย 1 เครื่อง \(GC หรือ HPLC\)/);
    expect(api.createStandardConfig).not.toHaveBeenCalled();
  });
});
```

> Note: the "blocks submit" assertion looks for the *validation* message (`...(GC หรือ HPLC)`), which differs from the always-on hint text (`อย่างน้อยต้องกรอก 1 เครื่อง`) so the two don't collide. If `getAllByRole("spinbutton")` ordering ever changes, GC is index `0`, HPLC is index `1` (declaration order in the dialog).

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/pages/__tests__/StandardConfig.test.tsx`
Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add src/pages/__tests__/StandardConfig.test.tsx
git commit -m "test(standard-config): page renders, creates, and validates"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test run**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 3: Manual smoke (if dev server is running on :8000 / backend :3001)**

- Open `/LIS/standard-config`.
- Add a keyword (try a datalist suggestion + a free-typed value), set GC times, save → row appears.
- Edit it (change HPLC times) → reload → values persist.
- Try a duplicate keyword → inline "keyword นี้มีอยู่แล้ว".
- Delete → confirm → row gone.

Do not run `npm run build` (postbuild rewrites the live `index.html`).

- [ ] **Step 4: Confirm no dangling references**

Use the Grep tool: pattern `standard-overrides|StandardOverride|resolveStandardConfig|syncStandardConfig|standardConfig/types`, across `src` and `server`.
Expected: **no matches**.

---

## Self-Review notes (author)

- **Spec coverage:** data model (Task 2), API CRUD + validation + 409 dup (Tasks 1,3), single-page form + keyword combobox + contains-match storage + search (Task 5), removal of override/sync/2-tabs/resolveStandardConfig (Tasks 4,5), tests (Tasks 1,6), Phase-2 deferral — no deduction/matching code anywhere — all covered.
- **Permission gating:** spec mentioned per-button `master` gating; plan follows the actual codebase pattern (`ParameterSettings.tsx` has none; `PrivateRoute` gates the route). No in-page gating added — intentional, for consistency.
- **Type consistency:** `StandardConfigDoc` (`keyword`/`keywordLower`/`gcTimes`/`hplcTimes`/`note`) defined in Task 1, used identically in Tasks 5–6; server fields match (Tasks 2,3). API methods key by `id` everywhere.
- **`api.get` assumption:** Task 5 Step 5 flags verifying the request-wrapper method name; `MasterItems.tsx` uses `api.get<unknown>("/master-items")`, so it exists.
