# Consolidated Daily Check Records Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้าย "รายการบันทึก" จาก sub-tab ในแต่ละหน้าห้อง มาเป็นแท็บรวมระดับ hub ที่ดูข้ามห้องได้ พร้อม filter ห้อง/เครื่อง/วันที่/สถานะ (ครอบคลุม 3 ห้องที่ใช้ model EquipmentCheck)

**Architecture:** แท็บใหม่ `/daily-check/records` → หน้า `DailyCheckRecordsPage` ที่ยิง `getEquipmentChecks` ทั้ง 3 ห้องด้วย `useQueries` (frontend ล้วน ไม่แตะ backend), merge+sort, แล้วกรองด้วย pure helper `filterEquipmentRecords`. หน้าห้อง (`RoomEquipmentCheckPage`) ตัด sub-tab ประวัติทิ้ง เหลือแค่ grid บันทึกผล

**Tech Stack:** React 18 + TypeScript + Vite + TanStack React Query (`useQueries`) + shadcn/ui + Vitest

อ้างอิง spec: `docs/superpowers/specs/2026-06-05-daily-check-records-tab-design.md`

---

## File Structure

**สร้างใหม่:**
- `src/lib/equipmentRecords.ts` — pure helper `filterEquipmentRecords(records, {room, instrumentId, status})`
- `src/lib/equipmentRecords.test.ts` — unit test ของ helper
- `src/pages/daily-check/DailyCheckRecordsPage.tsx` — หน้าแท็บรวมรายการบันทึก

**แก้ไข:**
- `src/lib/roomEquipment.ts` — เพิ่ม export `EQUIPMENT_ROOM_SLUGS`
- `src/lib/dailyCheckRooms.ts` — import `List` + เพิ่ม tab "รายการบันทึก" ใน `DAILY_CHECK_TABS`
- `src/App.tsx` — import + route `records`
- `src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx` — แก้ tab list ที่คาดหวัง
- `src/pages/daily-check/RoomEquipmentCheckPage.tsx` — ตัด sub-tab ประวัติ เหลือแค่ grid บันทึกผล

---

## Task 1: Pure filter helper + room-slug list

**Files:**
- Create: `src/lib/equipmentRecords.ts`
- Create: `src/lib/equipmentRecords.test.ts`
- Modify: `src/lib/roomEquipment.ts`

- [ ] **Step 1: เขียน test ก่อน** — `src/lib/equipmentRecords.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { filterEquipmentRecords } from "./equipmentRecords";
import type { EquipmentCheckRecord } from "./api";

const rec = (over: Partial<EquipmentCheckRecord>): EquipmentCheckRecord => ({
  roomSlug: "analysis",
  instrumentId: "LD-003",
  instrumentName: "GC 7890A",
  status: "normal",
  readings: [],
  recorder: "tester",
  date: "2026-06-05",
  checkedAt: "2026-06-05T03:00:00.000Z",
  ...over,
});

const data: EquipmentCheckRecord[] = [
  rec({ roomSlug: "analysis", instrumentId: "LD-003", status: "normal" }),
  rec({ roomSlug: "analysis", instrumentId: "LD-044", status: "abnormal" }),
  rec({ roomSlug: "extraction", instrumentId: "LD-020", status: "normal" }),
];

describe("filterEquipmentRecords", () => {
  it("returns all rows when every filter is 'all'", () => {
    expect(filterEquipmentRecords(data, { room: "all", instrumentId: "all", status: "all" }))
      .toHaveLength(3);
  });

  it("returns all rows when filters are undefined", () => {
    expect(filterEquipmentRecords(data, {})).toHaveLength(3);
  });

  it("filters by room", () => {
    const out = filterEquipmentRecords(data, { room: "analysis" });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.roomSlug === "analysis")).toBe(true);
  });

  it("filters by instrumentId", () => {
    const out = filterEquipmentRecords(data, { instrumentId: "LD-020" });
    expect(out).toHaveLength(1);
    expect(out[0].roomSlug).toBe("extraction");
  });

  it("filters by status", () => {
    const out = filterEquipmentRecords(data, { status: "abnormal" });
    expect(out).toHaveLength(1);
    expect(out[0].instrumentId).toBe("LD-044");
  });

  it("combines room + status", () => {
    const out = filterEquipmentRecords(data, { room: "analysis", status: "normal" });
    expect(out).toHaveLength(1);
    expect(out[0].instrumentId).toBe("LD-003");
  });

  it("does not mutate the input array", () => {
    const copy = [...data];
    filterEquipmentRecords(data, { room: "analysis" });
    expect(data).toEqual(copy);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- src/lib/equipmentRecords.test.ts`
Expected: FAIL — `Failed to resolve import "./equipmentRecords"`

- [ ] **Step 3: เขียน helper** — `src/lib/equipmentRecords.ts`

```ts
// Pure client-side filter for EquipmentCheck history rows (used by the
// consolidated Daily Check records tab). Value "all" or undefined = no filter.
import type { EquipmentCheckRecord } from "./api";

export interface RecordFilter {
  room?: string;         // "all" | roomSlug
  instrumentId?: string; // "all" | instrument id
  status?: string;       // "all" | "normal" | "abnormal"
}

export function filterEquipmentRecords(
  records: EquipmentCheckRecord[],
  { room, instrumentId, status }: RecordFilter,
): EquipmentCheckRecord[] {
  return records.filter((r) => {
    if (room && room !== "all" && r.roomSlug !== room) return false;
    if (instrumentId && instrumentId !== "all" && r.instrumentId !== instrumentId) return false;
    if (status && status !== "all" && r.status !== status) return false;
    return true;
  });
}
```

- [ ] **Step 4: เพิ่ม `EQUIPMENT_ROOM_SLUGS`** — `src/lib/roomEquipment.ts`

ต่อท้ายไฟล์ (หลัง `getRoomCatalog`) เพิ่ม:
```ts
// Room slugs ที่ใช้ model EquipmentCheck (เรียงตามลำดับใน ROOM_CATALOGS:
// sample-prep, analysis, extraction) — ใช้โดยแท็บรายการบันทึกรวม.
export const EQUIPMENT_ROOM_SLUGS: string[] = Object.keys(ROOM_CATALOGS);
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npm run test -- src/lib/equipmentRecords.test.ts`
Expected: PASS (7 it ผ่าน)

- [ ] **Step 6: type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 7: commit** (explicit pathspec — repo นี้บางทีมี process อื่น commit แทรก)

```bash
git add src/lib/equipmentRecords.ts src/lib/equipmentRecords.test.ts src/lib/roomEquipment.ts
git commit -m "feat: equipment records filter helper + EQUIPMENT_ROOM_SLUGS" -- src/lib/equipmentRecords.ts src/lib/equipmentRecords.test.ts src/lib/roomEquipment.ts
```
จบ commit body ด้วยบรรทัดว่างแล้ว:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Task 2: หน้า DailyCheckRecordsPage + wire tab/route

**Files:**
- Create: `src/pages/daily-check/DailyCheckRecordsPage.tsx`
- Modify: `src/lib/dailyCheckRooms.ts`
- Modify: `src/App.tsx`
- Modify: `src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`

- [ ] **Step 1: แก้ test ของ layout ก่อน (TDD)** — `src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`

แก้ array ที่คาดหวังในเทสต์ `"renders the env + four-room + documents tab strip"` ให้เพิ่ม `"รายการบันทึก"` ก่อน `"โหลดเอกสาร"`:
```ts
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      "อุณหภูมิ/ความชื้น",
      "ห้องเครื่องชั่ง",
      "ห้องเตรียมตัวอย่าง",
      "ห้องวิเคราะห์",
      "ห้องสกัด",
      "รายการบันทึก",
      "โหลดเอกสาร",
    ]);
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`
Expected: FAIL — ได้ array เดิม (ยังไม่มี "รายการบันทึก")

- [ ] **Step 3: เพิ่ม tab** — `src/lib/dailyCheckRooms.ts`

(3a) แก้บรรทัด import lucide ให้เพิ่ม `List`:
```ts
import { Beaker, FileDown, FlaskConical, List, Microscope, Scale, Thermometer } from "lucide-react";
```
(3b) ใน `DAILY_CHECK_TABS` แทรก entry "รายการบันทึก" ก่อนบรรทัด "โหลดเอกสาร":
```ts
export const DAILY_CHECK_TABS: DailyCheckTab[] = [
  { route: `${DAILY_CHECK_BASE}/environment`, label: "อุณหภูมิ/ความชื้น", icon: Thermometer },
  ...DAILY_CHECK_ROOMS.map((r) => ({ route: r.route, label: r.label, icon: r.icon })),
  { route: `${DAILY_CHECK_BASE}/records`, label: "รายการบันทึก", icon: List },
  { route: `${DAILY_CHECK_BASE}/documents`, label: "โหลดเอกสาร", icon: FileDown },
];
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`
Expected: PASS

- [ ] **Step 5: สร้างหน้า** — `src/pages/daily-check/DailyCheckRecordsPage.tsx`

```tsx
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { List, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type EquipmentCheckRecord } from "@/lib/api";
import { EQUIPMENT_ROOM_SLUGS, getRoomCatalog } from "@/lib/roomEquipment";
import { getRoomBySlug } from "@/lib/dailyCheckRooms";
import { filterEquipmentRecords } from "@/lib/equipmentRecords";

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

const roomLabel = (slug: string) => getRoomBySlug(slug)?.label ?? slug;

const DailyCheckRecordsPage = () => {
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [filterInstrument, setFilterInstrument] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>(todayStr());
  const [filterStatus, setFilterStatus] = useState<"all" | "normal" | "abnormal">("all");

  // ยิง 1 query ต่อห้อง (ทั้ง 3 ห้องเสมอ) ตามวันที่ที่เลือก — รวม client-side
  const results = useQueries({
    queries: EQUIPMENT_ROOM_SLUGS.map((slug) => ({
      queryKey: ["equipment-checks", "records", slug, filterDate],
      queryFn: () => api.getEquipmentChecks({ room: slug, date: filterDate || todayStr() }),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);

  // merge ทุกห้อง → sort ใหม่สุดก่อน
  const merged: EquipmentCheckRecord[] = [];
  for (const r of results) if (r.data) merged.push(...r.data);
  merged.sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : a.checkedAt > b.checkedAt ? -1 : 0));

  const rows = filterEquipmentRecords(merged, {
    room: filterRoom,
    instrumentId: filterInstrument,
    status: filterStatus,
  });

  const roomInstruments =
    filterRoom === "all" ? [] : getRoomCatalog(filterRoom)?.instruments ?? [];

  const handleRoomChange = (v: string) => {
    setFilterRoom(v);
    setFilterInstrument("all"); // กันค้างเครื่องของห้องเก่า
  };

  const resetFilters = () => {
    setFilterRoom("all");
    setFilterInstrument("all");
    setFilterDate(todayStr());
    setFilterStatus("all");
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">รายการบันทึกการเช็กเครื่องมือ</h2>
        <p className="text-sm text-muted-foreground">รวมทุกห้อง — เลือกดูตามห้อง / เครื่อง / วันที่ / สถานะ</p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base flex items-center gap-2">
            <List className="w-4 h-4 text-primary" />
            ประวัติการเช็กเครื่องมือ
          </CardTitle>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Filter className="w-3 h-3" /> ห้อง
              </label>
              <Select value={filterRoom} onValueChange={handleRoomChange}>
                <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกห้อง</SelectItem>
                  {EQUIPMENT_ROOM_SLUGS.map((slug) => (
                    <SelectItem key={slug} value={slug}>{roomLabel(slug)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">เครื่อง</label>
              <Select
                value={filterInstrument}
                onValueChange={setFilterInstrument}
                disabled={filterRoom === "all"}
              >
                <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {roomInstruments.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">วันที่</label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-8 text-xs w-[160px]"
              />
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
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
              รีเซ็ตตัวกรอง
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">กำลังโหลด...</p>
          ) : isError ? (
            <p className="text-sm text-muted-foreground text-center py-8">โหลดข้อมูลไม่สำเร็จ</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">ไม่พบรายการในช่วงที่เลือก</p>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>เวลา</TableHead>
                    <TableHead>ห้อง</TableHead>
                    <TableHead>เครื่อง</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="text-center">ค่าที่วัด</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    <TableHead>ผู้บันทึก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((h) => {
                    const normal = h.status === "normal";
                    return (
                      <TableRow key={h._id}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(h.date)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtTime(h.checkedAt)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{roomLabel(h.roomSlug)}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{h.instrumentName} <span className="text-muted-foreground">({h.instrumentId})</span></TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${normal ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                            {normal ? "ปกติ" : "ผิดปกติ"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs whitespace-nowrap">
                          {h.readings.length
                            ? h.readings.map((r) => `${r.label} ${r.value} ${r.unit}`).join(", ")
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
    </>
  );
};

export default DailyCheckRecordsPage;
```

- [ ] **Step 6: wire route** — `src/App.tsx`

(6a) เพิ่ม import (ใกล้ๆ import หน้า daily-check อื่น เช่นหลังบรรทัด `DocumentsPage`):
```tsx
import DailyCheckRecordsPage from "./pages/daily-check/DailyCheckRecordsPage";
```
(6b) ในบล็อก route `/daily-check` เพิ่ม route `records` (วางก่อน `documents`):
```tsx
                <Route path="records" element={<DailyCheckRecordsPage />} />
```

- [ ] **Step 7: type-check + test ทั้งหมด**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

Run: `npm run test -- src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx src/lib/equipmentRecords.test.ts`
Expected: PASS

- [ ] **Step 8: commit**

```bash
git add src/pages/daily-check/DailyCheckRecordsPage.tsx src/lib/dailyCheckRooms.ts src/App.tsx src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx
git commit -m "feat: consolidated daily-check records tab (cross-room history + filters)" -- src/pages/daily-check/DailyCheckRecordsPage.tsx src/lib/dailyCheckRooms.ts src/App.tsx src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx
```
จบ commit body ด้วยบรรทัดว่างแล้ว:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Task 3: ตัด sub-tab ประวัติออกจาก RoomEquipmentCheckPage

**Files:**
- Modify (แทนที่ทั้งไฟล์): `src/pages/daily-check/RoomEquipmentCheckPage.tsx`

หน้าห้องเหลือแค่ grid "บันทึกผล" (ไม่มี Tabs / ไม่มีตารางประวัติ). แทนที่เนื้อหาไฟล์ทั้งหมดด้วยโค้ดนี้:

```tsx
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  const { data: todayRecords = [] } = useQuery({
    queryKey: ["equipment-checks", "today", roomSlug, todayStr()],
    queryFn: () => api.getEquipmentChecks({ room: roomSlug, date: todayStr() }),
    refetchOnWindowFocus: true,
    enabled: !!catalog,
  });

  // latest record per instrument for today.
  // GET /equipment-checks sorts checkedAt desc (newest-first), so first-wins keeps the latest.
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

      <div className="space-y-6">
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
      </div>
    </>
  );
};

export default RoomEquipmentCheckPage;
```

- [ ] **Step 1 (verify): type-check** (ไม่มี import/ตัวแปรที่ไม่ใช้หลงเหลือ)

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 2: lint** (จับ import ที่ไม่ใช้)

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์นี้ (ตัด Tabs/Table/Select/Filter/List/ClipboardList/fmtDate ออกหมดแล้ว)

- [ ] **Step 3: full test**

Run: `npm run test`
Expected: ผ่านทั้งหมด ยกเว้น failure เดิมที่ไม่เกี่ยวกับงานนี้ (`src/config/dev.test.ts` — department field, pre-existing)

- [ ] **Step 4: commit**

```bash
git add src/pages/daily-check/RoomEquipmentCheckPage.tsx
git commit -m "refactor: drop per-room history sub-tab (moved to records tab)" -- src/pages/daily-check/RoomEquipmentCheckPage.tsx
```
จบ commit body ด้วยบรรทัดว่างแล้ว:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Manual verification (หลังครบ 3 tasks)

รัน backend + frontend (ดู CLAUDE.md), เปิด `http://localhost:8000/LIS/daily-check`:
1. แถบ tab มี "รายการบันทึก" ระหว่าง "ห้องสกัด" กับ "โหลดเอกสาร"
2. เปิดแท็บ → default โชว์รายการของวันนี้รวมทุกห้อง (คอลัมน์ "ห้อง" แสดงชื่อไทย), เรียงเวลาใหม่สุดก่อน
3. เลือกห้อง=ห้องวิเคราะห์ → dropdown "เครื่อง" เปิดใช้งานและมีเฉพาะเครื่องห้องวิเคราะห์; ตารางกรองเหลือเฉพาะห้องนั้น
4. เลือกห้อง=ทุกห้อง → dropdown "เครื่อง" ถูก disable + รีเซ็ตเป็น "ทั้งหมด"
5. เปลี่ยนวันที่ / สถานะ → ตารางอัปเดตถูกต้อง; ปุ่มรีเซ็ตคืนค่า default
6. เข้าหน้าห้อง (เตรียมตัวอย่าง/วิเคราะห์/สกัด) → ไม่มี sub-tab "รายการบันทึก" แล้ว เหลือแค่ grid บันทึกผล; บันทึกผลยังทำงานปกติ

## Notes

- ไม่มี collection ใหม่ / ไม่แตะ backend → **ไม่ต้องรัน seed:export**
- `useQueries` ยิง 3 ห้องเสมอ (รับได้ ข้อมูลเล็ก) เพื่อรองรับ filter ห้อง=ทุกห้อง และเลี่ยงปัญหา rules-of-hooks
- merge+sort ทำในหน้าเพจ (บรรทัดเดียว); logic filter อยู่ใน `filterEquipmentRecords` (unit-tested)
- commit ใช้ explicit pathspec ทุกครั้ง
