# Sample-Prep Daily Equipment Working-Check — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `sample-prep` Daily Check placeholder with a working page where lab staff record a daily working-check (status + optional temp/pH reading + note) for the room's 13 main instruments.

**Architecture:** A generic `EquipmentCheck` Mongoose collection keyed by `roomSlug` + `instrumentId` (reusable by future rooms), a static per-room instrument catalog driving the UI, an Express route mirroring `dailyChecks.js`, and a React page mirroring `BalanceRoomPage` (card-per-instrument + history tab). POST appends a record; the latest record per instrument for today is the displayed status.

**Tech Stack:** Express 4 + Mongoose 8 (server), React 18 + TS + Vite + TanStack Query + shadcn/ui (client), Vitest (lib test).

Spec: `docs/superpowers/specs/2026-06-05-sample-prep-daily-check-design.md`

---

## File Structure

- **Create** `src/lib/samplePrepInstruments.ts` — static instrument catalog + helpers (single source of truth for which instruments render and what each captures).
- **Create** `src/lib/samplePrepInstruments.test.ts` — Vitest catalog-integrity test.
- **Create** `server/models/EquipmentCheck.js` — generic equipment-check Mongoose model (auto-loaded by `loadAllModels()`).
- **Create** `server/routes/equipment-checks.js` — GET (filtered) + POST route.
- **Modify** `server/index.js` — mount the new route via `mountApi()`.
- **Create** `src/pages/daily-check/SamplePrepRoomPage.tsx` — the room page.
- **Modify** `src/lib/api.ts` — `EquipmentCheckRecord`/`CreateEquipmentCheckPayload` types + `getEquipmentChecks`/`createEquipmentCheck`.
- **Modify** `src/App.tsx` — route `sample-prep` → `SamplePrepRoomPage`.
- **Modify** `src/lib/dailyCheckRooms.ts` — set `sample-prep` room `ready: true`.

---

## Task 1: Instrument catalog (pure lib, TDD)

**Files:**
- Create: `src/lib/samplePrepInstruments.ts`
- Test: `src/lib/samplePrepInstruments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/samplePrepInstruments.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  SAMPLE_PREP_INSTRUMENTS,
  SAMPLE_PREP_ROOM_SLUG,
  samplePrepGroups,
  getSamplePrepInstrument,
} from "./samplePrepInstruments";

describe("samplePrepInstruments catalog", () => {
  it("targets the sample-prep room", () => {
    expect(SAMPLE_PREP_ROOM_SLUG).toBe("sample-prep");
  });

  it("has 13 instruments with unique ids", () => {
    expect(SAMPLE_PREP_INSTRUMENTS).toHaveLength(13);
    const ids = SAMPLE_PREP_INSTRUMENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 8 basic instruments with no readings", () => {
    const basic = SAMPLE_PREP_INSTRUMENTS.filter((i) => i.group === "basic");
    expect(basic).toHaveLength(8);
    for (const i of basic) expect(i.readings).toHaveLength(0);
  });

  it("has 4 temp instruments each with one temp reading", () => {
    const temp = SAMPLE_PREP_INSTRUMENTS.filter((i) => i.group === "temp");
    expect(temp).toHaveLength(4);
    for (const i of temp) {
      expect(i.readings).toHaveLength(1);
      expect(i.readings[0].key).toBe("temp");
      expect(i.readings[0].unit).toBe("°C");
    }
  });

  it("has 1 ph instrument with a ph reading", () => {
    const ph = SAMPLE_PREP_INSTRUMENTS.filter((i) => i.group === "ph");
    expect(ph).toHaveLength(1);
    expect(ph[0].id).toBe("LD-011");
    expect(ph[0].readings[0].key).toBe("ph");
  });

  it("getSamplePrepInstrument resolves by id", () => {
    expect(getSamplePrepInstrument("LD-009")?.name).toBe("Hot Air Oven");
    expect(getSamplePrepInstrument("nope")).toBeUndefined();
  });

  it("every instrument belongs to a declared group", () => {
    const keys = samplePrepGroups.map((g) => g.key);
    for (const i of SAMPLE_PREP_INSTRUMENTS) expect(keys).toContain(i.group);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/samplePrepInstruments.test.ts`
Expected: FAIL — cannot resolve `./samplePrepInstruments`.

- [ ] **Step 3: Write the catalog**

Create `src/lib/samplePrepInstruments.ts`:

```ts
// Static catalog for the ห้องเตรียมตัวอย่าง (sample-prep) daily working-check.
// Single source of truth: which instruments render and what each one records.
// Phase 1 = the 13 "main group" instruments. milli-Q / Density / Hood are deferred
// (the EquipmentCheck.readings[] schema already accommodates them).

export type ReadingGroup = "basic" | "temp" | "ph";

export interface ReadingField {
  key: string; // "temp" | "ph"
  label: string; // "อุณหภูมิ" | "pH"
  unit: string; // "°C" | ""
}

export interface SamplePrepInstrument {
  id: string; // "LD-009"
  name: string; // "Hot Air Oven"
  brand: string; // "Memmert" ("" when unknown)
  group: ReadingGroup;
  readings: ReadingField[];
}

export const SAMPLE_PREP_ROOM_SLUG = "sample-prep";

const TEMP: ReadingField = { key: "temp", label: "อุณหภูมิ", unit: "°C" };
const PH: ReadingField = { key: "ph", label: "pH", unit: "" };

export const SAMPLE_PREP_INSTRUMENTS: SamplePrepInstrument[] = [
  // --- basic: status only ---
  { id: "LD-007", name: "Ultrasonic", brand: "NXPC", group: "basic", readings: [] },
  { id: "LD-008", name: "Ultrasonic", brand: "", group: "basic", readings: [] },
  { id: "LD-046", name: "Ultrasonic Cleaner", brand: "Daihan Scientific", group: "basic", readings: [] },
  { id: "LD-041", name: "Asirator pump 2", brand: "Lab companion", group: "basic", readings: [] },
  { id: "LD-025", name: "Hotplate", brand: "", group: "basic", readings: [] },
  { id: "LD-026", name: "Hotplate", brand: "", group: "basic", readings: [] },
  { id: "LD-012", name: "Magnetic stirrer 1", brand: "HL Instruments", group: "basic", readings: [] },
  { id: "LD-040", name: "Magnetic stirrer", brand: "", group: "basic", readings: [] },
  // --- temp: + temperature reading ---
  { id: "LD-009", name: "Hot Air Oven", brand: "Memmert", group: "temp", readings: [TEMP] },
  { id: "LD-010", name: "Oven", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-029", name: "Water bath", brand: "MEMMERT", group: "temp", readings: [TEMP] },
  { id: "LD-016", name: "Desiccator 1", brand: "", group: "temp", readings: [TEMP] },
  // --- ph: + pH reading ---
  { id: "LD-011", name: "pH Meter", brand: "Mettler Toledo", group: "ph", readings: [PH] },
];

export const samplePrepGroups: { key: ReadingGroup; label: string }[] = [
  { key: "basic", label: "เครื่องมือทั่วไป" },
  { key: "temp", label: "วัดอุณหภูมิ" },
  { key: "ph", label: "วัด pH" },
];

export const getSamplePrepInstrument = (id: string): SamplePrepInstrument | undefined =>
  SAMPLE_PREP_INSTRUMENTS.find((i) => i.id === id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/samplePrepInstruments.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/samplePrepInstruments.ts src/lib/samplePrepInstruments.test.ts
git commit -m "feat: add sample-prep instrument catalog + test"
```

---

## Task 2: Backend model `EquipmentCheck`

**Files:**
- Create: `server/models/EquipmentCheck.js`

> The project has no backend unit-test harness (tests are frontend Vitest + Playwright). Verification for backend tasks is by boot + HTTP, per existing convention.

- [ ] **Step 1: Write the model**

Create `server/models/EquipmentCheck.js`:

```js
const mongoose = require('mongoose');

// Generic per-instrument daily working-check, keyed by room.
// Phase 1 user: ห้องเตรียมตัวอย่าง (roomSlug "sample-prep").
const ReadingSchema = new mongoose.Schema({
  key: { type: String, required: true },     // "temp" | "ph"
  label: { type: String, default: '' },      // "อุณหภูมิ" | "pH"
  value: { type: Number, required: true },
  unit: { type: String, default: '' },       // "°C" | ""
}, { _id: false });

const EquipmentCheckSchema = new mongoose.Schema({
  roomSlug: { type: String, required: true, index: true },
  instrumentId: { type: String, required: true, index: true },
  instrumentName: { type: String, required: true },
  brand: { type: String, default: '' },

  status: { type: String, enum: ['normal', 'abnormal'], required: true, index: true },
  readings: { type: [ReadingSchema], default: [] },
  note: { type: String, default: '' },

  recorder: { type: String, required: true },
  recorderId: { type: String, default: '' },
  recorderEmail: { type: String, default: '' },

  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  checkedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

EquipmentCheckSchema.index({ roomSlug: 1, date: -1, instrumentId: 1 });

module.exports = mongoose.model('EquipmentCheck', EquipmentCheckSchema);
```

- [ ] **Step 2: Verify it loads (no crash, collection created)**

Restart the backend (`cd server && npm run dev`) and watch the boot log.
Run: look for the line `📦 Created collection: equipmentchecks` (first boot only) and no Mongoose error.
Expected: server boots; `equipmentchecks` collection exists with synced indexes.

- [ ] **Step 3: Commit**

```bash
git add -- server/models/EquipmentCheck.js
git commit -m "feat: add EquipmentCheck model"
```

---

## Task 3: Backend route `equipment-checks`

**Files:**
- Create: `server/routes/equipment-checks.js`
- Modify: `server/index.js` (add one `mountApi` line)

- [ ] **Step 1: Write the route**

Create `server/routes/equipment-checks.js`:

```js
const express = require('express');
const router = express.Router();
const EquipmentCheck = require('../models/EquipmentCheck');

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// GET /api/equipment-checks
// Query: ?room=<slug> (required) | ?date=YYYY-MM-DD|all | ?from=&to= | ?instrumentId= | ?status=normal|abnormal
// Default date: today
router.get('/', async (req, res) => {
  try {
    const { room, date, from, to, instrumentId, status } = req.query;
    if (!room) return res.status(400).json({ error: 'room ต้องระบุ' });

    const q = { roomSlug: String(room) };

    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = String(from);
      if (to) q.date.$lte = String(to);
    } else if (date === 'all') {
      // no date filter
    } else {
      q.date = date ? String(date) : todayStr();
    }

    if (instrumentId) q.instrumentId = String(instrumentId);
    if (status) q.status = String(status);

    const records = await EquipmentCheck.find(q).sort({ checkedAt: -1 }).lean();
    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipment-checks
router.post('/', async (req, res) => {
  try {
    const {
      roomSlug, instrumentId, instrumentName, brand,
      status, readings, note,
      recorder, recorderId, recorderEmail,
    } = req.body;

    if (!roomSlug || !instrumentId || !instrumentName) {
      return res.status(400).json({ error: 'roomSlug, instrumentId และ instrumentName ต้องระบุ' });
    }
    if (status !== 'normal' && status !== 'abnormal') {
      return res.status(400).json({ error: 'status ต้องเป็น normal หรือ abnormal' });
    }
    if (!recorder || !String(recorder).trim()) {
      return res.status(400).json({ error: 'recorder ต้องระบุ' });
    }

    let cleanReadings = [];
    if (Array.isArray(readings)) {
      for (const r of readings) {
        if (typeof r.value !== 'number' || Number.isNaN(r.value)) {
          return res.status(400).json({ error: `ค่า ${r.label || r.key} ต้องเป็นตัวเลข` });
        }
        cleanReadings.push({
          key: String(r.key),
          label: r.label ? String(r.label) : '',
          value: r.value,
          unit: r.unit ? String(r.unit) : '',
        });
      }
    }

    const created = await EquipmentCheck.create({
      roomSlug: String(roomSlug),
      instrumentId: String(instrumentId),
      instrumentName: String(instrumentName),
      brand: brand || '',
      status,
      readings: cleanReadings,
      note: note ? String(note) : '',
      recorder: String(recorder).trim(),
      recorderId: recorderId || '',
      recorderEmail: recorderEmail || '',
      date: todayStr(),
      checkedAt: new Date(),
    });

    res.status(201).json({ data: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount the route in `server/index.js`**

After the line `mountApi('/daily-checks', require('./routes/dailyChecks'));` add:

```js
mountApi('/equipment-checks', require('./routes/equipment-checks'));
```

- [ ] **Step 3: Verify with HTTP (server running)**

Run (PowerShell), create then read back:

```powershell
$body = @{ roomSlug='sample-prep'; instrumentId='LD-009'; instrumentName='Hot Air Oven'; brand='Memmert'; status='normal'; readings=@(@{key='temp';label='อุณหภูมิ';value=180;unit='°C'}); note='ทดสอบ'; recorder='ผู้ทดสอบ' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3001/api/equipment-checks' -Method Post -Body $body -ContentType 'application/json; charset=utf-8'
Invoke-RestMethod -Uri 'http://localhost:3001/api/equipment-checks?room=sample-prep' -Method Get
```

Expected: POST returns `data` with `_id`, `status:"normal"`, one reading; GET returns an array containing it. Then delete the test row so it doesn't pollute real data:

```powershell
# optional cleanup via mongosh, or leave it — it is harmless test data
```

- [ ] **Step 4: Commit**

```bash
git add -- server/routes/equipment-checks.js server/index.js
git commit -m "feat: add equipment-checks route"
```

---

## Task 4: API layer (`src/lib/api.ts`)

**Files:**
- Modify: `src/lib/api.ts` — add functions inside the `api` object (after the Env Check block, ~line 236) and types (after `DailyCheckTodaySummary`, ~line 400).

- [ ] **Step 1: Add the API functions**

In `src/lib/api.ts`, immediately after the `getEnvCheckTodaySummary: ...` entry and before `getLiveTempHum`, insert:

```ts
  // Equipment Check (เช็กการทำงานเครื่องมือประจำวัน — ห้องเตรียมตัวอย่าง ฯลฯ)
  getEquipmentChecks: (params: {
    room: string;
    date?: string;          // YYYY-MM-DD หรือ "all"
    from?: string;
    to?: string;
    instrumentId?: string;
    status?: "normal" | "abnormal";
  }) => {
    const qs = "?" + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]),
    ).toString();
    return request<{ data: EquipmentCheckRecord[] }>(`/equipment-checks${qs}`).then(r => r.data);
  },
  createEquipmentCheck: (data: CreateEquipmentCheckPayload) =>
    request<{ data: EquipmentCheckRecord }>("/equipment-checks", {
      method: "POST",
      body: JSON.stringify(data),
    }).then(r => r.data),
```

- [ ] **Step 2: Add the types**

In `src/lib/api.ts`, after the `DailyCheckTodaySummary` type block (~line 400), insert:

```ts
export type EquipmentReading = { key: string; label: string; value: number; unit: string };

export type EquipmentCheckRecord = {
  _id?: string;
  roomSlug: string;
  instrumentId: string;
  instrumentName: string;
  brand?: string;
  status: "normal" | "abnormal";
  readings: EquipmentReading[];
  note?: string;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
  date: string;       // YYYY-MM-DD
  checkedAt: string;  // ISO
  createdAt?: string;
  updatedAt?: string;
};

export type CreateEquipmentCheckPayload = {
  roomSlug: string;
  instrumentId: string;
  instrumentName: string;
  brand?: string;
  status: "normal" | "abnormal";
  readings?: EquipmentReading[];
  note?: string;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `api.ts` / the new types.

- [ ] **Step 4: Commit**

```bash
git add -- src/lib/api.ts
git commit -m "feat: add equipment-checks api client + types"
```

---

## Task 5: Page `SamplePrepRoomPage` + wiring

**Files:**
- Create: `src/pages/daily-check/SamplePrepRoomPage.tsx`
- Modify: `src/App.tsx` (import + route line)
- Modify: `src/lib/dailyCheckRooms.ts` (`sample-prep` → `ready: true`)

- [ ] **Step 1: Write the page**

Create `src/pages/daily-check/SamplePrepRoomPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Beaker, CheckCircle2, Clock, AlertTriangle, RotateCcw, List, ClipboardList, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api, type EquipmentCheckRecord, type EquipmentReading } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  SAMPLE_PREP_INSTRUMENTS,
  SAMPLE_PREP_ROOM_SLUG,
  samplePrepGroups,
} from "@/lib/samplePrepInstruments";

type StatusVal = "normal" | "abnormal" | "";

interface CheckDraft {
  status: StatusVal;
  readingValues: Record<string, string>; // reading.key -> input string
  note: string;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const emptyDraft = (): CheckDraft => ({ status: "", readingValues: {}, note: "" });

const TOTAL = SAMPLE_PREP_INSTRUMENTS.length;

const SamplePrepRoomPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayLabel = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  const [drafts, setDrafts] = useState<Record<string, CheckDraft>>({});

  const [filterDate, setFilterDate] = useState<string>(todayStr());
  const [filterInstrument, setFilterInstrument] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "normal" | "abnormal">("all");

  const { data: todayRecords = [] } = useQuery({
    queryKey: ["equipment-checks", "today", todayStr()],
    queryFn: () => api.getEquipmentChecks({ room: SAMPLE_PREP_ROOM_SLUG, date: todayStr() }),
    refetchOnWindowFocus: true,
  });

  const { data: historyRecords = [], isLoading: historyLoading } = useQuery({
    queryKey: ["equipment-checks", "history", filterDate, filterInstrument, filterStatus],
    queryFn: () =>
      api.getEquipmentChecks({
        room: SAMPLE_PREP_ROOM_SLUG,
        date: filterDate || todayStr(),
        instrumentId: filterInstrument === "all" ? undefined : filterInstrument,
        status: filterStatus === "all" ? undefined : filterStatus,
      }),
  });

  // latest record per instrument for today
  const latestByInstrument = useMemo(() => {
    const map: Record<string, EquipmentCheckRecord> = {};
    for (const r of todayRecords) {
      if (!map[r.instrumentId]) map[r.instrumentId] = r;
    }
    return map;
  }, [todayRecords]);

  const createMutation = useMutation({
    mutationFn: api.createEquipmentCheck,
    onSuccess: (_data, vars) => {
      if (vars.status === "normal") toast.success(`${vars.instrumentName} ใช้งานได้ปกติ`);
      else toast.warning(`${vars.instrumentName} ผิดปกติ — บันทึกแล้ว`);
      queryClient.invalidateQueries({ queryKey: ["equipment-checks"] });
      setDrafts((prev) => {
        const c = { ...prev };
        delete c[vars.instrumentId];
        return c;
      });
    },
    onError: (err: Error) => toast.error(err.message || "บันทึกไม่สำเร็จ"),
  });

  const getDraft = (id: string): CheckDraft => drafts[id] || emptyDraft();

  const setStatus = (id: string, status: StatusVal) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(id), status } }));

  const setReading = (id: string, key: string, value: string) =>
    setDrafts((prev) => {
      const d = getDraft(id);
      return { ...prev, [id]: { ...d, readingValues: { ...d.readingValues, [key]: value } } };
    });

  const setNote = (id: string, note: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(id), note } }));

  const handleSave = (instrumentId: string) => {
    const instrument = SAMPLE_PREP_INSTRUMENTS.find((i) => i.id === instrumentId)!;
    const d = getDraft(instrumentId);
    if (d.status !== "normal" && d.status !== "abnormal") {
      toast.error("กรุณาเลือกสถานะ (ปกติ / ผิดปกติ)");
      return;
    }
    if (!user?.name) {
      toast.error("ไม่พบชื่อผู้ใช้งานปัจจุบัน");
      return;
    }
    const readings: EquipmentReading[] = [];
    for (const f of instrument.readings) {
      const raw = d.readingValues[f.key];
      const value = parseFloat(raw);
      if (raw == null || raw === "" || Number.isNaN(value)) {
        toast.error(`กรุณากรอกค่า ${f.label} เป็นตัวเลข`);
        return;
      }
      readings.push({ key: f.key, label: f.label, value, unit: f.unit });
    }

    createMutation.mutate({
      roomSlug: SAMPLE_PREP_ROOM_SLUG,
      instrumentId: instrument.id,
      instrumentName: instrument.name,
      brand: instrument.brand,
      status: d.status,
      readings,
      note: d.note,
      recorder: user.name,
      recorderId: user.id,
      recorderEmail: user.email,
    });
  };

  const handleRecheck = (id: string) =>
    setDrafts((prev) => ({ ...prev, [id]: emptyDraft() }));

  const checkedCount = Object.keys(latestByInstrument).length;
  const normalCount = Object.values(latestByInstrument).filter((r) => r.status === "normal").length;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            ห้องเตรียมตัวอย่าง — เช็กการทำงานเครื่องมือ
          </h2>
          <p className="text-sm text-muted-foreground">ประจำวัน — {todayLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="text-sm gap-1 py-1 px-3">
            <Clock className="w-3.5 h-3.5" /> ตรวจแล้ว {checkedCount}/{TOTAL}
          </Badge>
          <Badge className="text-sm gap-1 py-1 px-3 bg-green-100 text-green-700 border-green-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> ปกติ {normalCount}/{TOTAL}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="check" className="space-y-4">
        <TabsList>
          <TabsTrigger value="check" className="gap-1.5">
            <ClipboardList className="w-4 h-4" /> บันทึกผล
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <List className="w-4 h-4" /> รายการบันทึก
          </TabsTrigger>
        </TabsList>

        <TabsContent value="check" className="space-y-6">
          {samplePrepGroups.map((group) => {
            const items = SAMPLE_PREP_INSTRUMENTS.filter((i) => i.group === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map((instrument) => {
                    const todayRec = latestByInstrument[instrument.id];
                    const d = getDraft(instrument.id);
                    const isCheckedToday = !!todayRec;
                    const isDirty = !!drafts[instrument.id] &&
                      (d.status !== "" || d.note !== "" || Object.values(d.readingValues).some((v) => v !== ""));
                    const showResult = isCheckedToday && !isDirty;
                    const normal = todayRec?.status === "normal";

                    return (
                      <Card
                        key={instrument.id}
                        className={`shadow-sm transition-all ${
                          showResult ? (normal ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30") : ""
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Beaker className="w-4 h-4 text-primary" />
                              {instrument.name}
                            </CardTitle>
                            {showResult && todayRec && (
                              <Badge className={`text-xs gap-1 ${normal ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                                {normal ? <><CheckCircle2 className="w-3 h-3" /> ปกติ</> : <><AlertTriangle className="w-3 h-3" /> ผิดปกติ</>}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {instrument.id}{instrument.brand ? ` · ${instrument.brand}` : ""}
                          </p>
                          {showResult && todayRec && (
                            <p className="text-xs text-muted-foreground">ตรวจล่าสุด: {fmtTime(todayRec.checkedAt)} โดย {todayRec.recorder}</p>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* status */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะการทำงาน</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Button
                                type="button"
                                variant={d.status === "normal" ? "default" : "outline"}
                                className="h-8 text-xs gap-1"
                                disabled={createMutation.isPending}
                                onClick={() => setStatus(instrument.id, "normal")}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> ปกติ
                              </Button>
                              <Button
                                type="button"
                                variant={d.status === "abnormal" ? "destructive" : "outline"}
                                className="h-8 text-xs gap-1"
                                disabled={createMutation.isPending}
                                onClick={() => setStatus(instrument.id, "abnormal")}
                              >
                                <AlertTriangle className="w-3.5 h-3.5" /> ผิดปกติ
                              </Button>
                            </div>
                          </div>

                          {/* readings */}
                          {instrument.readings.map((f) => (
                            <div key={f.key}>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                {f.label}{f.unit ? ` (${f.unit})` : ""}
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder={showResult && todayRec ? String(todayRec.readings.find((r) => r.key === f.key)?.value ?? "") : f.label}
                                value={d.readingValues[f.key] ?? ""}
                                onChange={(e) => setReading(instrument.id, f.key, e.target.value)}
                                disabled={createMutation.isPending}
                                className="text-xs h-8"
                              />
                            </div>
                          ))}

                          {/* note */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">หมายเหตุ</label>
                            <Input
                              value={d.note}
                              placeholder={showResult && todayRec?.note ? todayRec.note : "—"}
                              onChange={(e) => setNote(instrument.id, e.target.value)}
                              disabled={createMutation.isPending}
                              className="text-xs h-8"
                            />
                          </div>

                          {/* recorder */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">ผู้บันทึก</label>
                            <Input value={user?.name ?? ""} readOnly disabled className="text-xs h-8 bg-muted/40" />
                          </div>

                          {showResult ? (
                            <Button variant="outline" className="w-full gap-2" onClick={() => handleRecheck(instrument.id)}>
                              <RotateCcw className="w-4 h-4" /> บันทึกซ้ำ
                            </Button>
                          ) : (
                            <Button
                              className="w-full gap-2"
                              onClick={() => handleSave(instrument.id)}
                              disabled={createMutation.isPending}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {createMutation.isPending && createMutation.variables?.instrumentId === instrument.id ? "กำลังบันทึก..." : "บันทึกผล"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base flex items-center gap-2">
                <List className="w-4 h-4 text-primary" />
                ประวัติการเช็กเครื่องมือ
              </CardTitle>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Filter className="w-3 h-3" /> วันที่
                  </label>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="h-8 text-xs w-[160px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">เครื่องมือ</label>
                  <Select value={filterInstrument} onValueChange={setFilterInstrument}>
                    <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {SAMPLE_PREP_INSTRUMENTS.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name} ({i.id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">สถานะ</label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "normal" | "abnormal")}>
                    <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="normal">ปกติ</SelectItem>
                      <SelectItem value="abnormal">ผิดปกติ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setFilterDate(todayStr());
                    setFilterInstrument("all");
                    setFilterStatus("all");
                  }}
                >
                  รีเซ็ตตัวกรอง
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">กำลังโหลด...</p>
              ) : historyRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">ไม่พบรายการในช่วงที่เลือก</p>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>เวลา</TableHead>
                        <TableHead>เครื่องมือ</TableHead>
                        <TableHead className="text-center">สถานะ</TableHead>
                        <TableHead className="text-center">ค่าที่วัด</TableHead>
                        <TableHead>หมายเหตุ</TableHead>
                        <TableHead>ผู้บันทึก</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRecords.map((h) => {
                        const normal = h.status === "normal";
                        return (
                          <TableRow key={h._id}>
                            <TableCell className="text-xs whitespace-nowrap">{fmtDate(h.date)}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{fmtTime(h.checkedAt)}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{h.instrumentName} <span className="text-muted-foreground">({h.instrumentId})</span></TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-xs ${normal ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                                {normal ? "ปกติ" : "ผิดปกติ"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-xs whitespace-nowrap">
                              {h.readings.length
                                ? h.readings.map((r) => `${r.label} ${r.value}${r.unit}`).join(", ")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs">{h.note || "—"}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{h.recorder}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
};

export default SamplePrepRoomPage;
```

- [ ] **Step 2: Wire the route in `src/App.tsx`**

Add the import next to the other daily-check page imports (after the `RoomPlaceholderPage` import, ~line 29):

```tsx
import SamplePrepRoomPage from "./pages/daily-check/SamplePrepRoomPage";
```

Replace the line:

```tsx
                <Route path="sample-prep" element={<RoomPlaceholderPage slug="sample-prep" />} />
```

with:

```tsx
                <Route path="sample-prep" element={<SamplePrepRoomPage />} />
```

- [ ] **Step 3: Flip the `ready` flag in `src/lib/dailyCheckRooms.ts`**

In the `room("sample-prep", "ห้องเตรียมตัวอย่าง", Beaker, [ ... ])` call, add `true` as the final argument so the room is no longer a placeholder:

```ts
  room("sample-prep", "ห้องเตรียมตัวอย่าง", Beaker, [
    "อุณหภูมิ/ความชื้น",
    "Ultrasonic / Ultrasonic Cleaner",
    "Asirator pump",
    "Desiccator",
    "Hotplate",
    "Magnetic stirrer",
    "Oven",
    "pH Meter",
    "Water bath",
    "milli-Q",
    "Hood",
    "Density",
  ], true),
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -- src/pages/daily-check/SamplePrepRoomPage.tsx src/App.tsx src/lib/dailyCheckRooms.ts
git commit -m "feat: add SamplePrepRoomPage + wire sample-prep route"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Lint + type-check + lib test**

Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run src/lib/samplePrepInstruments.test.ts
```
Expected: type-check clean, lint clean (no new errors in touched files), 7 tests pass.

- [ ] **Step 2: Manual walkthrough (both processes running)**

With `cd server && npm run dev` and `npm run dev` running, open `http://localhost:8000/LIS/daily-check/sample-prep` (dev auth on). Verify:
  1. Tab shows three groups (เครื่องมือทั่วไป / วัดอุณหภูมิ / วัด pH) with 8 / 4 / 1 cards.
  2. Saving a card with no status → toast "กรุณาเลือกสถานะ".
  3. Oven (LD-009) requires a numeric อุณหภูมิ; blank → toast asks for it.
  4. Save "ปกติ" → card turns green, header counts update (ตรวจแล้ว / ปกติ), toast success.
  5. Save "ผิดปกติ" on another → card red, ผิดปกติ badge.
  6. "บันทึกซ้ำ" re-opens the form.
  7. History tab lists today's rows; date/instrument/status filters narrow results; reset clears them.
  8. The Daily Check tab bar no longer shows sample-prep as "อยู่ระหว่างพัฒนา".

- [ ] **Step 3: Seed export (so new collection stays restorable)**

Run:
```bash
cd server && npm run seed:export
```
Then commit the refreshed seed-data (only if it changed):
```bash
git add -- server/seed-data/
git commit -m "chore: seed-export including equipmentchecks"
```

---

## Self-Review notes

- **Spec coverage:** model (Task 2), catalog (Task 1), route+mount (Task 3), api+types (Task 4), page+routing+ready flag (Task 5), test (Task 1), tsc/seed (Task 6) — every spec section maps to a task. Deferred items (milli-Q/Density/Hood, reviewer) intentionally excluded.
- **Type consistency:** `EquipmentReading`/`EquipmentCheckRecord`/`CreateEquipmentCheckPayload` (api.ts) match the model fields and the page's `createEquipmentCheck` payload; catalog `ReadingField` maps to `EquipmentReading` on save (key/label/unit from catalog, value parsed from input). `status` enum `"normal"|"abnormal"` consistent across model, route, api, page.
- **No placeholders:** all steps contain concrete code/commands.
