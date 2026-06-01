# Standard Config Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Standard Config so each row is one instrument (GC/HPLC) with two non-deletable per-instrument defaults (GC=3, HPLC=1) plus per-substance overrides selected by exact commonName.

**Architecture:** Single Mongo collection `StandardConfig`, one doc per row `{instrument, scope, commonName, commonNameLower, times, isDefault, note}`. Defaults (`scope:'all'`) are lazy-ensured on every `GET`. Substance rows (`scope:'substance'`) are CRUD-managed and unique per `(instrument, commonName)`. Validation logic lives in a shared client helper and is re-checked server-side. Single React page with a table + add/edit dialog.

**Tech Stack:** Express 4 + Mongoose 8 (server), React 18 + TS + TanStack Query + shadcn/ui (client), Vitest + Testing Library (tests).

**Spec:** `docs/superpowers/specs/2026-06-01-standard-config-redesign-design.md`

---

## File Structure

- `src/lib/standardConfig.ts` — **rewrite.** Types (`Instrument`, `Scope`, `StandardConfigDoc`, `StandardConfigInput`) + `validateStandardConfigInput` + `normalizeTimes`. Pure, unit-tested.
- `src/lib/standardConfig.test.ts` — **rewrite.** Unit tests for the validator.
- `server/models/StandardConfig.js` — **rewrite.** New schema + compound unique index.
- `server/routes/standardConfigs.js` — **rewrite.** lazy-ensure defaults, CRUD, delete guard, validation.
- `src/lib/api.ts` — **verify only** (type flows through; likely no edit needed).
- `src/pages/StandardConfig.tsx` — **rewrite.** Table + dialog UI.
- `src/pages/__tests__/StandardConfig.test.tsx` — **rewrite.** Component tests.
- `server/seed-data/standardconfigs.json` — **regenerate** via `npm run seed:export` at the end.

---

## Task 1: Validation helper + types (`src/lib/standardConfig.ts`)

**Files:**
- Modify (rewrite): `src/lib/standardConfig.ts`
- Test (rewrite): `src/lib/standardConfig.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/lib/standardConfig.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeTimes,
  validateStandardConfigInput,
  MAX_COMMONNAME_LEN,
  MAX_TIMES,
  MIN_TIMES,
  type StandardConfigInput,
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
  });
  it("maps non-numeric to null", () => {
    expect(normalizeTimes("abc")).toBeNull();
  });
});

describe("validateStandardConfigInput", () => {
  const substance: StandardConfigInput = {
    instrument: "GC",
    scope: "substance",
    commonName: "ANILOFOS",
    times: 3,
    note: "",
  };
  const defaultRow: StandardConfigInput = {
    instrument: "HPLC",
    scope: "all",
    commonName: null,
    times: 1,
    note: "",
  };

  it("accepts a valid substance input", () => {
    expect(validateStandardConfigInput(substance)).toBeNull();
  });
  it("accepts a valid default (scope=all) input", () => {
    expect(validateStandardConfigInput(defaultRow)).toBeNull();
  });
  it("rejects a bad instrument", () => {
    expect(
      validateStandardConfigInput({ ...substance, instrument: "MS" as never })?.field,
    ).toBe("instrument");
  });
  it("rejects a bad scope", () => {
    expect(
      validateStandardConfigInput({ ...substance, scope: "weird" as never })?.field,
    ).toBe("scope");
  });
  it("rejects substance with empty commonName", () => {
    expect(validateStandardConfigInput({ ...substance, commonName: "  " })?.field).toBe(
      "commonName",
    );
  });
  it("rejects commonName over max length", () => {
    const long = "x".repeat(MAX_COMMONNAME_LEN + 1);
    expect(validateStandardConfigInput({ ...substance, commonName: long })?.field).toBe(
      "commonName",
    );
  });
  it("ignores commonName when scope=all", () => {
    expect(validateStandardConfigInput({ ...defaultRow, commonName: null })).toBeNull();
  });
  it("rejects times below minimum", () => {
    expect(validateStandardConfigInput({ ...substance, times: MIN_TIMES - 1 })?.field).toBe(
      "times",
    );
  });
  it("rejects null times", () => {
    expect(validateStandardConfigInput({ ...substance, times: null })?.field).toBe("times");
  });
  it("rejects decimal times", () => {
    expect(validateStandardConfigInput({ ...substance, times: 1.5 })?.field).toBe("times");
  });
  it("rejects times over max", () => {
    expect(validateStandardConfigInput({ ...substance, times: MAX_TIMES + 1 })?.field).toBe(
      "times",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/standardConfig.test.ts`
Expected: FAIL — `MAX_COMMONNAME_LEN`/`MIN_TIMES` not exported, types changed.

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `src/lib/standardConfig.ts` with:

```ts
export type Instrument = "GC" | "HPLC";
export type Scope = "all" | "substance";

export type StandardConfigDoc = {
  _id: string;
  instrument: Instrument;
  scope: Scope;
  commonName: string | null;
  commonNameLower: string | null;
  times: number;
  isDefault: boolean;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StandardConfigInput = {
  instrument: Instrument;
  scope: Scope;
  commonName: string | null;
  times: number | null;
  note?: string;
};

export type StandardConfigField = "instrument" | "scope" | "commonName" | "times";
export type ValidationError = { field: StandardConfigField; message: string };

export const MAX_COMMONNAME_LEN = 200;
export const MAX_TIMES = 100000;
export const MIN_TIMES = 1;

/** Parse a raw times input (string | number | null) → number-or-null. Empty/non-numeric → null. */
export function normalizeTimes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function validateStandardConfigInput(input: StandardConfigInput): ValidationError | null {
  if (input.instrument !== "GC" && input.instrument !== "HPLC") {
    return { field: "instrument", message: "กรุณาเลือกเครื่อง (GC หรือ HPLC)" };
  }
  if (input.scope !== "all" && input.scope !== "substance") {
    return { field: "scope", message: "scope ไม่ถูกต้อง" };
  }
  if (input.scope === "substance") {
    const cn = String(input.commonName ?? "").trim();
    if (!cn) return { field: "commonName", message: "กรุณาเลือกสาร (commonName)" };
    if (cn.length > MAX_COMMONNAME_LEN) {
      return { field: "commonName", message: `ชื่อสารยาวเกิน ${MAX_COMMONNAME_LEN} ตัว` };
    }
  }
  const t = input.times;
  if (t === null || t === undefined || !Number.isInteger(t) || t < MIN_TIMES || t > MAX_TIMES) {
    return { field: "times", message: `จำนวนครั้งต้องเป็นจำนวนเต็ม ${MIN_TIMES}–${MAX_TIMES}` };
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/standardConfig.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/standardConfig.ts src/lib/standardConfig.test.ts
git commit -m "feat(standard-config): per-instrument validation helper + types"
```

---

## Task 2: Mongoose model (`server/models/StandardConfig.js`)

**Files:**
- Modify (rewrite): `server/models/StandardConfig.js`

- [ ] **Step 1: Rewrite the schema**

Replace the entire contents of `server/models/StandardConfig.js` with:

```js
const mongoose = require('mongoose');

const StandardConfigSchema = new mongoose.Schema(
  {
    // one row = one instrument
    instrument: { type: String, enum: ['GC', 'HPLC'], required: true },
    // 'all' = per-instrument default (non-deletable); 'substance' = per-commonName override
    scope: { type: String, enum: ['all', 'substance'], required: true },
    commonName: { type: String, default: null, trim: true }, // null when scope='all'
    commonNameLower: { type: String, default: null }, // lowercased; null when scope='all'
    times: { type: Number, required: true, min: 1 }, // จำนวนครั้งที่ใช้ standard
    isDefault: { type: Boolean, default: false }, // true → cannot be deleted
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

// One row per (instrument, scope, commonName). Defaults differ by instrument
// (commonNameLower null), so they never collide; substance rows are unique per
// (instrument, commonName).
StandardConfigSchema.index(
  { instrument: 1, scope: 1, commonNameLower: 1 },
  { unique: true },
);

module.exports = mongoose.model('StandardConfig', StandardConfigSchema);
```

- [ ] **Step 2: Reconcile indexes (drop the stale collection)**

The old schema had a `keywordLower` unique index and `keyword` required. The DB is empty (`GET /standard-configs` returns `[]`), so dropping the collection clears stale indexes cleanly; `ensureCollections()` + `syncIndexes()` recreate it on next boot.

Run (with the backend able to reach Mongo):

```bash
node -e "const m=require('mongoose');m.connect(process.env.MONGODB_URI||'mongodb://localhost:27017/LIS-DB').then(async()=>{try{await m.connection.collection('standardconfigs').drop();console.log('dropped');}catch(e){console.log('skip:',e.message);}finally{process.exit(0);}})"
```

Expected: `dropped` (or `skip: ns not found` if it never existed). Either is fine.

- [ ] **Step 3: Commit**

```bash
git add server/models/StandardConfig.js
git commit -m "feat(standard-config): per-instrument schema + compound unique index"
```

---

## Task 3: API route (`server/routes/standardConfigs.js`)

**Files:**
- Modify (rewrite): `server/routes/standardConfigs.js`

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `server/routes/standardConfigs.js` with:

```js
const express = require('express');
const mongoose = require('mongoose');
const StandardConfig = require('../models/StandardConfig');

const router = express.Router();

const MAX_COMMONNAME_LEN = 200;
const MAX_TIMES = 100000;
const MIN_TIMES = 1;

const DEFAULTS = [
  { instrument: 'GC', times: 3 },
  { instrument: 'HPLC', times: 1 },
];

// Make sure the two non-deletable per-instrument defaults exist (recreates them
// after a DB wipe). Idempotent + race-safe via upsert.
async function ensureDefaults() {
  for (const d of DEFAULTS) {
    await StandardConfig.updateOne(
      { instrument: d.instrument, scope: 'all' },
      {
        $setOnInsert: {
          instrument: d.instrument,
          scope: 'all',
          commonName: null,
          commonNameLower: null,
          times: d.times,
          isDefault: true,
          note: '',
        },
      },
      { upsert: true },
    );
  }
}

function validateTimes(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < MIN_TIMES || n > MAX_TIMES) {
    return { error: { message: `จำนวนครั้งต้องเป็นจำนวนเต็ม ${MIN_TIMES}–${MAX_TIMES}`, field: 'times' } };
  }
  return { ok: n };
}

// Build/validate a substance-row body (POST + PUT on non-default rows).
// Returns { value } or { error: { message, field } }.
function buildSubstanceBody(body) {
  const instrument = String((body && body.instrument) || '').toUpperCase();
  if (instrument !== 'GC' && instrument !== 'HPLC') {
    return { error: { message: 'instrument ต้องเป็น GC หรือ HPLC', field: 'instrument' } };
  }
  const commonName = String((body && body.commonName) || '').trim();
  if (!commonName) return { error: { message: 'commonName required', field: 'commonName' } };
  if (commonName.length > MAX_COMMONNAME_LEN) {
    return { error: { message: `commonName too long (max ${MAX_COMMONNAME_LEN})`, field: 'commonName' } };
  }
  const t = validateTimes(body && body.times);
  if (t.error) return { error: t.error };
  return {
    value: {
      instrument,
      scope: 'substance',
      commonName,
      commonNameLower: commonName.toLowerCase(),
      times: t.ok,
      isDefault: false,
      note: String((body && body.note) || '').trim(),
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    await ensureDefaults();
    const docs = await StandardConfig.find()
      .sort({ isDefault: -1, commonNameLower: 1, instrument: 1 })
      .lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (req.body && req.body.scope === 'all') {
      return res.status(400).json({ message: 'สร้างค่าตั้งต้นไม่ได้', field: 'scope' });
    }
    const built = buildSubstanceBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const existing = await StandardConfig.findOne({
      instrument: built.value.instrument,
      scope: 'substance',
      commonNameLower: built.value.commonNameLower,
    }).lean();
    if (existing) {
      return res.status(409).json({ message: 'สารนี้มีค่าของเครื่องนี้แล้ว', field: 'commonName' });
    }
    const doc = await StandardConfig.create(built.value);
    res.status(201).json(doc.toObject());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'not found' });
    const current = await StandardConfig.findById(id).lean();
    if (!current) return res.status(404).json({ message: 'not found' });

    if (current.isDefault) {
      // Default rows: only times + note may change.
      const t = validateTimes(req.body && req.body.times);
      if (t.error) return res.status(400).json(t.error);
      const note = String((req.body && req.body.note) || '').trim();
      const doc = await StandardConfig.findByIdAndUpdate(
        id,
        { $set: { times: t.ok, note } },
        { new: true },
      ).lean();
      return res.json(doc);
    }

    const built = buildSubstanceBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const clash = await StandardConfig.findOne({
      instrument: built.value.instrument,
      scope: 'substance',
      commonNameLower: built.value.commonNameLower,
      _id: { $ne: id },
    }).lean();
    if (clash) {
      return res.status(409).json({ message: 'สารนี้มีค่าของเครื่องนี้แล้ว', field: 'commonName' });
    }
    const doc = await StandardConfig.findByIdAndUpdate(id, { $set: built.value }, { new: true }).lean();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'not found' });
    const doc = await StandardConfig.findById(id).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    if (doc.isDefault) return res.status(403).json({ message: 'ลบค่าตั้งต้นไม่ได้' });
    await StandardConfig.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Restart the backend so the new model/index loads**

The backend runs under nodemon (`cd server && npm run dev`) and reloads on save. If it is not running, start it. Confirm boot has no index errors in the server console.

- [ ] **Step 3: Verify endpoints manually (curl/PowerShell)**

Run (PowerShell):

```powershell
# GET → should lazy-ensure and return the 2 defaults
Invoke-WebRequest -Uri 'http://localhost:3001/api/standard-configs' -UseBasicParsing | Select -Expand Content
```
Expected: JSON array with 2 docs — `GC scope=all times=3 isDefault=true` and `HPLC scope=all times=1 isDefault=true`.

```powershell
# POST a substance row
Invoke-WebRequest -Uri 'http://localhost:3001/api/standard-configs' -Method POST -ContentType 'application/json' `
  -Body '{"instrument":"GC","commonName":"ANILOFOS","times":5}' -UseBasicParsing | Select -Expand Content
```
Expected: 201 with the created doc (`scope=substance`, `isDefault=false`).

```powershell
# Duplicate (instrument+commonName) → 409
try { Invoke-WebRequest -Uri 'http://localhost:3001/api/standard-configs' -Method POST -ContentType 'application/json' `
  -Body '{"instrument":"GC","commonName":"ANILOFOS","times":2}' -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
```
Expected: `409`.

```powershell
# DELETE a default → 403 (find a default _id from the GET above, substitute below)
try { Invoke-WebRequest -Uri 'http://localhost:3001/api/standard-configs/<DEFAULT_ID>' -Method DELETE -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
```
Expected: `403`.

- [ ] **Step 4: Clean up the test substance row**

Delete the ANILOFOS row created above (grab its `_id` from GET):

```powershell
Invoke-WebRequest -Uri 'http://localhost:3001/api/standard-configs/<ANILOFOS_ID>' -Method DELETE -UseBasicParsing | Select -Expand Content
```
Expected: `{"ok":true}`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/standardConfigs.js
git commit -m "feat(standard-config): lazy-ensure defaults, per-instrument CRUD, delete guard"
```

---

## Task 4: Page UI (`src/pages/StandardConfig.tsx`)

**Files:**
- Modify (rewrite): `src/pages/StandardConfig.tsx`

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `src/pages/StandardConfig.tsx` with:

```tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Pencil, Plus, Search, Trash2 } from "lucide-react";

import AppLayout from "@/components/lis/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  type Instrument,
  type Scope,
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
  instrument: Instrument;
  scope: Scope;
  commonName: string;
  times: string;
  note: string;
  isDefault: boolean;
};

const emptyForm: FormState = {
  id: null,
  instrument: "GC",
  scope: "substance",
  commonName: "",
  times: "",
  note: "",
  isDefault: false,
};

export default function StandardConfig() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const { data: configs = [], isLoading } = useQuery<StandardConfigDoc[]>({
    queryKey: ["standard-configs"],
    queryFn: () => api.getStandardConfigs(),
  });

  // Suggestions for the commonName combobox — distinct commonNames from master items.
  const { data: masterItemRows = [] } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["master-items"],
    queryFn: async () => {
      const res = await api.get<unknown>("/master-items");
      const payload = (res as { data: { data: unknown } }).data.data;
      return Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
    },
  });
  const commonNameSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const it of masterItemRows) {
      const cn = pickCommonName(it);
      if (cn) set.add(cn);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterItemRows]);

  // Default rows always shown; substance rows filtered by commonName search.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return configs.filter((c) => {
      if (c.isDefault) return true;
      if (!q) return true;
      return (c.commonName ?? "").toLowerCase().includes(q);
    });
  }, [configs, search]);

  const saveMutation = useMutation({
    mutationFn: (payload: { id: string | null; data: Record<string, unknown> }) =>
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
      instrument: c.instrument,
      scope: c.scope,
      commonName: c.commonName ?? "",
      times: String(c.times),
      note: c.note ?? "",
      isDefault: c.isDefault,
    });
  };

  const submit = () => {
    if (!form) return;
    const input = {
      instrument: form.instrument,
      scope: form.scope,
      commonName: form.scope === "all" ? null : form.commonName,
      times: normalizeTimes(form.times),
      note: form.note,
    };
    const err = validateStandardConfigInput(input);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(null);
    // Default rows only update times + note; the server ignores other fields anyway.
    const data = form.isDefault
      ? { times: input.times, note: input.note }
      : input;
    saveMutation.mutate({ id: form.id, data });
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
            ตั้งค่าจำนวนครั้งที่ใช้ standard ต่อเครื่อง/ต่อสาร (ใช้สำหรับตัดสต็อกในอนาคต)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อสาร..."
              className="pl-8"
            />
          </div>
          <Button onClick={openAdd} className="gap-1">
            <Plus className="h-4 w-4" /> เพิ่มสาร
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">เครื่อง</TableHead>
                <TableHead>เป้าหมาย</TableHead>
                <TableHead className="w-28 text-right">จำนวนครั้ง</TableHead>
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
                    <TableCell className="font-medium">{c.instrument}</TableCell>
                    <TableCell>
                      {c.isDefault ? (
                        <span className="flex items-center gap-2">
                          ทั้งหมด
                          <Badge variant="secondary">ค่าตั้งต้น</Badge>
                        </span>
                      ) : (
                        c.commonName
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.times} ครั้ง</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.note}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {c.isDefault ? null : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`ลบ "${c.instrument} — ${c.commonName}"?`)) {
                                deleteMutation.mutate(c._id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!form}
        onOpenChange={(o) => {
          if (!o) {
            setForm(null);
            setFieldError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form?.isDefault
                ? `แก้ค่าตั้งต้น (เครื่อง ${form.instrument})`
                : form?.id
                  ? "แก้ไขสาร"
                  : "เพิ่มสาร"}
            </DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">เครื่อง *</Label>
                <div className="flex gap-2">
                  {(["GC", "HPLC"] as Instrument[]).map((inst) => (
                    <Button
                      key={inst}
                      type="button"
                      variant={form.instrument === inst ? "default" : "outline"}
                      disabled={form.isDefault}
                      onClick={() => setForm({ ...form, instrument: inst })}
                      className="flex-1"
                    >
                      {inst}
                    </Button>
                  ))}
                </div>
                {fieldError?.field === "instrument" ? (
                  <p className="text-xs text-destructive">{fieldError.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sc-commonname" className="text-sm">
                  สาร (commonName) *
                </Label>
                {form.isDefault ? (
                  <Input id="sc-commonname" value="ทั้งหมด (ค่าตั้งต้น)" disabled />
                ) : (
                  <>
                    <Input
                      id="sc-commonname"
                      list="standard-config-commonnames"
                      value={form.commonName}
                      onChange={(e) => setForm({ ...form, commonName: e.target.value })}
                      placeholder="เลือกชื่อสารจากรายการ"
                    />
                    <datalist id="standard-config-commonnames">
                      {commonNameSuggestions.map((cn) => (
                        <option key={cn} value={cn} />
                      ))}
                    </datalist>
                  </>
                )}
                {fieldError?.field === "commonName" ? (
                  <p className="text-xs text-destructive">{fieldError.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sc-times" className="text-sm">
                  จำนวนครั้ง *
                </Label>
                <Input
                  id="sc-times"
                  type="number"
                  min={1}
                  step={1}
                  value={form.times}
                  onChange={(e) => setForm({ ...form, times: e.target.value })}
                />
                {fieldError?.field === "times" ? (
                  <p className="text-xs text-destructive">{fieldError.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sc-note" className="text-sm">
                  หมายเหตุ
                </Label>
                <Input
                  id="sc-note"
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If `Badge` import path differs, confirm it exists at `src/components/ui/badge`.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/StandardConfig.tsx
git commit -m "feat(standard-config): per-instrument table + add/edit dialog UI"
```

---

## Task 5: Component tests (`src/pages/__tests__/StandardConfig.test.tsx`)

**Files:**
- Modify (rewrite): `src/pages/__tests__/StandardConfig.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/pages/__tests__/StandardConfig.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import StandardConfig from "../StandardConfig";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <StandardConfig />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const defaultRows = [
  { _id: "d1", instrument: "GC", scope: "all", commonName: null, commonNameLower: null, times: 3, isDefault: true, note: "" },
  { _id: "d2", instrument: "HPLC", scope: "all", commonName: null, commonNameLower: null, times: 1, isDefault: true, note: "" },
];

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: [] } });
});

describe("StandardConfig page", () => {
  it("renders default rows with a non-deletable badge", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue(defaultRows);
    renderPage();
    expect(await screen.findAllByText("ค่าตั้งต้น")).toHaveLength(2);
    expect(screen.getByText("3 ครั้ง")).toBeInTheDocument();
    expect(screen.getByText("1 ครั้ง")).toBeInTheDocument();
  });

  it("creates a substance row from the add form", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue(defaultRows);
    (api.createStandardConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
    renderPage();

    fireEvent.click(await screen.findByText("เพิ่มสาร"));
    fireEvent.change(screen.getByPlaceholderText("เลือกชื่อสารจากรายการ"), {
      target: { value: "GLYPHOSATE" },
    });
    fireEvent.change(screen.getByLabelText("จำนวนครั้ง *"), { target: { value: "4" } });
    fireEvent.click(screen.getByText("บันทึก"));

    await waitFor(() =>
      expect(api.createStandardConfig).toHaveBeenCalledWith({
        instrument: "GC",
        scope: "substance",
        commonName: "GLYPHOSATE",
        times: 4,
        note: "",
      }),
    );
  });

  it("blocks submit when commonName is empty for a substance", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue(defaultRows);
    renderPage();
    fireEvent.click(await screen.findByText("เพิ่มสาร"));
    fireEvent.change(screen.getByLabelText("จำนวนครั้ง *"), { target: { value: "2" } });
    fireEvent.click(screen.getByText("บันทึก"));
    await screen.findByText(/กรุณาเลือกสาร/);
    expect(api.createStandardConfig).not.toHaveBeenCalled();
  });

  it("locks instrument + target when editing a default row", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue(defaultRows);
    (api.updateStandardConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
    renderPage();

    // open edit on the first (GC default) row via its pencil button
    const editButtons = await screen.findAllByRole("button");
    // The dialog title proves the default-edit branch; trigger by opening edit on GC default.
    fireEvent.click(screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-pencil") || b.querySelector(".lucide-pencil")) ?? editButtons[0]);
    expect(await screen.findByText(/แก้ค่าตั้งต้น/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("ทั้งหมด (ค่าตั้งต้น)")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("จำนวนครั้ง *"), { target: { value: "5" } });
    fireEvent.click(screen.getByText("บันทึก"));
    await waitFor(() =>
      expect(api.updateStandardConfig).toHaveBeenCalledWith("d1", { times: 5, note: "" }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify behavior**

Run: `npm run test -- src/pages/__tests__/StandardConfig.test.tsx`
Expected: PASS. If the pencil-button selector in the last test is flaky (icon class names), replace the selector line with a more robust query: open the first row's edit by `screen.getAllByRole("button")` filtered by position, or add `aria-label="แก้ไข"` to the edit `<Button>` in the page and select by that label. Prefer adding the `aria-label` to the page's edit button and selecting `screen.getAllByLabelText("แก้ไข")[0]`.

- [ ] **Step 3: (If needed) add aria-labels to the page's row buttons**

If Step 2 needed the robust selector, edit `src/pages/StandardConfig.tsx`: add `aria-label="แก้ไข"` to the edit `<Button>` and `aria-label="ลบ"` to the delete `<Button>`, then change the test to use `screen.getAllByLabelText("แก้ไข")[0]`. Re-run Step 2 → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/__tests__/StandardConfig.test.tsx src/pages/StandardConfig.tsx
git commit -m "test(standard-config): page tests for defaults, create, validation, default-edit lock"
```

---

## Task 6: Data-layer check + full verification

**Files:**
- Verify: `src/lib/api.ts`

- [ ] **Step 1: Confirm `api.ts` standard-config functions still compile**

The functions `getStandardConfigs`/`createStandardConfig`/`updateStandardConfig`/`deleteStandardConfig` (around `src/lib/api.ts:268-284`) take `Partial<StandardConfigDoc>`. The new `StandardConfigDoc` keys (`instrument`, `scope`, `commonName`, `times`, …) flow through automatically. No signature change is expected.

Run: `npx tsc --noEmit`
Expected: no errors. If `createStandardConfig`/`updateStandardConfig` complain about the payload shape, widen their parameter type to `Record<string, unknown>` (matching what the page now passes) and re-run.

- [ ] **Step 2: Run the full unit/component suite**

Run: `npm run test`
Expected: PASS (158+ existing tests plus the rewritten ones). Fix any fallout before continuing.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors in the files touched.

- [ ] **Step 4: Commit (only if Step 1 required an edit)**

```bash
git add src/lib/api.ts
git commit -m "chore(standard-config): align api payload types with new schema"
```

---

## Task 7: Manual smoke + refresh seed data

**Files:**
- Regenerate: `server/seed-data/standardconfigs.json`

- [ ] **Step 1: Smoke-test in the browser**

With both servers running, open `http://localhost:8000/LIS/standard-config`. Verify:
- 2 default rows show (GC 3 ครั้ง, HPLC 1 ครั้ง) with a `ค่าตั้งต้น` badge and **no** delete button.
- "เพิ่มสาร" → pick GC, choose a commonName from the dropdown, set จำนวนครั้ง = 5 → save → row appears.
- Edit that row's จำนวนครั้ง → saves.
- Edit a default → instrument + target are locked; only จำนวนครั้ง editable; saves.
- Delete the substance row → disappears. Reload → state persists.

- [ ] **Step 2: Regenerate seed data so it matches the DB**

Per CLAUDE.md, `seed-data/` must track the DB after a schema/data change. After Step 1, leave the DB holding just the 2 defaults (delete any test substance rows you added), then run:

```bash
cd server && npm run seed:export
```
Expected: `server/seed-data/standardconfigs.json` now contains the 2 default docs in EJSON.

- [ ] **Step 3: Commit**

```bash
git add server/seed-data/standardconfigs.json
git commit -m "chore(standard-config): refresh seed-data with default rows"
```

- [ ] **Step 4: Final type-check + test gate**

Run: `npx tsc --noEmit && npm run test`
Expected: both clean. Feature complete.

---

## Self-Review Notes

- **Spec coverage:** data model (T2), lazy-ensure defaults (T3), CRUD + 409 dup + 403 delete-guard + scope=all POST block (T3), validation helper + min/max times (T1), table with badge + hidden delete on defaults (T4), add/edit dialog with locked defaults + exact-commonName combobox (T4), tests (T1/T5), seed refresh (T7). All mapped.
- **Permission gating:** spec mentioned frontend gating of write buttons by `master`. Existing comparable pages (MasterItems) do **not** gate inline — access is enforced by `PrivateRoute` (route) + API. Plan follows the existing pattern and omits inline gating to avoid introducing a one-off mechanism. (Documented deviation.)
- **Type consistency:** `StandardConfigDoc`/`StandardConfigInput`/`Instrument`/`Scope` defined in T1 are the exact names imported in T4/T5. Server field names (`instrument`, `scope`, `commonName`, `commonNameLower`, `times`, `isDefault`, `note`) match across T2/T3 and the client payloads in T4/T5.
- **Old data:** discarded (T2 Step 2 drops the stale collection); no migration per spec.
```
