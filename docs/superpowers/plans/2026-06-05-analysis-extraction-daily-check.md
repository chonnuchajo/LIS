# Analysis + Extraction Room Daily Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปิดใช้ Daily Check (เช็กการทำงานเครื่องมือประจำวัน) สำหรับห้องวิเคราะห์ (7 เครื่อง GC/HPLC) และห้องสกัด (10 เครื่อง) โดยรวมหน้าเพจของทั้ง 3 ห้อง (รวม sample-prep เดิม) เป็น component กลางตัวเดียว

**Architecture:** Backend (`EquipmentCheck` model + route + API client) เป็น generic keyed by `roomSlug` อยู่แล้ว — ไม่ต้องแก้. เพิ่ม (1) catalog ของเครื่องมือต่อห้อง + registry, (2) `RoomEquipmentCheckPage` รับ prop `roomSlug` ดึง catalog จาก registry, (3) wire routes + ตั้ง `ready: true`. `SamplePrepRoomPage` ถูกแทนที่ด้วย component กลาง

**Tech Stack:** React 18 + TypeScript + Vite + TanStack React Query + shadcn/ui + Vitest

อ้างอิง spec: `docs/superpowers/specs/2026-06-05-analysis-extraction-daily-check-design.md`

---

## File Structure

**สร้างใหม่:**
- `src/lib/analysisInstruments.ts` — catalog ห้องวิเคราะห์ (7 เครื่อง, กลุ่ม gc/hplc)
- `src/lib/extractionInstruments.ts` — catalog ห้องสกัด (10 เครื่อง, กลุ่ม basic/temp)
- `src/lib/roomEquipment.ts` — shared types (`ReadingField`, `RoomInstrument`, `RoomGroup`, `RoomCatalog`) + registry `ROOM_CATALOGS` + `getRoomCatalog`
- `src/lib/roomEquipment.test.ts` — test registry + catalog ห้องใหม่
- `src/pages/daily-check/RoomEquipmentCheckPage.tsx` — หน้าเพจกลาง (generalize จาก SamplePrepRoomPage)

**แก้ไข:**
- `src/App.tsx` — swap 3 routes ใช้ component กลาง
- `src/lib/dailyCheckRooms.ts` — analysis & extraction → `ready: true`
- `src/lib/dailyCheckRooms.test.ts` — แก้ test "ready set"

**ลบ:**
- `src/pages/daily-check/SamplePrepRoomPage.tsx`

**ไม่แตะ:** `src/lib/samplePrepInstruments.ts` + `samplePrepInstruments.test.ts` (โครงสร้าง type เข้ากันได้แบบ structural — registry อ้างถึงได้เลย)

---

## Task 1: Room equipment catalogs + registry

**Files:**
- Create: `src/lib/analysisInstruments.ts`
- Create: `src/lib/extractionInstruments.ts`
- Create: `src/lib/roomEquipment.ts`
- Create: `src/lib/roomEquipment.test.ts`

- [ ] **Step 1: เขียน test ก่อน** — `src/lib/roomEquipment.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { getRoomCatalog, ROOM_CATALOGS } from "./roomEquipment";
import { getRoomBySlug } from "./dailyCheckRooms";

describe("roomEquipment registry", () => {
  it("registers sample-prep, analysis, extraction catalogs", () => {
    for (const slug of ["sample-prep", "analysis", "extraction"]) {
      const cat = getRoomCatalog(slug);
      expect(cat).toBeDefined();
      expect(cat!.slug).toBe(slug);
      expect(getRoomBySlug(slug)).toBeDefined();
    }
  });

  it("returns undefined for unknown slug", () => {
    expect(getRoomCatalog("nope")).toBeUndefined();
  });

  it("every instrument's group is declared in its catalog groups", () => {
    for (const cat of Object.values(ROOM_CATALOGS)) {
      const keys = cat.groups.map((g) => g.key);
      for (const inst of cat.instruments) expect(keys).toContain(inst.group);
    }
  });
});

describe("analysis catalog", () => {
  const cat = getRoomCatalog("analysis")!;
  it("has 7 instruments with unique ids", () => {
    expect(cat.instruments).toHaveLength(7);
    const ids = cat.instruments.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has 3 GC and 4 HPLC instruments, each with 3 readings", () => {
    const gc = cat.instruments.filter((i) => i.group === "gc");
    const hplc = cat.instruments.filter((i) => i.group === "hplc");
    expect(gc).toHaveLength(3);
    expect(hplc).toHaveLength(4);
    for (const i of cat.instruments) expect(i.readings).toHaveLength(3);
  });
});

describe("extraction catalog", () => {
  const cat = getRoomCatalog("extraction")!;
  it("has 10 instruments with unique ids", () => {
    expect(cat.instruments).toHaveLength(10);
    const ids = cat.instruments.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has 4 status-only (no readings) and 6 temp instruments", () => {
    const basic = cat.instruments.filter((i) => i.group === "basic");
    const temp = cat.instruments.filter((i) => i.group === "temp");
    expect(basic).toHaveLength(4);
    for (const i of basic) expect(i.readings).toHaveLength(0);
    expect(temp).toHaveLength(6);
    for (const i of temp) {
      expect(i.readings).toHaveLength(1);
      expect(i.readings[0].key).toBe("temp");
      expect(i.readings[0].unit).toBe("°C");
    }
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npm run test -- src/lib/roomEquipment.test.ts`
Expected: FAIL — `Failed to resolve import "./roomEquipment"` (ยังไม่มีไฟล์)

- [ ] **Step 3: สร้าง catalog ห้องวิเคราะห์** — `src/lib/analysisInstruments.ts`

```ts
// Catalog สำหรับ Daily Check ห้องวิเคราะห์ (analysis).
// GC 3 เครื่อง + HPLC 4 เครื่อง — ทุกเครื่องกรอกค่า (status + readings).
import type { RoomInstrument, RoomGroup } from "./roomEquipment";

export const ANALYSIS_ROOM_SLUG = "analysis";

const GC_READINGS = [
  { key: "pressure", label: "ความดันแก๊สพา", unit: "psi" },
  { key: "temp", label: "อุณหภูมิ oven", unit: "°C" },
  { key: "flow", label: "Flow rate", unit: "mL/min" },
];

const HPLC_READINGS = [
  { key: "pressure", label: "ความดันระบบ", unit: "bar" },
  { key: "flow", label: "Flow rate", unit: "mL/min" },
  { key: "temp", label: "อุณหภูมิ column", unit: "°C" },
];

export const ANALYSIS_INSTRUMENTS: RoomInstrument[] = [
  { id: "LD-003", name: "GC 7890A", brand: "Agilent", group: "gc", readings: GC_READINGS },
  { id: "LD-043", name: "GC 8850", brand: "Agilent", group: "gc", readings: GC_READINGS },
  { id: "LD-004", name: "GC 8890", brand: "Agilent", group: "gc", readings: GC_READINGS },
  { id: "LD-044", name: "HPLC 1260 Infinity III", brand: "Agilent", group: "hplc", readings: HPLC_READINGS },
  { id: "LD-001", name: "HPLC Agilent 1260", brand: "Agilent", group: "hplc", readings: HPLC_READINGS },
  { id: "LD-033", name: "HPLC Agilent 1260", brand: "Agilent", group: "hplc", readings: HPLC_READINGS },
  { id: "LD-034", name: "HPLC Agilent 1260", brand: "Agilent", group: "hplc", readings: HPLC_READINGS },
];

export const analysisGroups: RoomGroup[] = [
  { key: "gc", label: "GC" },
  { key: "hplc", label: "HPLC" },
];
```

- [ ] **Step 4: สร้าง catalog ห้องสกัด** — `src/lib/extractionInstruments.ts`

```ts
// Catalog สำหรับ Daily Check ห้องสกัด (extraction).
// 4 เครื่องสถานะอย่างเดียว + 6 เครื่องกรอกอุณหภูมิ (Cooling x2, Heating mantle x4).
import type { RoomInstrument, RoomGroup } from "./roomEquipment";

export const EXTRACTION_ROOM_SLUG = "extraction";

const TEMP = { key: "temp", label: "อุณหภูมิ", unit: "°C" };

export const EXTRACTION_INSTRUMENTS: RoomInstrument[] = [
  { id: "LD-022", name: "Aspirator pump", brand: "", group: "basic", readings: [] },
  { id: "LD-045", name: "Aspirator pump", brand: "", group: "basic", readings: [] },
  { id: "LD-042", name: "Desiccator", brand: "", group: "basic", readings: [] },
  { id: "LD-039", name: "Magnetic stirrer", brand: "", group: "basic", readings: [] },
  { id: "LD-020", name: "Cooling", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-030", name: "Cooling", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-017", name: "Heating mantle", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-018", name: "Heating mantle", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-036", name: "Heating mantle", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-037", name: "Heating mantle", brand: "", group: "temp", readings: [TEMP] },
];

export const extractionGroups: RoomGroup[] = [
  { key: "basic", label: "เครื่องมือทั่วไป" },
  { key: "temp", label: "วัดอุณหภูมิ" },
];
```

- [ ] **Step 5: สร้าง types + registry** — `src/lib/roomEquipment.ts`

```ts
// Shared catalog types + registry สำหรับหน้า Daily Check แบบเช็กเครื่องมือ (EquipmentCheck).
// แต่ละห้องลงทะเบียน catalog (เครื่องมือ + กลุ่ม) ที่นี่; หน้าเพจกลางดึงผ่าน getRoomCatalog.
// หมายเหตุ: import จาก ./samplePrepInstruments เป็น value import ได้ เพราะไฟล์นั้นไม่
// import กลับมาที่นี่ (ไม่มี circular). analysis/extraction import เฉพาะ type (erased).
import {
  SAMPLE_PREP_INSTRUMENTS,
  SAMPLE_PREP_ROOM_SLUG,
  samplePrepGroups,
} from "./samplePrepInstruments";
import {
  ANALYSIS_INSTRUMENTS,
  ANALYSIS_ROOM_SLUG,
  analysisGroups,
} from "./analysisInstruments";
import {
  EXTRACTION_INSTRUMENTS,
  EXTRACTION_ROOM_SLUG,
  extractionGroups,
} from "./extractionInstruments";

export interface ReadingField {
  key: string;
  label: string;
  unit: string;
}

export interface RoomInstrument {
  id: string;
  name: string;
  brand: string;
  group: string;
  readings: ReadingField[];
}

export interface RoomGroup {
  key: string;
  label: string;
}

export interface RoomCatalog {
  slug: string;
  instruments: RoomInstrument[];
  groups: RoomGroup[];
}

export const ROOM_CATALOGS: Record<string, RoomCatalog> = {
  [SAMPLE_PREP_ROOM_SLUG]: {
    slug: SAMPLE_PREP_ROOM_SLUG,
    instruments: SAMPLE_PREP_INSTRUMENTS,
    groups: samplePrepGroups,
  },
  [ANALYSIS_ROOM_SLUG]: {
    slug: ANALYSIS_ROOM_SLUG,
    instruments: ANALYSIS_INSTRUMENTS,
    groups: analysisGroups,
  },
  [EXTRACTION_ROOM_SLUG]: {
    slug: EXTRACTION_ROOM_SLUG,
    instruments: EXTRACTION_INSTRUMENTS,
    groups: extractionGroups,
  },
};

export const getRoomCatalog = (slug: string): RoomCatalog | undefined =>
  ROOM_CATALOGS[slug];
```

- [ ] **Step 6: รัน test ให้ผ่าน**

Run: `npm run test -- src/lib/roomEquipment.test.ts`
Expected: PASS (ทุก it ผ่าน)

- [ ] **Step 7: type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error
(หากเจอ error เรื่อง `SAMPLE_PREP_INSTRUMENTS` assignable ให้ตรวจว่า `samplePrepInstruments.ts` ใช้ shape `{key,label,unit}` และ group เป็น string-literal subset — เป็นแบบนั้นอยู่แล้ว จึง assignable)

- [ ] **Step 8: commit**

```bash
git add src/lib/analysisInstruments.ts src/lib/extractionInstruments.ts src/lib/roomEquipment.ts src/lib/roomEquipment.test.ts
git commit -m "feat: room equipment catalogs + registry for analysis/extraction" -- src/lib/analysisInstruments.ts src/lib/extractionInstruments.ts src/lib/roomEquipment.ts src/lib/roomEquipment.test.ts
```

---

## Task 2: หน้าเพจกลาง RoomEquipmentCheckPage

**Files:**
- Create: `src/pages/daily-check/RoomEquipmentCheckPage.tsx`

generalize จาก `SamplePrepRoomPage.tsx` — เปลี่ยน: รับ prop `roomSlug`, ดึง catalog/meta จาก registry, ใส่ `roomSlug` ใน query key (กัน cache ชนข้ามห้อง), หัวข้อ/ไอคอนจาก room meta

- [ ] **Step 1: สร้างไฟล์** — `src/pages/daily-check/RoomEquipmentCheckPage.tsx`

```tsx
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, AlertTriangle, RotateCcw, List, ClipboardList, Filter } from "lucide-react";
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
import { getRoomCatalog } from "@/lib/roomEquipment";
import { getRoomBySlug } from "@/lib/dailyCheckRooms";

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

interface RoomEquipmentCheckPageProps {
  roomSlug: string;
}

const RoomEquipmentCheckPage = ({ roomSlug }: RoomEquipmentCheckPageProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayLabel = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  const room = getRoomBySlug(roomSlug);
  const catalog = getRoomCatalog(roomSlug);

  const [drafts, setDrafts] = useState<Record<string, CheckDraft>>({});
  const [filterDate, setFilterDate] = useState<string>(todayStr());
  const [filterInstrument, setFilterInstrument] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "normal" | "abnormal">("all");

  const { data: todayRecords = [] } = useQuery({
    queryKey: ["equipment-checks", "today", roomSlug, todayStr()],
    queryFn: () => api.getEquipmentChecks({ room: roomSlug, date: todayStr() }),
    refetchOnWindowFocus: true,
    enabled: !!catalog,
  });

  const { data: historyRecords = [], isLoading: historyLoading } = useQuery({
    queryKey: ["equipment-checks", "history", roomSlug, filterDate, filterInstrument, filterStatus],
    queryFn: () =>
      api.getEquipmentChecks({
        room: roomSlug,
        date: filterDate || todayStr(),
        instrumentId: filterInstrument === "all" ? undefined : filterInstrument,
        status: filterStatus === "all" ? undefined : filterStatus,
      }),
    enabled: !!catalog,
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

  // all hooks above; safe to early-return now
  if (!room || !catalog) {
    return <p className="py-12 text-center text-sm text-muted-foreground">ไม่พบห้องที่ระบุ</p>;
  }

  const instruments = catalog.instruments;
  const groups = catalog.groups;
  const TOTAL = instruments.length;
  const RoomIcon = room.icon;

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
    const instrument = instruments.find((i) => i.id === instrumentId)!;
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
      roomSlug,
      instrumentId: instrument.id,
      instrumentName: instrument.name,
      brand: instrument.brand,
      status: d.status,
      readings,
      note: d.note,
      recorder: user.name,
      recorderId: user.id ?? "",
      recorderEmail: user.email ?? "",
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
            {room.label} — เช็กการทำงานเครื่องมือ
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
          {groups.map((group) => {
            const items = instruments.filter((i) => i.group === group.key);
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
                              <RoomIcon className="w-4 h-4 text-primary" />
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
                      {instruments.map((i) => (
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

export default RoomEquipmentCheckPage;
```

- [ ] **Step 2: type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error (SamplePrepRoomPage ยังอยู่และยัง import ใน App — ปกติ จะลบใน Task 3)

- [ ] **Step 3: commit**

```bash
git add src/pages/daily-check/RoomEquipmentCheckPage.tsx
git commit -m "feat: generalized RoomEquipmentCheckPage driven by room catalog" -- src/pages/daily-check/RoomEquipmentCheckPage.tsx
```

---

## Task 3: Wire routes + ready flags + ลบหน้าเก่า

**Files:**
- Modify: `src/lib/dailyCheckRooms.test.ts`
- Modify: `src/lib/dailyCheckRooms.ts`
- Modify: `src/App.tsx`
- Delete: `src/pages/daily-check/SamplePrepRoomPage.tsx`

- [ ] **Step 1: แก้ test "ready set" ก่อน** — `src/lib/dailyCheckRooms.test.ts`

แทนที่ test เดิม (บรรทัด 28-31):

```ts
  it("marks all four rooms as ready", () => {
    const ready = DAILY_CHECK_ROOMS.filter((r) => r.ready);
    expect(ready.map((r) => r.slug)).toEqual([
      "balance",
      "sample-prep",
      "analysis",
      "extraction",
    ]);
  });
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npm run test -- src/lib/dailyCheckRooms.test.ts`
Expected: FAIL — ได้ `["balance","sample-prep"]` ไม่ตรงกับที่คาดหวัง

- [ ] **Step 3: ตั้ง ready: true** — `src/lib/dailyCheckRooms.ts`

ในนิยาม room `analysis` (ปัจจุบันไม่ส่ง arg ตัวสุดท้าย) เพิ่ม `true` เป็น arg สุดท้ายของ `room(...)`:

```ts
  room("analysis", "ห้องวิเคราะห์", Microscope, [
    "อุณหภูมิ/ความชื้น (ห้องวิเคราะห์)",
    "GC 7890A",
    "GC 8850",
    "GC 8890",
    "HPLC 1260 Infinity III",
    "HPLC Agilent 1260",
  ], true),
  room("extraction", "ห้องสกัด", FlaskConical, [
    "Asirator pump",
    "Cooling",
    "Desiccator",
    "Heating mantle",
    "Magnetic stirrer",
  ], true),
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- src/lib/dailyCheckRooms.test.ts`
Expected: PASS

- [ ] **Step 5: แก้ route ใน App.tsx** — `src/App.tsx`

(5a) ลบบรรทัด import `SamplePrepRoomPage` (บรรทัด ~30) แล้วเพิ่ม import component กลางแทน:

```tsx
import RoomEquipmentCheckPage from "./pages/daily-check/RoomEquipmentCheckPage";
```

(5b) แทนที่ 3 route (sample-prep / analysis / extraction) ในบล็อก `/daily-check`:

```tsx
                <Route path="sample-prep" element={<RoomEquipmentCheckPage roomSlug="sample-prep" />} />
                <Route path="analysis" element={<RoomEquipmentCheckPage roomSlug="analysis" />} />
                <Route path="extraction" element={<RoomEquipmentCheckPage roomSlug="extraction" />} />
```

หมายเหตุ: import `RoomPlaceholderPage` ปล่อยไว้ได้ (ไม่มีห้องใช้แล้ว แต่เก็บไว้เผื่ออนาคต) — ถ้า ESLint เตือน no-unused-vars ค่อยลบ import นั้นออก

- [ ] **Step 6: ลบหน้าเก่า**

```bash
git rm src/pages/daily-check/SamplePrepRoomPage.tsx
```

- [ ] **Step 7: type-check + lint + test ทั้งหมด**

Run: `npx tsc --noEmit`
Expected: ไม่มี error (ไม่มีการอ้าง SamplePrepRoomPage หลงเหลือ)

Run: `npm run lint`
Expected: ไม่มี error ใหม่ (ถ้าเตือน RoomPlaceholderPage unused → ลบ import นั้นใน App.tsx แล้วรันซ้ำ)

Run: `npm run test`
Expected: PASS ทั้งหมด (รวม samplePrepInstruments.test.ts เดิม + roomEquipment.test.ts + dailyCheckRooms.test.ts)

- [ ] **Step 8: commit**

```bash
git add src/App.tsx src/lib/dailyCheckRooms.ts src/lib/dailyCheckRooms.test.ts src/pages/daily-check/SamplePrepRoomPage.tsx
git commit -m "feat: enable analysis + extraction daily check rooms; route via central page" -- src/App.tsx src/lib/dailyCheckRooms.ts src/lib/dailyCheckRooms.test.ts src/pages/daily-check/SamplePrepRoomPage.tsx
```

---

## Manual verification (หลังครบ 3 tasks)

ต้องรัน backend + frontend (ดู CLAUDE.md):

```bash
# terminal 1
cd server && npm run dev
# terminal 2 (repo root)
npm run dev
```

ตรวจในเบราว์เซอร์ (`http://localhost:8000/LIS/daily-check`):
1. แท็บ **ห้องวิเคราะห์** แสดง 2 กลุ่ม (GC, HPLC) รวม 7 การ์ด — ไอคอน Microscope
2. การ์ด GC มี 3 ช่องค่า (ความดันแก๊สพา/อุณหภูมิ oven/Flow rate); HPLC มี 3 ช่อง (ความดันระบบ/Flow rate/อุณหภูมิ column)
3. กดสถานะ "ปกติ" + กรอกค่าครบ + บันทึกผล → toast เขียว, การ์ดเปลี่ยนเป็นเขียว, ตัวนับ "ตรวจแล้ว" เพิ่ม
4. ถ้ากรอกค่าไม่ครบ → toast error ขอให้กรอกค่าที่ขาด
5. แท็บ **ห้องสกัด** แสดง 2 กลุ่ม (เครื่องมือทั่วไป 4 การ์ด ไม่มีช่องค่า, วัดอุณหภูมิ 6 การ์ดมีช่องอุณหภูมิ) — ไอคอน FlaskConical
6. แท็บ **รายการบันทึก** ของแต่ละห้อง: filter เครื่องมือมีเฉพาะเครื่องของห้องนั้น; record ที่เพิ่งบันทึกโผล่
7. แท็บ **ห้องเตรียมตัวอย่าง** (sample-prep) ยังทำงานเหมือนเดิม (regression) — ไม่มี cache ชนข้ามห้อง

---

## Notes

- ไม่มี collection ใหม่ / ไม่แตะ backend → **ไม่ต้องรัน seed:export**
- query key ของ today/history มี `roomSlug` แล้ว — กัน cache ชนข้ามห้อง (ของเดิมใน SamplePrepRoomPage ไม่มี เพราะมีห้องเดียว)
- commit ใช้ explicit pathspec ทุกครั้ง (รีโปนี้บางทีมี process อื่น commit แทรก)
