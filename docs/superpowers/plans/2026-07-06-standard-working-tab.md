# Standard split-only + "Standard ใช้งานอยู่" tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำ "เบิก Standard" ให้เหลือแค่แบ่ง working ใหม่ และเพิ่มแท็บที่ 3 "Standard ใช้งานอยู่" ให้ทุกคนดู working standard ทั้งหมดแล้วแจ้งทิ้งได้

**Architecture:** Frontend-only. เพิ่ม pure helper ใน `standardStatus.ts` (test ได้) → แก้ `StandardDailyRow` ให้แจ้งทิ้งได้ทุกสถานะที่ไม่ทิ้ง + ป้ายวันที่ → แยก `StandardUnitList` (rows + dialogs) ใช้ร่วม → เพิ่ม `StandardWorkingPanel` (แท็บใหม่) → ต่อแท็บใน `StockDeduction` → ตัด reuse ออกจาก `StandardRequisitionDialog`. Backend คืน working ครบอยู่แล้ว ไม่แตะ

**Tech Stack:** React 18 + TypeScript, TanStack React Query, shadcn/ui, Tailwind, Vitest

## Global Constraints

- **Type-check ที่ได้ผลจริงต้องใช้** `npx tsc -p tsconfig.app.json --noEmit` — `npx tsc --noEmit` (root) เป็น no-op (files:[]). repo มี latent error ค้าง ~12 ตัวอยู่แล้ว → เกณฑ์ผ่าน = **ไม่มี error ใหม่ที่ชี้มายังไฟล์ที่แก้ในงานนี้**
- ห้ามแตะ backend (`server/`) — endpoint `GET /units?kind=working` คืน working ทุกตัว (รวม discarded) อยู่แล้ว
- ป้าย UI เป็นภาษาไทยตามของเดิม
- คงพฤติกรรมการ์ด "Standard ที่แบ่งวันนี้" ให้เหมือนเดิมทุกอย่าง (เป็นแค่ refactor แหล่ง render)
- commit ด้วย explicit pathspec (repo นี้บางทีมี committer อื่นแทรก) และปิดท้าย message ด้วย
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Query key ของ working list = `["stock", "units", "working"]`, invalidate หลัง action = `["stock","units"]` + `["stock","transactions"]` (คงเดิม)

---

### Task 1: helper `activeWorkingUnits` + `splitTimeLabel` ใน standardStatus.ts

**Files:**
- Modify: `src/lib/standardStatus.ts`
- Test: `src/lib/standardStatus.test.ts`

**Interfaces:**
- Consumes: `workingUsability`, `WorkingUsability` (`src/lib/stockUnit.ts`); `StockUnitItem` (`@/types/stock`); module-local `timeOf`, `isSameLocalDay` (มีอยู่แล้วในไฟล์นี้)
- Produces:
  - `export type StandardStatusFilter = "all" | "usable" | "attention"`
  - `export interface ActiveWorkingOpts { search?: string; statusFilter?: StandardStatusFilter }`
  - `export function activeWorkingUnits(units: StockUnitItem[], opts?: ActiveWorkingOpts, now?: Date): StockUnitItem[]`
  - `export function splitTimeLabel(u: { withdrawnDate?: string | null; createdAt?: string }, now?: Date): string`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน** — เติมต่อท้าย `src/lib/standardStatus.test.ts`

เพิ่ม import ที่บนไฟล์ (แก้บรรทัด import เดิมให้รวมของใหม่):

```ts
import {
  STANDARD_STATUS,
  standardStatusMeta,
  isSameLocalDay,
  todayWorkingUnits,
  activeWorkingUnits,
  splitTimeLabel,
} from "./standardStatus";
```

เติม describe บล็อกนี้ท้ายไฟล์:

```ts
describe("activeWorkingUnits", () => {
  const now = new Date("2026-07-06T10:00:00");
  const units: StockUnitItem[] = [
    mk({ _id: "b", itemCode: "STD-2", itemName: "Benzene std" }),
    mk({ _id: "a", itemCode: "STD-10", itemName: "Acetone std" }),
    mk({ _id: "disc", itemCode: "STD-3", status: "discarded" }),
    mk({ _id: "sealed", itemCode: "STD-4", kind: "sealed" }),
    mk({ _id: "exp", itemCode: "STD-1", exp: "2000-01-01" }),
  ];

  it("drops discarded + non-working units", () => {
    const ids = activeWorkingUnits(units, {}, now).map((u) => u._id);
    expect(ids).not.toContain("disc");
    expect(ids).not.toContain("sealed");
    expect(ids).toContain("a");
    expect(ids).toContain("exp");
  });

  it("sorts by itemCode natural-numeric", () => {
    const codes = activeWorkingUnits(units, {}, now).map((u) => u.itemCode);
    expect(codes).toEqual(["STD-1", "STD-2", "STD-10"]);
  });

  it("searches name or code (case-insensitive)", () => {
    expect(activeWorkingUnits(units, { search: "acetone" }, now).map((u) => u._id)).toEqual(["a"]);
    expect(activeWorkingUnits(units, { search: "std-2" }, now).map((u) => u._id)).toEqual(["b"]);
  });

  it("statusFilter usable keeps only active; attention keeps the rest", () => {
    expect(activeWorkingUnits(units, { statusFilter: "usable" }, now).map((u) => u._id)).not.toContain("exp");
    expect(activeWorkingUnits(units, { statusFilter: "attention" }, now).map((u) => u._id)).toEqual(["exp"]);
  });
});

describe("splitTimeLabel", () => {
  const now = new Date("2026-07-06T10:00:00");
  it("today → 'แบ่งวันนี้ เวลา ...'", () => {
    expect(splitTimeLabel({ withdrawnDate: "2026-07-06T08:10:00" }, now)).toContain("แบ่งวันนี้");
  });
  it("other day → 'แบ่งเมื่อ ...'", () => {
    expect(splitTimeLabel({ withdrawnDate: "2026-07-01T08:10:00" }, now)).toContain("แบ่งเมื่อ");
  });
  it("falls back to createdAt, empty when no date", () => {
    expect(splitTimeLabel({ withdrawnDate: null, createdAt: "2026-07-06T09:00:00" }, now)).toContain("แบ่งวันนี้");
    expect(splitTimeLabel({ withdrawnDate: null }, now)).toBe("");
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npm run test -- standardStatus`
Expected: FAIL — `activeWorkingUnits is not a function` / `splitTimeLabel is not a function`

- [ ] **Step 3: เขียน implementation** — เติมต่อท้าย `src/lib/standardStatus.ts` (หลัง `todayWorkingUnits`)

```ts
export type StandardStatusFilter = "all" | "usable" | "attention";

export interface ActiveWorkingOpts {
  search?: string;
  statusFilter?: StandardStatusFilter;
}

/**
 * working standard ที่ยังไม่ทิ้ง (kind=working, status!=discarded)
 * + ค้นหา (ชื่อ/code) + filter สถานะ (usable=พร้อมใช้, attention=หมดอายุ/หมดความถี่/หมด)
 * + เรียงตาม itemCode แบบ natural numeric (tie → แบ่งล่าสุดก่อน)
 */
export function activeWorkingUnits(
  units: StockUnitItem[],
  opts: ActiveWorkingOpts = {},
  now: Date = new Date(),
): StockUnitItem[] {
  const { search = "", statusFilter = "all" } = opts;
  const q = search.trim().toLowerCase();
  return units
    .filter((u) => u.kind === "working" && u.status !== "discarded")
    .filter((u) =>
      !q ||
      (u.itemName || "").toLowerCase().includes(q) ||
      (u.itemCode || "").toLowerCase().includes(q),
    )
    .filter((u) => {
      if (statusFilter === "all") return true;
      const usable = workingUsability(u, now) === "active";
      return statusFilter === "usable" ? usable : !usable;
    })
    .sort(
      (a, b) =>
        (a.itemCode || "").localeCompare(b.itemCode || "", undefined, { numeric: true }) ||
        timeOf(b) - timeOf(a),
    );
}

/** ป้ายเวลาแบ่ง: วันนี้ → "แบ่งวันนี้ เวลา HH:mm", ไม่ใช่วันนี้ → "แบ่งเมื่อ D MMM YY" */
export function splitTimeLabel(
  u: { withdrawnDate?: string | null; createdAt?: string },
  now: Date = new Date(),
): string {
  const iso = u.withdrawnDate || u.createdAt;
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isSameLocalDay(iso, now)) {
    return `แบ่งวันนี้ เวลา ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `แบ่งเมื่อ ${d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- standardStatus`
Expected: PASS ทุก test (ของเดิม + ใหม่)

- [ ] **Step 5: Commit**

```bash
git add src/lib/standardStatus.ts src/lib/standardStatus.test.ts
git commit -m "feat(stock): activeWorkingUnits + splitTimeLabel helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: แก้ StandardDailyRow — แจ้งทิ้งได้ทุกสถานะที่ไม่ทิ้ง + ป้ายวันที่

**Files:**
- Modify: `src/components/lis/stock/StandardDailyRow.tsx`

**Interfaces:**
- Consumes: `workingUsability` (`@/lib/stockUnit`), `splitTimeLabel` (`@/lib/standardStatus`, จาก Task 1), `standardStatusMeta`
- Produces: (ไม่มี export ใหม่ — props เดิม `{ unit, onDiscard, onDetail }` คงเดิม)

- [ ] **Step 1: แก้ imports** — เปลี่ยนบล็อก import ด้านบนไฟล์

แก้บรรทัด import helper (บรรทัด ~10) จาก:

```ts
import { standardStatusMeta } from "@/lib/standardStatus";
```

เป็น:

```ts
import { splitTimeLabel, standardStatusMeta } from "@/lib/standardStatus";
import { workingUsability } from "@/lib/stockUnit";
```

- [ ] **Step 2: แทน logic เวลา + สถานะทิ้ง** — แก้ในตัว component

แทนบล็อก (บรรทัด ~20-25):

```ts
const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "";

export default function StandardDailyRow({ unit, onDiscard, onDetail }: Props) {
  const meta = standardStatusMeta(unit);
  const time = fmtTime(unit.withdrawnDate || unit.createdAt);
```

เป็น:

```ts
export default function StandardDailyRow({ unit, onDiscard, onDetail }: Props) {
  const meta = standardStatusMeta(unit);
  const isDiscarded = workingUsability(unit) === "discarded";
  const label = splitTimeLabel(unit);
```

- [ ] **Step 3: แทนบรรทัดข้อมูลเวลา** — แก้ JSX info line

แทน:

```tsx
          <div className="mt-0.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {unit.volume?.remaining ?? "-"} {unit.volume?.unit}
            </span>
            {time && <> · แบ่งวันนี้ เวลา {time}</>}
          </div>
```

เป็น:

```tsx
          <div className="mt-0.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {unit.volume?.remaining ?? "-"} {unit.volume?.unit}
            </span>
            {label && <> · {label}</>}
          </div>
```

- [ ] **Step 4: เปลี่ยน gate ปุ่มแจ้งทิ้ง 2 จุด** — จาก `meta.usable` เป็น `!isDiscarded`

แทน (ปุ่ม desktop):

```tsx
          {meta.usable && discardBtn("hidden sm:inline-flex")}
```

เป็น:

```tsx
          {!isDiscarded && discardBtn("hidden sm:inline-flex")}
```

และแทน (ปุ่ม mobile ล่างสุด):

```tsx
      {meta.usable && discardBtn("mt-3 w-full sm:hidden")}
```

เป็น:

```tsx
      {!isDiscarded && discardBtn("mt-3 w-full sm:hidden")}
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่ชี้มายัง `StandardDailyRow.tsx`

Run: `npm run lint`
Expected: ไม่มี error ใหม่ (เตือนว่า `fmtTime`/`time` unused ต้องไม่มี — ลบไปหมดแล้ว)

- [ ] **Step 6: Commit**

```bash
git add src/components/lis/stock/StandardDailyRow.tsx
git commit -m "feat(stock): StandardDailyRow discard any live status + date label

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: แยก StandardUnitList + refactor StandardDailyPanel ให้ใช้

**Files:**
- Create: `src/components/lis/stock/StandardUnitList.tsx`
- Modify: `src/components/lis/stock/StandardDailyPanel.tsx`

**Interfaces:**
- Consumes: `StandardDailyRow`, `PerformanceDropDialog`, `StandardUnitDetailDialog`, `useQueryClient`, `StockUnitItem`
- Produces: `export default function StandardUnitList(props: { units: StockUnitItem[] })`

- [ ] **Step 1: สร้าง StandardUnitList** — `src/components/lis/stock/StandardUnitList.tsx`

```tsx
// src/components/lis/stock/StandardUnitList.tsx
// list working standard rows + ถือ dialog แจ้งทิ้ง/ดูรายละเอียด — ใช้ร่วมการ์ดวันนี้ + แท็บ Standard ใช้งานอยู่
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import PerformanceDropDialog from "@/components/lis/stock/PerformanceDropDialog";
import StandardDailyRow from "@/components/lis/stock/StandardDailyRow";
import StandardUnitDetailDialog from "@/components/lis/stock/StandardUnitDetailDialog";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  units: StockUnitItem[];
}

export default function StandardUnitList({ units }: Props) {
  const qc = useQueryClient();
  const [discardQr, setDiscardQr] = useState("");
  const [detailQr, setDetailQr] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  return (
    <div className="space-y-2">
      {units.map((u) => (
        <StandardDailyRow key={u._id} unit={u} onDiscard={setDiscardQr} onDetail={setDetailQr} />
      ))}

      {discardQr && (
        <PerformanceDropDialog qrId={discardQr} onClose={() => setDiscardQr("")} onSaved={refresh} />
      )}
      {detailQr && (
        <StandardUnitDetailDialog qrId={detailQr} onClose={() => setDetailQr("")} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: refactor StandardDailyPanel** — แทนทั้งไฟล์ `src/components/lis/stock/StandardDailyPanel.tsx`

```tsx
// src/components/lis/stock/StandardDailyPanel.tsx
// การ์ด "Standard ที่แบ่งวันนี้" — working units ที่แบ่งวันนี้ (5 แถวแรก) + ปุ่มดูทั้งหมด
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Package } from "lucide-react";

import StandardUnitList from "@/components/lis/stock/StandardUnitList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { todayWorkingUnits } from "@/lib/standardStatus";

interface Props {
  /** ปุ่ม "ดูรายการ Standard ทั้งหมด" → แท็บ Standard ใช้งานอยู่ */
  onViewAll: () => void;
}

const PREVIEW_LIMIT = 5;

export default function StandardDailyPanel({ onViewAll }: Props) {
  const { data: units = [] } = useQuery({
    queryKey: ["stock", "units", "working"],
    queryFn: () => api.getStockUnits({ kind: "working" }),
  });

  const today = useMemo(() => todayWorkingUnits(units), [units]);
  const shown = today.slice(0, PREVIEW_LIMIT);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Standard ที่แบ่งวันนี้
          </span>
          {today.length > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
              {today.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {today.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Package className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">ยังไม่มีการแบ่งวันนี้</p>
          </div>
        ) : (
          <div className="space-y-2">
            <StandardUnitList units={shown} />
            {today.length > PREVIEW_LIMIT && (
              <Button variant="ghost" className="w-full text-primary" onClick={onViewAll}>
                ดูรายการ Standard ทั้งหมด ({today.length})
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Type-check + test + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่ชี้มายัง `StandardUnitList.tsx` / `StandardDailyPanel.tsx`

Run: `npm run test -- standardStatus`
Expected: PASS (logic ไม่เปลี่ยน)

Run: `npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 4: Commit**

```bash
git add src/components/lis/stock/StandardUnitList.tsx src/components/lis/stock/StandardDailyPanel.tsx
git commit -m "refactor(stock): extract StandardUnitList shared by daily panel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: StandardWorkingPanel (body ของแท็บใหม่)

**Files:**
- Create: `src/components/lis/stock/StandardWorkingPanel.tsx`

**Interfaces:**
- Consumes: `StandardUnitList` (Task 3), `activeWorkingUnits`, `StandardStatusFilter` (Task 1), `api.getStockUnits`, shadcn `Input` (`@/components/ui/input`), `Select` (`@/components/ui/select`)
- Produces: `export default function StandardWorkingPanel()` (ไม่มี props)

- [ ] **Step 1: สร้างไฟล์** — `src/components/lis/stock/StandardWorkingPanel.tsx`

```tsx
// src/components/lis/stock/StandardWorkingPanel.tsx
// แท็บ "Standard ใช้งานอยู่" — working standard ทุกตัวที่ยังไม่ทิ้ง + ค้นหา + filter สถานะ → แจ้งทิ้งได้
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";

import StandardUnitList from "@/components/lis/stock/StandardUnitList";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { activeWorkingUnits, type StandardStatusFilter } from "@/lib/standardStatus";

export default function StandardWorkingPanel() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StandardStatusFilter>("all");

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["stock", "units", "working"],
    queryFn: () => api.getStockUnits({ kind: "working" }),
  });

  const rows = useMemo(
    () => activeWorkingUnits(units, { search, statusFilter }),
    [units, search, statusFilter],
  );
  const hasAny = units.some((u) => u.kind === "working" && u.status !== "discarded");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / code standard"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StandardStatusFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="usable">พร้อมใช้งาน</SelectItem>
            <SelectItem value="attention">ต้องจัดการ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-10 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Package className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            {hasAny ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มี Standard ที่กำลังใช้งาน"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{rows.length} รายการ</p>
          <StandardUnitList units={rows} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่ชี้มายัง `StandardWorkingPanel.tsx`

Run: `npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/stock/StandardWorkingPanel.tsx
git commit -m "feat(stock): StandardWorkingPanel — all working standards + search/filter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: ต่อแท็บ "Standard ใช้งานอยู่" ใน StockDeduction + deep-link

**Files:**
- Modify: `src/pages/StockDeduction.tsx`

**Interfaces:**
- Consumes: `StandardWorkingPanel` (Task 4)
- Produces: (ไม่มี export ใหม่)

- [ ] **Step 1: เพิ่ม import** — ต่อจาก import `StockRequisitionTab`

```tsx
import StandardWorkingPanel from "@/components/lis/stock/StandardWorkingPanel";
```

- [ ] **Step 2: เปลี่ยน viewAllStandards ให้ไปแท็บใหม่** — แทนฟังก์ชัน

แทน:

```tsx
  const viewAllStandards = () => {
    setType("standard");
    setTab("history");
  };
```

เป็น:

```tsx
  const viewAllStandards = () => {
    setTab("working");
  };
```

- [ ] **Step 3: เพิ่ม TabsTrigger** — แทนบล็อก `TabsList`

แทน:

```tsx
        <TabsList className="mb-4">
          <TabsTrigger value="requisition">เบิก stock</TabsTrigger>
          <TabsTrigger value="history">ประวัติ</TabsTrigger>
        </TabsList>
```

เป็น:

```tsx
        <TabsList className="mb-4">
          <TabsTrigger value="requisition">เบิก stock</TabsTrigger>
          <TabsTrigger value="working">Standard ใช้งานอยู่</TabsTrigger>
          <TabsTrigger value="history">ประวัติ</TabsTrigger>
        </TabsList>
```

- [ ] **Step 4: เพิ่ม TabsContent** — แทรกหลัง `</TabsContent>` ของ `requisition` (ก่อน `TabsContent value="history"`)

```tsx
        <TabsContent value="working">
          <StandardWorkingPanel />
        </TabsContent>
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่ชี้มายัง `StockDeduction.tsx` (`setType` ยังถูกใช้ในแท็บ history — ไม่ควรมี warning unused)

Run: `npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 6: Commit**

```bash
git add src/pages/StockDeduction.tsx
git commit -m "feat(stock): add 'Standard ใช้งานอยู่' tab + retarget view-all deep-link

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: StandardRequisitionDialog → split-only (ตัด reuse working)

**Files:**
- Modify: `src/components/lis/stock/StandardRequisitionDialog.tsx`

**Interfaces:**
- Consumes: (คงเดิม) `WithdrawDialog`, `StockQrScanner`, `buildUnitTree`, `parseScannedQrId`, `pickFefoSealed`, `unitDerivedStatus`
- Produces: props เดิม `{ onClose, onSaved }` คงเดิม

- [ ] **Step 1: ลบ imports ที่เลิกใช้** — ลบ 3 บรรทัดนี้

```tsx
import PerformanceDropDialog from "@/components/lis/stock/PerformanceDropDialog";
import { Badge } from "@/components/ui/badge";
import { standardStatusMeta } from "@/lib/standardStatus";
```

(คง import อื่นไว้; `buildUnitTree`, `parseScannedQrId`, `pickFefoSealed`, `unitDerivedStatus` ยังใช้กับ sealed list)

- [ ] **Step 2: ลบ state + logic reuse** — ลบบรรทัด state

```tsx
  const [perfDropQr, setPerfDropQr] = useState("");        // working qrId ที่จะแจ้ง/ทิ้ง
```

ลบตัวแปร `workings`:

```tsx
  const workings = units.filter((u) => u.kind === "working" && u.status !== "discarded");
```

ลบฟังก์ชัน `reuse` ทั้งก้อน:

```tsx
  const reuse = (u: StockUnitItem) => {
    toast.success(`ใช้ working ${labelOf.get(u._id) ?? u.qrId} (ยังใช้ได้ — ไม่ต้องแบ่งใหม่)`);
    onSaved();
    onClose();
  };
```

- [ ] **Step 3: อัปเดตคำอธิบาย dialog** — แทน DialogDescription

แทน:

```tsx
            <DialogDescription>เลือก standard แล้วใช้ working เดิม หรือแบ่ง working ใหม่จากขวด sealed</DialogDescription>
```

เป็น:

```tsx
            <DialogDescription>เลือก standard แล้วแบ่ง working ใหม่จากขวด sealed</DialogDescription>
```

- [ ] **Step 4: ลบบล็อก "working ที่มี"** — ลบทั้ง `<div>` นี้ (อยู่ต้นสุดใน `{code && (<>...`)

```tsx
                <div>
                  <Label className="mb-1.5 block">working ที่มี</Label>
                  {workings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">ยังไม่มี working — แบ่งใหม่ด้านล่าง</p>
                  ) : (
                    <ul className="divide-y rounded border">
                      {workings.map((u) => {
                        const meta = standardStatusMeta(u);
                        return (
                          <li key={u._id} className="flex items-center gap-2 p-2 text-sm">
                            <span className="w-10 text-xs text-muted-foreground">{labelOf.get(u._id) ?? "-"}</span>
                            <Badge className={cn("text-xs", meta.cls)}>{meta.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {u.volume?.remaining ?? "-"} {u.volume?.unit} · EXP {u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}
                            </span>
                            <span className="ml-auto flex gap-1">
                              {meta.usable && <Button type="button" size="sm" onClick={() => reuse(u)}>ใช้อันนี้</Button>}
                              <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setPerfDropQr(u.qrId)}>
                                แจ้ง/ทิ้ง
                              </Button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

```

(เหลือเฉพาะ `<div>` "แบ่ง working ใหม่จากขวด sealed" ภายใน `{code && (<> ... </>)}`)

- [ ] **Step 5: ลบ PerformanceDropDialog ท้ายไฟล์** — ลบบล็อกนี้

```tsx
      {perfDropQr && (
        <PerformanceDropDialog
          qrId={perfDropQr}
          onClose={() => setPerfDropQr("")}
          onSaved={() => { refresh(); onSaved(); }}
        />
      )}
```

- [ ] **Step 6: Type-check + lint** — จับ import/ตัวแปรที่ค้าง

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่ชี้มายัง `StandardRequisitionDialog.tsx`

Run: `npm run lint`
Expected: ไม่มี error/warning unused ใหม่ (เช็คว่า `cn`, `Button`, `Label`, `StockUnitItem` ยังถูกใช้ในส่วน sealed ที่เหลือ — ถ้าตัวไหนไม่ถูกใช้แล้วให้ลบ import ตัวนั้นด้วย)

- [ ] **Step 7: Commit**

```bash
git add src/components/lis/stock/StandardRequisitionDialog.tsx
git commit -m "feat(stock): StandardRequisitionDialog split-only (drop reuse working)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## After all tasks — Manual E2E (บนเครื่อง user, ต้องรัน frontend + backend)

1. เบิก stock → เลือก "Standard" → dialog มีแต่ "แบ่งใหม่จากขวด sealed" (ไม่มี working list / ปุ่มใช้อันนี้) → แบ่งได้ปกติ
2. แท็บ "Standard ใช้งานอยู่": เห็น working ทุกตัวที่ยังไม่ทิ้ง หลาย standard เรียงตาม code
3. ค้นหา (ชื่อ/code) + filter สถานะ "พร้อมใช้งาน"/"ต้องจัดการ" ทำงานถูก
4. แจ้งทิ้งตัวที่ "หมดอายุ"/"หมดความถี่" ได้ (ไม่ใช่แค่ active) → เลือกเหตุผล → ยืนยัน → หายจากแท็บ
5. เมนู ⋮ → ดูรายละเอียด working
6. การ์ด "Standard ที่แบ่งวันนี้" (เมื่อ >5 แถว) ปุ่ม "ดูรายการทั้งหมด" → เด้งไปแท็บ "Standard ใช้งานอยู่"
7. มือถือ: ปุ่มแจ้งทิ้งตกลงเต็มความกว้าง, ⋮ มุมขวา

## Self-Review (ผู้เขียน plan ตรวจกับ spec แล้ว)
- ครอบทุกข้อ spec: ข้อ1 (Task 6), ข้อ2/แท็บ (Task 4+5), แจ้ง=ทิ้ง (reuse dialog, Task 3/4), A deep-link (Task 5 step 2), B เรียง code (Task 1 `activeWorkingUnits` sort), แก้ row (Task 2), แยก list (Task 3), helper+test (Task 1)
- ไม่มี placeholder; โค้ดครบทุก step
- ชื่อ/type ตรงกันข้ามงาน: `activeWorkingUnits`, `StandardStatusFilter`, `splitTimeLabel`, `StandardUnitList({units})` ใช้ชื่อเดียวกันทุกที่
