# Daily Check — Env (Temp/Humidity) Page + Documents Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single cross-room Temperature/Humidity daily-check page (3 rooms, sensor-prefilled + manually editable, with per-room pass/fail thresholds persisted to a new `EnvCheck` collection) plus a placeholder "โหลดเอกสาร" page, both wired into the existing Daily Check tab layout.

**Architecture:** New Mongoose model `EnvCheck` + route `/api/env-checks` mirroring the existing `DailyCheck`/`dailyChecks.js` pattern. A new `src/lib/dailyCheckEnv.ts` config holds per-room thresholds, board→room mapping, and a pure `evaluateEnv` helper (unit-tested). `EnvironmentCheckPage.tsx` reuses the `BalanceRoomPage` shape (record/history tabs, React Query, auth-derived recorder) and additionally polls the existing in-memory sensor endpoint `GET /temphum` to pre-fill values. `DocumentsPage.tsx` is a dashed placeholder. Tab strip and routing extended via a new `DAILY_CHECK_TABS` list.

**Tech Stack:** Express 4 + Mongoose 8 (backend), React 18 + TypeScript + Vite + TanStack React Query + shadcn/ui + sonner (frontend), Vitest (tests).

---

## File Structure

**Backend (create):**
- `server/models/EnvCheck.js` — daily temp/humidity check record (room, readings, thresholds snapshot, statuses, recorder, date)
- `server/routes/envChecks.js` — GET (filtered) / POST / GET summary-today

**Backend (modify):**
- `server/index.js:46` — mount `/env-checks` route

**Frontend (create):**
- `src/lib/dailyCheckEnv.ts` — `ENV_ROOMS` config + `evaluateEnv` + `getEnvRoom`
- `src/lib/dailyCheckEnv.test.ts` — unit tests for `evaluateEnv`
- `src/pages/daily-check/EnvironmentCheckPage.tsx` — the functional page
- `src/pages/daily-check/DocumentsPage.tsx` — placeholder
- `src/pages/daily-check/__tests__/EnvironmentCheckPage.test.tsx` — smoke test

**Frontend (modify):**
- `src/lib/api.ts` — add env-check + live-temphum endpoints and types
- `src/lib/dailyCheckRooms.ts` — add `DAILY_CHECK_TABS`
- `src/pages/daily-check/DailyCheckLayout.tsx` — drive tabs from `DAILY_CHECK_TABS`
- `src/App.tsx` — add `environment` + `documents` routes, change index redirect
- `src/lib/accessControl.ts` — extend `IMPLIED_CHILD_PATHS["/daily-check"]`

---

## Task 1: Backend model `EnvCheck`

**Files:**
- Create: `server/models/EnvCheck.js`

- [ ] **Step 1: Write the model**

```js
const mongoose = require('mongoose');

const EnvCheckSchema = new mongoose.Schema({
  room: { type: String, enum: ['balance', 'sample-prep', 'analysis'], required: true, index: true },
  roomName: { type: String, required: true },

  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },

  // snapshot ของเกณฑ์ที่ใช้ตอนบันทึก
  tempMin: { type: Number, required: true },
  tempMax: { type: Number, required: true },
  humidityMax: { type: Number, required: true },

  tempStatus: { type: String, enum: ['pass', 'fail'], required: true },
  humidityStatus: { type: String, enum: ['pass', 'fail'], required: true },
  status: { type: String, enum: ['pass', 'fail'], required: true, index: true },

  note: { type: String, default: '' },

  recorder: { type: String, required: true },
  recorderId: { type: String, default: '' },
  recorderEmail: { type: String, default: '' },

  // YYYY-MM-DD (filter ตามวันแบบเร็ว)
  date: { type: String, required: true, index: true },
  checkedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

EnvCheckSchema.index({ date: -1, room: 1 });

module.exports = mongoose.model('EnvCheck', EnvCheckSchema);
```

- [ ] **Step 2: Verify it loads without error**

Run: `node -e "require('./server/models/EnvCheck'); console.log('ok')"`
Expected: prints `ok` (no schema/syntax error)

- [ ] **Step 3: Commit**

```bash
git add server/models/EnvCheck.js
git commit -m "feat(env-check): add EnvCheck model for daily temp/humidity"
```

---

## Task 2: Backend route `envChecks.js`

**Files:**
- Create: `server/routes/envChecks.js`
- Modify: `server/index.js:46`

- [ ] **Step 1: Write the route**

```js
const express = require('express');
const router = express.Router();
const EnvCheck = require('../models/EnvCheck');

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const evalTemp = (t, min, max) => (t >= min && t <= max ? 'pass' : 'fail');
const evalHum = (h, max) => (h <= max ? 'pass' : 'fail');

// GET /api/env-checks
// Query: ?date=YYYY-MM-DD|all | ?from=&to= | ?room= | ?status=pass|fail ; default today
router.get('/', async (req, res) => {
  try {
    const { date, from, to, room, status } = req.query;
    const q = {};
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = String(from);
      if (to) q.date.$lte = String(to);
    } else if (date === 'all') {
      // no date filter
    } else {
      q.date = date ? String(date) : todayStr();
    }
    if (room) q.room = String(room);
    if (status) q.status = String(status);

    const records = await EnvCheck.find(q).sort({ checkedAt: -1 }).lean();
    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/env-checks
router.post('/', async (req, res) => {
  try {
    const {
      room, roomName, temperature, humidity,
      tempMin, tempMax, humidityMax,
      note, recorder, recorderId, recorderEmail,
    } = req.body;

    if (!room || !roomName) {
      return res.status(400).json({ error: 'room และ roomName ต้องระบุ' });
    }
    if (typeof temperature !== 'number' || typeof humidity !== 'number') {
      return res.status(400).json({ error: 'temperature และ humidity ต้องเป็นตัวเลข' });
    }
    if (typeof tempMin !== 'number' || typeof tempMax !== 'number' || typeof humidityMax !== 'number') {
      return res.status(400).json({ error: 'เกณฑ์ tempMin/tempMax/humidityMax ต้องเป็นตัวเลข' });
    }
    if (!recorder || !String(recorder).trim()) {
      return res.status(400).json({ error: 'recorder ต้องระบุ' });
    }

    const tempStatus = evalTemp(temperature, tempMin, tempMax);
    const humidityStatus = evalHum(humidity, humidityMax);
    const status = (tempStatus === 'pass' && humidityStatus === 'pass') ? 'pass' : 'fail';

    const created = await EnvCheck.create({
      room, roomName, temperature, humidity,
      tempMin, tempMax, humidityMax,
      tempStatus, humidityStatus, status,
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

// GET /api/env-checks/summary/today
router.get('/summary/today', async (req, res) => {
  try {
    const date = todayStr();
    const records = await EnvCheck.find({ date }).lean();
    const rooms = [...new Set(records.map(r => r.room))];
    res.json({
      data: {
        date,
        count: records.length,
        rooms,
        allPass: records.length > 0 && records.every(r => r.status === 'pass'),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount the route**

In `server/index.js`, after line 46 (`mountApi('/temphum', require('./routes/temphum'));`) add:

```js
mountApi('/env-checks', require('./routes/envChecks'));
```

- [ ] **Step 3: Verify route module loads**

Run: `node -e "require('./server/routes/envChecks'); console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 4: Commit**

```bash
git add server/routes/envChecks.js server/index.js
git commit -m "feat(env-check): add /env-checks route (list/create/summary)"
```

---

## Task 3: Frontend config + `evaluateEnv` helper (TDD)

**Files:**
- Create: `src/lib/dailyCheckEnv.ts`
- Test: `src/lib/dailyCheckEnv.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ENV_ROOMS, evaluateEnv, getEnvRoom } from "./dailyCheckEnv";

const room = ENV_ROOMS[0]; // tempMin 15, tempMax 25, humidityMax 70

describe("evaluateEnv", () => {
  it("passes when temp within range and humidity at/under max", () => {
    expect(evaluateEnv(22, 55, room)).toEqual({
      tempStatus: "pass",
      humidityStatus: "pass",
      status: "pass",
    });
  });

  it("treats range bounds as inclusive", () => {
    expect(evaluateEnv(15, 70, room).status).toBe("pass");
    expect(evaluateEnv(25, 70, room).status).toBe("pass");
  });

  it("fails temperature below min", () => {
    const r = evaluateEnv(14.9, 50, room);
    expect(r.tempStatus).toBe("fail");
    expect(r.status).toBe("fail");
  });

  it("fails temperature above max", () => {
    const r = evaluateEnv(25.1, 50, room);
    expect(r.tempStatus).toBe("fail");
    expect(r.status).toBe("fail");
  });

  it("fails humidity above max", () => {
    const r = evaluateEnv(22, 70.1, room);
    expect(r.humidityStatus).toBe("fail");
    expect(r.status).toBe("fail");
  });
});

describe("getEnvRoom", () => {
  it("returns the room config by slug", () => {
    expect(getEnvRoom("analysis")?.label).toBe("ห้องวิเคราะห์");
  });
  it("returns undefined for unknown slug", () => {
    expect(getEnvRoom("nope")).toBeUndefined();
  });
});

describe("ENV_ROOMS", () => {
  it("covers exactly the 3 rooms with a temp/humidity form", () => {
    expect(ENV_ROOMS.map((r) => r.slug)).toEqual(["balance", "sample-prep", "analysis"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/dailyCheckEnv.test.ts`
Expected: FAIL — cannot resolve `./dailyCheckEnv`

- [ ] **Step 3: Write the config + helper**

```ts
export type EnvStatus = "pass" | "fail";

export interface EnvRoom {
  /** slug matching the daily-check room */
  slug: "balance" | "sample-prep" | "analysis";
  /** Thai room name shown on the env page */
  label: string;
  /** Node-RED board id that monitors this room. "" = unmapped → manual entry only. */
  boardId: string;
  tempMin: number;     // °C inclusive lower bound
  tempMax: number;     // °C inclusive upper bound
  humidityMax: number; // %RH inclusive upper bound
}

// ปรับ boardId ให้ตรงบอร์ดจริง และปรับเกณฑ์ได้ที่นี่ไฟล์เดียว
export const ENV_ROOMS: EnvRoom[] = [
  { slug: "balance",     label: "ห้องชั่งสาร",       boardId: "", tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: "sample-prep", label: "ห้องเตรียมตัวอย่าง", boardId: "", tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: "analysis",    label: "ห้องวิเคราะห์",      boardId: "", tempMin: 15, tempMax: 25, humidityMax: 70 },
];

export const getEnvRoom = (slug: string): EnvRoom | undefined =>
  ENV_ROOMS.find((r) => r.slug === slug);

export interface EnvEvaluation {
  tempStatus: EnvStatus;
  humidityStatus: EnvStatus;
  status: EnvStatus;
}

export const evaluateEnv = (
  temperature: number,
  humidity: number,
  room: Pick<EnvRoom, "tempMin" | "tempMax" | "humidityMax">,
): EnvEvaluation => {
  const tempStatus: EnvStatus =
    temperature >= room.tempMin && temperature <= room.tempMax ? "pass" : "fail";
  const humidityStatus: EnvStatus = humidity <= room.humidityMax ? "pass" : "fail";
  const status: EnvStatus =
    tempStatus === "pass" && humidityStatus === "pass" ? "pass" : "fail";
  return { tempStatus, humidityStatus, status };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/dailyCheckEnv.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dailyCheckEnv.ts src/lib/dailyCheckEnv.test.ts
git commit -m "feat(env-check): add per-room env config + evaluateEnv helper"
```

---

## Task 4: Frontend API endpoints + types

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add the API methods**

In `src/lib/api.ts`, inside the `api` object after the existing `getDailyCheckTodaySummary` method (around line 210), add:

```ts
  // Env Check (อุณหภูมิ/ความชื้น ประจำวัน)
  getEnvChecks: (params?: {
    date?: string;          // YYYY-MM-DD หรือ "all"
    from?: string;
    to?: string;
    room?: string;
    status?: "pass" | "fail";
  }) => {
    const qs = params
      ? "?" + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return request<{ data: EnvCheckRecord[] }>(`/env-checks${qs}`).then(r => r.data);
  },
  createEnvCheck: (data: CreateEnvCheckPayload) =>
    request<{ data: EnvCheckRecord }>("/env-checks", {
      method: "POST",
      body: JSON.stringify(data),
    }).then(r => r.data),
  getEnvCheckTodaySummary: () =>
    request<{ data: EnvCheckTodaySummary }>("/env-checks/summary/today").then(r => r.data),
  // ค่าสดจากเซนเซอร์ Node-RED (in-memory; [] เมื่อไม่มีค่า)
  getLiveTempHum: () => request<LiveTempHum[]>("/temphum"),
```

- [ ] **Step 2: Add the types**

In `src/lib/api.ts`, after the `DailyCheckTodaySummary` type block (around line 338, end of file region before the final lines), add:

```ts
export type EnvCheckRecord = {
  _id?: string;
  room: "balance" | "sample-prep" | "analysis";
  roomName: string;
  temperature: number;
  humidity: number;
  tempMin: number;
  tempMax: number;
  humidityMax: number;
  tempStatus: "pass" | "fail";
  humidityStatus: "pass" | "fail";
  status: "pass" | "fail";
  note?: string;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
  date: string;       // YYYY-MM-DD
  checkedAt: string;  // ISO
  createdAt?: string;
  updatedAt?: string;
};

export type CreateEnvCheckPayload = {
  room: "balance" | "sample-prep" | "analysis";
  roomName: string;
  temperature: number;
  humidity: number;
  tempMin: number;
  tempMax: number;
  humidityMax: number;
  note?: string;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
};

export type EnvCheckTodaySummary = {
  date: string;
  count: number;
  rooms: string[];
  allPass: boolean;
};

export type LiveTempHum = {
  board: string;
  temp?: number;
  hum?: number;
  receivedAt?: string; // ISO
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `api.ts` / the new types

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(env-check): add env-check + live temphum API methods and types"
```

---

## Task 5: `EnvironmentCheckPage` (functional page)

**Files:**
- Create: `src/pages/daily-check/EnvironmentCheckPage.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Thermometer, Droplets, CheckCircle2, Clock, RotateCcw,
  List, ClipboardList, Filter, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api, type EnvCheckRecord, type LiveTempHum } from "@/lib/api";
import { ENV_ROOMS, evaluateEnv, type EnvRoom } from "@/lib/dailyCheckEnv";
import { useAuth } from "@/context/AuthContext";

interface EnvDraft {
  temperature: string;
  humidity: string;
  note: string;
  prefilledFrom?: string; // receivedAt ของค่าสดที่ pre-fill ไว้ (กันการ pre-fill ซ้ำ)
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
const emptyDraft = (): EnvDraft => ({ temperature: "", humidity: "", note: "" });

const EnvironmentCheckPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayLabel = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  const [drafts, setDrafts] = useState<Record<string, EnvDraft>>({});

  const [filterDate, setFilterDate] = useState<string>(todayStr());
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pass" | "fail">("all");

  const { data: todayRecords = [] } = useQuery({
    queryKey: ["env-checks", "today"],
    queryFn: () => api.getEnvChecks({ date: todayStr() }),
    refetchOnWindowFocus: true,
  });

  const { data: liveReadings = [] } = useQuery({
    queryKey: ["temphum", "live"],
    queryFn: api.getLiveTempHum,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: historyRecords = [], isLoading: historyLoading } = useQuery({
    queryKey: ["env-checks", "history", filterDate, filterRoom, filterStatus],
    queryFn: () =>
      api.getEnvChecks({
        date: filterDate || todayStr(),
        room: filterRoom === "all" ? undefined : filterRoom,
        status: filterStatus === "all" ? undefined : filterStatus,
      }),
  });

  const liveByBoard = useMemo(() => {
    const map: Record<string, LiveTempHum> = {};
    for (const r of liveReadings) map[r.board] = r;
    return map;
  }, [liveReadings]);

  const latestByRoom = useMemo(() => {
    const map: Record<string, EnvCheckRecord> = {};
    for (const r of todayRecords) if (!map[r.room]) map[r.room] = r;
    return map;
  }, [todayRecords]);

  const liveForRoom = (room: EnvRoom): LiveTempHum | undefined =>
    room.boardId ? liveByBoard[room.boardId] : undefined;

  const getDraft = (room: EnvRoom): EnvDraft => {
    const existing = drafts[room.slug];
    if (existing) return existing;
    // pre-fill ครั้งแรกจากค่าสด (ถ้ามี)
    const live = liveForRoom(room);
    if (live && (live.temp != null || live.hum != null)) {
      return {
        temperature: live.temp != null ? String(live.temp) : "",
        humidity: live.hum != null ? String(live.hum) : "",
        note: "",
        prefilledFrom: live.receivedAt,
      };
    }
    return emptyDraft();
  };

  const setField = (slug: string, patch: Partial<EnvDraft>) =>
    setDrafts((prev) => ({ ...prev, [slug]: { ...(prev[slug] ?? emptyDraft()), ...patch } }));

  const pullLatest = (room: EnvRoom) => {
    const live = liveForRoom(room);
    if (!live) {
      toast.error("ยังไม่มีค่าจากเซนเซอร์");
      return;
    }
    setField(room.slug, {
      temperature: live.temp != null ? String(live.temp) : "",
      humidity: live.hum != null ? String(live.hum) : "",
      prefilledFrom: live.receivedAt,
    });
  };

  const createMutation = useMutation({
    mutationFn: api.createEnvCheck,
    onSuccess: (_data, vars) => {
      const room = ENV_ROOMS.find((r) => r.slug === vars.room)!;
      const pass = evaluateEnv(vars.temperature, vars.humidity, room).status === "pass";
      if (pass) toast.success(`${room.label} อยู่ในเกณฑ์`);
      else toast.warning(`${room.label} เกินเกณฑ์`);
      queryClient.invalidateQueries({ queryKey: ["env-checks"] });
      setDrafts((prev) => {
        const c = { ...prev };
        delete c[vars.room];
        return c;
      });
    },
    onError: (err: Error) => toast.error(err.message || "บันทึกไม่สำเร็จ"),
  });

  const handleSave = (room: EnvRoom) => {
    const d = getDraft(room);
    if (d.temperature === "" || d.humidity === "") {
      toast.error("กรุณากรอกอุณหภูมิและความชื้น");
      return;
    }
    const temperature = parseFloat(d.temperature);
    const humidity = parseFloat(d.humidity);
    if (isNaN(temperature) || isNaN(humidity)) {
      toast.error("ค่าอุณหภูมิ/ความชื้นไม่ถูกต้อง");
      return;
    }
    if (!user?.name) {
      toast.error("ไม่พบชื่อผู้ใช้งานปัจจุบัน");
      return;
    }
    createMutation.mutate({
      room: room.slug,
      roomName: room.label,
      temperature,
      humidity,
      tempMin: room.tempMin,
      tempMax: room.tempMax,
      humidityMax: room.humidityMax,
      note: d.note.trim(),
      recorder: user.name,
      recorderId: user.id,
      recorderEmail: user.email,
    });
  };

  const handleRecheck = (slug: string) =>
    setDrafts((prev) => ({ ...prev, [slug]: emptyDraft() }));

  const checkedCount = Object.keys(latestByRoom).length;
  const passCount = Object.values(latestByRoom).filter((r) => r.status === "pass").length;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            อุณหภูมิ/ความชื้น — ตรวจประจำวัน
          </h2>
          <p className="text-sm text-muted-foreground">ประจำวัน — {todayLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="text-sm gap-1 py-1 px-3">
            <Clock className="w-3.5 h-3.5" /> ตรวจแล้ว {checkedCount}/{ENV_ROOMS.length}
          </Badge>
          <Badge className="text-sm gap-1 py-1 px-3 bg-green-100 text-green-700 border-green-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> ผ่าน {passCount}/{ENV_ROOMS.length}
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

        <TabsContent value="check">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {ENV_ROOMS.map((room) => {
              const todayRec = latestByRoom[room.slug];
              const d = getDraft(room);
              const live = liveForRoom(room);
              const isCheckedToday = !!todayRec;
              const dirty = !!drafts[room.slug] && (drafts[room.slug].temperature !== "" || drafts[room.slug].humidity !== "");
              const showResult = isCheckedToday && !dirty;
              const allPass = todayRec?.status === "pass";

              const tNum = parseFloat(d.temperature);
              const hNum = parseFloat(d.humidity);
              const liveEval =
                !showResult && !isNaN(tNum) && !isNaN(hNum)
                  ? evaluateEnv(tNum, hNum, room)
                  : null;
              const outOfRange = liveEval?.status === "fail";

              return (
                <Card
                  key={room.slug}
                  className={`shadow-sm transition-all ${
                    showResult ? (allPass ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30") : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-primary" />
                        {room.label}
                      </CardTitle>
                      {showResult && todayRec && (
                        <Badge className={`text-xs gap-1 ${allPass ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                          {allPass ? <><CheckCircle2 className="w-3 h-3" /> ผ่าน</> : "ไม่ผ่าน"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      เกณฑ์ {room.tempMin}–{room.tempMax}°C / ≤{room.humidityMax}%RH
                    </p>
                    {showResult && todayRec && (
                      <p className="text-xs text-muted-foreground">
                        ตรวจล่าสุด: {fmtTime(todayRec.checkedAt)} โดย {todayRec.recorder}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* แหล่งค่า */}
                    {!showResult && (
                      <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Radio className={`w-3.5 h-3.5 ${live ? "text-green-500" : "text-muted-foreground/50"}`} />
                          {live
                            ? `เซนเซอร์ • อัปเดต ${live.receivedAt ? fmtTime(live.receivedAt) : "-"}`
                            : "ไม่มีเซนเซอร์ — กรอกเอง"}
                        </span>
                        {live && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => pullLatest(room)}>
                            ดึงค่าล่าสุด
                          </Button>
                        )}
                      </div>
                    )}

                    {/* อุณหภูมิ */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5" /> อุณหภูมิ (°C)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={showResult && todayRec ? String(todayRec.temperature) : "เช่น 22.5"}
                        value={d.temperature}
                        onChange={(e) => setField(room.slug, { temperature: e.target.value })}
                        disabled={createMutation.isPending}
                        className="text-sm h-9"
                      />
                    </div>

                    {/* ความชื้น */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5" /> ความชื้น (%RH)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={showResult && todayRec ? String(todayRec.humidity) : "เช่น 55"}
                        value={d.humidity}
                        onChange={(e) => setField(room.slug, { humidity: e.target.value })}
                        disabled={createMutation.isPending}
                        className="text-sm h-9"
                      />
                    </div>

                    {liveEval && (
                      <p className={`text-xs ${liveEval.status === "pass" ? "text-green-600" : "text-red-600"}`}>
                        {liveEval.status === "pass" ? "อยู่ในเกณฑ์" : "เกินเกณฑ์"}
                        {liveEval.tempStatus === "fail" ? " • อุณหภูมิ" : ""}
                        {liveEval.humidityStatus === "fail" ? " • ความชื้น" : ""}
                      </p>
                    )}

                    {/* หมายเหตุ (แนะนำเมื่อเกินเกณฑ์) */}
                    {!showResult && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          หมายเหตุ {outOfRange && <span className="text-red-500">(ควรระบุการแก้ไขเมื่อเกินเกณฑ์)</span>}
                        </label>
                        <Textarea
                          rows={2}
                          placeholder="บันทึกเพิ่มเติม / การแก้ไข"
                          value={d.note}
                          onChange={(e) => setField(room.slug, { note: e.target.value })}
                          disabled={createMutation.isPending}
                          className="text-sm"
                        />
                      </div>
                    )}

                    {showResult && todayRec?.note && (
                      <p className="text-xs text-muted-foreground">หมายเหตุ: {todayRec.note}</p>
                    )}

                    {/* ผู้บันทึก */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ผู้บันทึก</label>
                      <Input value={user?.name ?? ""} readOnly disabled className="text-xs h-8 bg-muted/40" />
                    </div>

                    {showResult ? (
                      <Button variant="outline" className="w-full gap-2" onClick={() => handleRecheck(room.slug)}>
                        <RotateCcw className="w-4 h-4" /> บันทึกซ้ำ
                      </Button>
                    ) : (
                      <Button
                        className="w-full gap-2"
                        onClick={() => handleSave(room)}
                        disabled={createMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {createMutation.isPending && createMutation.variables?.room === room.slug ? "กำลังบันทึก..." : "บันทึกผล"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base flex items-center gap-2">
                <List className="w-4 h-4 text-primary" />
                ประวัติการตรวจอุณหภูมิ/ความชื้น
              </CardTitle>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Filter className="w-3 h-3" /> วันที่
                  </label>
                  <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-8 text-xs w-[160px]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">ห้อง</label>
                  <Select value={filterRoom} onValueChange={setFilterRoom}>
                    <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {ENV_ROOMS.map((r) => (
                        <SelectItem key={r.slug} value={r.slug}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">สถานะ</label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "pass" | "fail")}>
                    <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="pass">ผ่าน</SelectItem>
                      <SelectItem value="fail">ไม่ผ่าน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setFilterDate(todayStr()); setFilterRoom("all"); setFilterStatus("all"); }}
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
                        <TableHead>ห้อง</TableHead>
                        <TableHead className="text-center">อุณหภูมิ (°C)</TableHead>
                        <TableHead className="text-center">ความชื้น (%RH)</TableHead>
                        <TableHead className="text-center">สถานะ</TableHead>
                        <TableHead>หมายเหตุ</TableHead>
                        <TableHead>ผู้บันทึก</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRecords.map((h) => {
                        const allPass = h.status === "pass";
                        return (
                          <TableRow key={h._id}>
                            <TableCell className="text-xs whitespace-nowrap">{fmtDate(h.date)}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{fmtTime(h.checkedAt)}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{h.roomName}</TableCell>
                            <TableCell className={`text-center text-xs font-semibold ${h.tempStatus === "pass" ? "text-green-600" : "text-red-600"}`}>
                              {h.temperature}
                            </TableCell>
                            <TableCell className={`text-center text-xs font-semibold ${h.humidityStatus === "pass" ? "text-green-600" : "text-red-600"}`}>
                              {h.humidity}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-xs ${allPass ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                                {allPass ? "ผ่าน" : "ไม่ผ่าน"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[180px] truncate">{h.note || "-"}</TableCell>
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

export default EnvironmentCheckPage;
```

- [ ] **Step 2: Verify `Textarea` primitive exists**

Run: `ls src/components/ui/textarea.tsx`
Expected: file exists (shadcn primitive). If missing, the import must be adjusted — but it ships with this project's shadcn set.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `EnvironmentCheckPage.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/pages/daily-check/EnvironmentCheckPage.tsx
git commit -m "feat(env-check): add EnvironmentCheckPage (sensor-prefilled, manual override)"
```

---

## Task 6: `DocumentsPage` placeholder

**Files:**
- Create: `src/pages/daily-check/DocumentsPage.tsx`

- [ ] **Step 1: Write the placeholder**

```tsx
import { Construction, FileDown, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DocumentsPage = () => (
  <div className="mx-auto max-w-2xl space-y-4">
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Construction className="h-4 w-4 text-amber-500" />
          โหลดเอกสาร — อยู่ระหว่างพัฒนา
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          หน้านี้จะใช้โหลด/พิมพ์บันทึก Daily Check ที่กรอกแล้วออกมาเป็นเอกสารตามฟอร์มต้นฉบับ
        </p>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2 text-sm text-muted-foreground/80">
            <FileDown className="h-3.5 w-3.5 shrink-0" /> ดาวน์โหลดบันทึกที่กรอกแล้ว (PDF/ไฟล์ฟอร์ม)
          </li>
          <li className="flex items-center gap-2 text-sm text-muted-foreground/80">
            <Printer className="h-3.5 w-3.5 shrink-0" /> พิมพ์รายงานตามช่วงวันที่/ห้อง
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
);

export default DocumentsPage;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/daily-check/DocumentsPage.tsx
git commit -m "feat(daily-check): add Documents page scaffold (download/print placeholder)"
```

---

## Task 7: Tab config + layout wiring

**Files:**
- Modify: `src/lib/dailyCheckRooms.ts`
- Modify: `src/pages/daily-check/DailyCheckLayout.tsx`

- [ ] **Step 1: Add `DAILY_CHECK_TABS` to the config**

At the end of `src/lib/dailyCheckRooms.ts` (after `getRoomBySlug`), add. Note: `Thermometer` and `FileDown` must be added to the existing `lucide-react` import at the top of the file (currently `import { Beaker, FlaskConical, Microscope, Scale } from "lucide-react";`).

```ts
export interface DailyCheckTab {
  route: string;
  label: string;
  icon: LucideIcon;
}

// ลำดับแท็บ: อุณหภูมิ/ความชื้น (รวมทุกห้อง) → ห้องแยก → โหลดเอกสาร
export const DAILY_CHECK_TABS: DailyCheckTab[] = [
  { route: `${DAILY_CHECK_BASE}/environment`, label: "อุณหภูมิ/ความชื้น", icon: Thermometer },
  ...DAILY_CHECK_ROOMS.map((r) => ({ route: r.route, label: r.label, icon: r.icon })),
  { route: `${DAILY_CHECK_BASE}/documents`, label: "โหลดเอกสาร", icon: FileDown },
];
```

Update the top import line to:

```ts
import { Beaker, FileDown, FlaskConical, Microscope, Scale, Thermometer } from "lucide-react";
```

- [ ] **Step 2: Drive the layout tab strip from `DAILY_CHECK_TABS`**

In `src/pages/daily-check/DailyCheckLayout.tsx`, change the import and `TABS` const:

Replace:
```ts
import { DAILY_CHECK_ROOMS } from "@/lib/dailyCheckRooms";

const TABS = DAILY_CHECK_ROOMS.map((r) => ({ route: r.route, label: r.label, icon: r.icon }));
```
with:
```ts
import { DAILY_CHECK_TABS } from "@/lib/dailyCheckRooms";

const TABS = DAILY_CHECK_TABS;
```

(The `.map` over `TABS` in JSX already uses `{ route, label, icon }`, so no other change is needed.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/dailyCheckRooms.ts src/pages/daily-check/DailyCheckLayout.tsx
git commit -m "feat(daily-check): add env + documents tabs to layout strip"
```

---

## Task 8: Routes + access control

**Files:**
- Modify: `src/App.tsx:80-86`
- Modify: `src/lib/accessControl.ts:18-23`

- [ ] **Step 1: Add the page imports in `App.tsx`**

After the existing daily-check imports (lines 27-29), add:

```ts
import EnvironmentCheckPage from "./pages/daily-check/EnvironmentCheckPage";
import DocumentsPage from "./pages/daily-check/DocumentsPage";
```

- [ ] **Step 2: Add routes + change index redirect**

Replace the daily-check route block (`src/App.tsx:80-86`) with:

```tsx
              <Route path="/daily-check" element={<PrivateRoute><DailyCheckLayout /></PrivateRoute>}>
                <Route index element={<Navigate to="/daily-check/environment" replace />} />
                <Route path="environment" element={<EnvironmentCheckPage />} />
                <Route path="balance" element={<BalanceRoomPage />} />
                <Route path="sample-prep" element={<RoomPlaceholderPage slug="sample-prep" />} />
                <Route path="analysis" element={<RoomPlaceholderPage slug="analysis" />} />
                <Route path="extraction" element={<RoomPlaceholderPage slug="extraction" />} />
                <Route path="documents" element={<DocumentsPage />} />
              </Route>
```

- [ ] **Step 3: Extend implied child paths**

In `src/lib/accessControl.ts`, update the `"/daily-check"` entry of `IMPLIED_CHILD_PATHS` (lines 18-23) to include the two new paths:

```ts
  "/daily-check": [
    "/daily-check/environment",
    "/daily-check/balance",
    "/daily-check/sample-prep",
    "/daily-check/analysis",
    "/daily-check/extraction",
    "/daily-check/documents",
  ],
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/lib/accessControl.ts
git commit -m "feat(daily-check): wire env/documents routes + access-control children"
```

---

## Task 9: Smoke test for `EnvironmentCheckPage`

**Files:**
- Create: `src/pages/daily-check/__tests__/EnvironmentCheckPage.test.tsx`

- [ ] **Step 1: Inspect an existing daily-check test for the harness pattern**

Run: `ls src/pages/daily-check/__tests__/`
Read whichever test file exists there to copy its provider/mocking setup (QueryClient wrapper, `api`/`useAuth` mocks). Mirror that exact setup — do not invent a new one.

- [ ] **Step 2: Write the smoke test**

Use the same providers/mocks as the existing test in that folder. The test must mock `@/lib/api` (`getEnvChecks` → `[]`, `getLiveTempHum` → `[]`) and `@/context/AuthContext` `useAuth` → `{ user: { name: "Tester", id: "t1", email: "t@x.com" } }`, render inside a `QueryClientProvider`, and assert the 3 room labels appear.

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EnvironmentCheckPage from "../EnvironmentCheckPage";

vi.mock("@/lib/api", () => ({
  api: {
    getEnvChecks: vi.fn().mockResolvedValue([]),
    getLiveTempHum: vi.fn().mockResolvedValue([]),
    createEnvCheck: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Tester", id: "t1", email: "t@x.com" } }),
}));

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EnvironmentCheckPage />
    </QueryClientProvider>,
  );
};

describe("EnvironmentCheckPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a card for each of the 3 env rooms", () => {
    renderPage();
    expect(screen.getByText("ห้องชั่งสาร")).toBeInTheDocument();
    expect(screen.getByText("ห้องเตรียมตัวอย่าง")).toBeInTheDocument();
    expect(screen.getByText("ห้องวิเคราะห์")).toBeInTheDocument();
  });

  it("shows the record/history tabs", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /บันทึกผล/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /รายการบันทึก/ })).toBeInTheDocument();
  });
});
```

> If the existing folder test imports something extra (e.g. a custom render helper or `matchMedia` mock in `src/test/setup.ts`), reuse it instead of the bare wrapper above.

- [ ] **Step 3: Run the test**

Run: `npm run test -- src/pages/daily-check/__tests__/EnvironmentCheckPage.test.tsx`
Expected: PASS (both cases). If the room labels render but assertions fail on duplicates, scope queries with `getAllByText` — but labels are unique here.

- [ ] **Step 4: Commit**

```bash
git add src/pages/daily-check/__tests__/EnvironmentCheckPage.test.tsx
git commit -m "test(env-check): smoke-test EnvironmentCheckPage renders 3 rooms + tabs"
```

---

## Task 10: Full verification

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors in the created/modified files

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (existing + the new `dailyCheckEnv` and `EnvironmentCheckPage` tests)

- [ ] **Step 4: Manual smoke (requires backend on :3001 + `npm run dev`)**

1. Start backend: `cd server && npm run dev`
2. Start frontend: `npm run dev`
3. Visit `/LIS/daily-check` → should redirect to `/daily-check/environment`
4. Tab strip shows: อุณหภูมิ/ความชื้น · เครื่องชั่ง · เตรียมตัวอย่าง · วิเคราะห์ · สกัด · โหลดเอกสาร
5. On the env page: each room card shows "ไม่มีเซนเซอร์ — กรอกเอง" (no boards mapped yet); enter temp/humidity → live pass/fail hint updates; save → toast + appears under "รายการบันทึก"
6. Visit `/daily-check/documents` → placeholder card renders

- [ ] **Step 5: Export seed-data (new collection) + commit**

Per project rule (new model `EnvCheck` adds a collection), refresh the seed-data backup so it tracks the new collection:

Run: `cd server && npm run seed:export`
Then:
```bash
git add server/seed-data
git commit -m "chore(seed): export seed-data including envchecks collection"
```

> If `seed:export` requires a running MongoDB and none is available in this environment, skip this step and note it — `auto-sync.ps1` will export on the prod box on its next cycle.

---

## Notes for the implementer

- **DRY:** `EnvironmentCheckPage` deliberately mirrors `BalanceRoomPage` structure (tabs, drafts map, latest-by-key memo, mutation+invalidate). Keep the same idioms so the two pages read alike.
- **YAGNI:** No board→room config UI, no DB-backed thresholds, no `/temphum/save` call, no humidity lower-bound — all explicitly out of scope per the spec.
- **boardId is empty by default.** The page must work with `boardId: ""` (falls back to manual). Do not block saving when there is no sensor.
- **Server computes status authoritatively** in the POST handler; the client `evaluateEnv` is only for the live UI hint. Both use the same inclusive-bounds rule — keep them in sync.
- **Concurrent committers:** other processes sometimes commit on `develop`. Always `git add` with explicit pathspecs (as written above), never `git add -A`.
