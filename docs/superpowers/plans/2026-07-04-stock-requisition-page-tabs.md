# การเบิก stock (2 แท็บ) + ย้ายเบิกสารเคมีออกจากห้องวิเคราะห์ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนเมนู/หน้า "การบันทึก Standard" (`/stock-deduction`) เป็น "การเบิก stock" แบบ 2 แท็บ (เบิก stock / ประวัติ) โดยย้าย UI เบิกสารเคมีมาจากห้องวิเคราะห์ แล้วถอดออกจากห้องวิเคราะห์

**Architecture:** ดึง UI เบิกสารเคมี (ปุ่ม + list วันนี้ + dialog + ลบ/คืนสต็อก) จาก `RoomEquipmentCheckPage` ออกมาเป็น component กลาง `ChemicalRequisitionPanel` แล้วเอาไปวางในแท็บ "เบิก stock" ของหน้า `StockDeduction`; ตารางประวัติเดิมย้ายไปอยู่แท็บ "ประวัติ". ไม่แตะ backend/model/API — ใช้ endpoint `chemical-requisitions` เดิมทั้งหมด และ `roomSlug` คงเป็น `"analysis"`.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack React Query. ไม่มี dependency ใหม่.

## Global Constraints

- ทุก label UI เป็นภาษาไทย (ตาม repo).
- **path `/stock-deduction` ห้ามเปลี่ยน** — access-control เป็น path-based และโรล Lab มีสิทธิ์ path นี้อยู่แล้ว.
- **ห้ามแตะ backend/model/API endpoint** ของ `chemical-requisitions` หรือ `StockTransaction`. ไม่ migrate ข้อมูล.
- `roomSlug` ของ requisition ยึด `"analysis"` (`ANALYSIS_ROOM_SLUG`) เพื่อให้ข้อมูลเดิมโชว์ต่อเนื่อง.
- v1 แท็บ "เบิก stock" = solvent อย่างเดียว (ไม่รวม standard/glassware).
- **Type-check จริง** = `npx tsc -p tsconfig.app.json --noEmit` (root `tsc --noEmit` เป็น no-op). repo มี ~12 pre-existing error ค้างอยู่ — task ผ่านเมื่อ **ไม่มี error ใหม่ที่ชี้ไฟล์ที่ task แตะ** (กรองด้วย grep ชื่อไฟล์).
- **ห้ามรัน `npm run build`** ระหว่างพัฒนา (ใช้ tsc แทน).
- commit ด้วย **explicit pathspec** เสมอ (repo มี process อื่น commit แทรกได้).

---

### Task 1: สร้าง component `ChemicalRequisitionPanel`

**Files:**
- Create: `src/components/lis/ChemicalRequisitionPanel.tsx`

**Interfaces:**
- Consumes: `api.getChemicalRequisitions({room,date})`, `api.deleteChemicalRequisition(id)`, `ChemicalRequisitionDialog` (props `{ roomSlug, instruments, presetInstrumentId?, onClose, onSaved }`), `todayStr` จาก `@/lib/chemicalRequisition`.
- Produces: `export default function ChemicalRequisitionPanel(props: { roomSlug: string; instruments: { id: string; name: string }[] }): JSX.Element` — Task 2 นำไปใช้.

- [ ] **Step 1: เขียนไฟล์ component**

Create `src/components/lis/ChemicalRequisitionPanel.tsx`:

```tsx
// src/components/lis/ChemicalRequisitionPanel.tsx
// การ์ดเบิกสารเคมี (solvent) — ปุ่มเปิด dialog + รายการที่เบิกวันนี้ + ยกเลิก/คืนสต็อก.
// ย้ายมาจากการ์ดบนของ RoomEquipmentCheckPage เพื่อใช้ในหน้า "การเบิก stock".
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Plus, X } from "lucide-react";
import { toast } from "sonner";

import ChemicalRequisitionDialog from "@/components/lis/daily-check/ChemicalRequisitionDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { todayStr } from "@/lib/chemicalRequisition";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

interface Props {
  roomSlug: string;
  instruments: { id: string; name: string }[];
}

export default function ChemicalRequisitionPanel({ roomSlug, instruments }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: requisitions = [] } = useQuery({
    queryKey: ["chemical-requisitions", roomSlug, todayStr()],
    queryFn: () => api.getChemicalRequisitions({ room: roomSlug, date: todayStr() }),
    refetchOnWindowFocus: true,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteChemicalRequisition(id),
    onSuccess: () => {
      toast.success("ยกเลิกการเบิกแล้ว (คืนสต็อก)");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || "ยกเลิกไม่สำเร็จ"),
  });

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-primary" />
          เบิกสารเคมีวันนี้
        </CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          เบิกสารเคมี
        </Button>
      </CardHeader>
      <CardContent>
        {requisitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีการเบิกวันนี้</p>
        ) : (
          <ul className="divide-y">
            {requisitions.map((req) => (
              <li key={req._id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="w-12 text-xs tabular-nums text-muted-foreground">
                  {req.createdAt ? fmtTime(req.createdAt) : ""}
                </span>
                <span className="font-medium">{req.solventName}</span>
                <span className="text-muted-foreground">x {req.qty} ขวด</span>
                <span className="text-muted-foreground">to {req.instrumentName}</span>
                {req.requestedBy?.name && (
                  <span className="text-xs text-muted-foreground">by {req.requestedBy.name}</span>
                )}
                <button
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  title="ยกเลิกการเบิก (คืนสต็อก)"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`ยกเลิกการเบิก ${req.solventName} x ${req.qty} ขวด และคืนสต็อก?`)) {
                      deleteMutation.mutate(req._id);
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {dialogOpen && (
        <ChemicalRequisitionDialog
          roomSlug={roomSlug}
          instruments={instruments}
          onClose={() => setDialogOpen(false)}
          onSaved={invalidate}
        />
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Type-check — ไม่มี error ใหม่ชี้ไฟล์นี้**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "ChemicalRequisitionPanel"`
Expected: ไม่มี output (empty) — ไฟล์ใหม่ไม่มี type error.

- [ ] **Step 3: Lint ไฟล์ใหม่**

Run: `npm run lint`
Expected: ไม่มี error ใหม่ (ทุก import ในไฟล์ถูกใช้: `useState`, `useMutation`, `useQuery`, `useQueryClient`, `FlaskConical`, `Plus`, `X`, `toast`, `ChemicalRequisitionDialog`, `Button`, `Card*`, `api`, `todayStr`).

- [ ] **Step 4: รัน test suite ให้ยังเขียว**

Run: `npm run test`
Expected: PASS ทั้งหมด (ไม่มี logic ใหม่ที่ต้องเทสต์ — helper `todayStr`/`groupRequisitionsByInstrument`/`validateRequisitionQty` มี test เดิมอยู่แล้ว).

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/ChemicalRequisitionPanel.tsx
git commit -m "feat: add ChemicalRequisitionPanel (extract requisition UI for reuse)" -- src/components/lis/ChemicalRequisitionPanel.tsx
```

---

### Task 2: หน้า `StockDeduction` เป็น 2 แท็บ + เปลี่ยน label เมนู

**Files:**
- Modify: `src/pages/StockDeduction.tsx` (rewrite ทั้งไฟล์)
- Modify: `src/lib/navItems.ts:38`

**Interfaces:**
- Consumes: `ChemicalRequisitionPanel` (Task 1), `Tabs/TabsList/TabsTrigger/TabsContent` จาก `@/components/ui/tabs`, `ANALYSIS_ROOM_SLUG` จาก `@/lib/analysisInstruments`, `getRoomCatalog` จาก `@/lib/roomEquipment`.
- Produces: หน้า `/stock-deduction` มี 2 แท็บ; เมนูขึ้น "การเบิก stock".

- [ ] **Step 1: เปลี่ยน label เมนู**

ใน `src/lib/navItems.ts` แก้บรรทัดที่ 38:

เดิม:
```ts
  { icon: ClipboardList, label: "การบันทึก Standard", path: "/stock-deduction" },
```
ใหม่:
```ts
  { icon: ClipboardList, label: "การเบิก stock", path: "/stock-deduction" },
```

- [ ] **Step 2: Rewrite `StockDeduction.tsx` เป็น 2 แท็บ**

แทนที่ทั้งไฟล์ `src/pages/StockDeduction.tsx` ด้วย:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Filter } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import ChemicalRequisitionPanel from "@/components/lis/ChemicalRequisitionPanel";
import { ANALYSIS_ROOM_SLUG } from "@/lib/analysisInstruments";
import { getRoomCatalog } from "@/lib/roomEquipment";
import type { StockTransactionItem } from "@/types/stock";

const analysisInstruments =
  getRoomCatalog(ANALYSIS_ROOM_SLUG)?.instruments.map((i) => ({ id: i.id, name: i.name })) ?? [];

const StockDeduction = () => {
  const [type, setType] = useState<string>("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["stock-deductions", type],
    queryFn: () =>
      api.getStockTransactions({
        action: "deduct",
        itemType: type || undefined,
        limit: 200,
      }),
  });

  const columns: DataTableColumn<StockTransactionItem>[] = [
    {
      key: "time",
      header: "เวลา",
      className: "text-xs whitespace-nowrap",
      cell: (t) => new Date(t.createdAt).toLocaleString("th-TH"),
    },
    { key: "type", header: "หมวด", cell: (t) => <Badge variant="outline">{t.itemType}</Badge> },
    {
      key: "item",
      header: "รายการ",
      cell: (t) => (
        <>
          <div className="font-medium">{t.itemName}</div>
          {t.itemCode && <div className="text-xs text-muted-foreground">{t.itemCode}</div>}
        </>
      ),
    },
    { key: "tier", header: "Tier", cell: (t) => (t.tier ? <Badge variant="outline">{t.tier}</Badge> : "-") },
    {
      key: "delta",
      header: "จำนวนที่ตัด",
      className: "text-right font-mono text-destructive",
      cell: (t) => `${t.delta != null ? t.delta : "-"} ${t.unit || ""}`,
    },
    {
      key: "remaining",
      header: "คงเหลือ",
      className: "text-sm",
      cell: (t) => (
        <>
          {t.beforeQty ?? "-"} → <strong>{t.afterQty ?? "-"}</strong>
        </>
      ),
    },
    {
      key: "sample",
      header: "Sample ID",
      className: "text-xs",
      cell: (t) => (t.sampleId ? <Badge variant="outline">{t.sampleId}</Badge> : "-"),
    },
    { key: "user", header: "ผู้ดำเนินการ", className: "text-xs", cell: (t) => t.userName || t.userEmail || "-" },
    { key: "note", header: "หมายเหตุ", className: "text-xs text-muted-foreground", cell: (t) => t.note || "" },
  ];

  return (
    <AppLayout>
      <PageHeader
        className="mb-6"
        title={
          <span className="inline-flex items-center gap-2">
            <History className="w-6 h-6" />
            การเบิก stock
          </span>
        }
        description="เบิกสารเคมีให้เครื่อง และดูประวัติการตัด stock"
      />

      <Tabs defaultValue="requisition">
        <TabsList className="mb-4">
          <TabsTrigger value="requisition">เบิก stock</TabsTrigger>
          <TabsTrigger value="history">ประวัติ</TabsTrigger>
        </TabsList>

        <TabsContent value="requisition">
          <ChemicalRequisitionPanel roomSlug={ANALYSIS_ROOM_SLUG} instruments={analysisInstruments} />
        </TabsContent>

        <TabsContent value="history">
          <div className="mb-3 flex items-center justify-end gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue placeholder="ทุกหมวด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวด</SelectItem>
                <SelectItem value="standard">Standards</SelectItem>
                <SelectItem value="solvent">สารเคมี</SelectItem>
                <SelectItem value="glassware">เครื่องแก้ว</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DataTable
            columns={columns}
            data={data}
            rowKey={(t) => t._id}
            isLoading={isLoading}
            emptyTitle="ยังไม่มีรายการตัด stock"
            tableClassName="min-w-[900px]"
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default StockDeduction;
```

- [ ] **Step 3: Type-check — ไม่มี error ใหม่ชี้ไฟล์ที่แตะ**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "StockDeduction|navItems"`
Expected: ไม่มี output (empty).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่.

- [ ] **Step 5: รัน test suite**

Run: `npm run test`
Expected: PASS ทั้งหมด.

- [ ] **Step 6: Manual smoke (dev server ต้องรันอยู่)**

เปิด `/stock-deduction` → เห็นหัวข้อ "การเบิก stock" + 2 แท็บ. แท็บ "เบิก stock" โชว์การ์ด "เบิกสารเคมีวันนี้" + ปุ่ม. แท็บ "ประวัติ" โชว์ตาราง + filter หมวด. เมนูซ้ายขึ้น "การเบิก stock".

- [ ] **Step 7: Commit**

```bash
git add src/pages/StockDeduction.tsx src/lib/navItems.ts
git commit -m "feat: การเบิก stock page with 2 tabs (requisition + history), rename nav" -- src/pages/StockDeduction.tsx src/lib/navItems.ts
```

---

### Task 3: ถอดส่วนเบิกสารเคมีออกจาก `RoomEquipmentCheckPage`

**Files:**
- Modify: `src/pages/daily-check/RoomEquipmentCheckPage.tsx`

**Interfaces:**
- Produces: `RoomEquipmentCheckPage` เหลือแค่ "เช็กการทำงานเครื่องมือ" ล้วน (ไม่มี requisition ในทุกห้อง รวมทั้ง analysis).

- [ ] **Step 1: แทนที่ import block (บรรทัด 1–27)**

เดิม:
```tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FlaskConical,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import ChemicalRequisitionDialog from "@/components/lis/daily-check/ChemicalRequisitionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { ANALYSIS_ROOM_SLUG } from "@/lib/analysisInstruments";
import {
  groupRequisitionsByInstrument,
  todayStr as reqTodayStr,
} from "@/lib/chemicalRequisition";
import { getRoomBySlug } from "@/lib/dailyCheckRooms";
import { api, type EquipmentCheckRecord, type EquipmentReading } from "@/lib/api";
import { getRoomCatalog } from "@/lib/roomEquipment";
```
ใหม่ (ตัด `FlaskConical`, `Plus`, `X`, `ChemicalRequisitionDialog`, `ANALYSIS_ROOM_SLUG`, และ import `chemicalRequisition` ทั้งก้อน):
```tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { getRoomBySlug } from "@/lib/dailyCheckRooms";
import { api, type EquipmentCheckRecord, type EquipmentReading } from "@/lib/api";
import { getRoomCatalog } from "@/lib/roomEquipment";
```

- [ ] **Step 2: ลบ state `reqDialog`**

ลบก้อนนี้ (อยู่หลัง `const [drafts, setDrafts] = useState...`):
```tsx
  const [reqDialog, setReqDialog] = useState<{ open: boolean; presetInstrumentId?: string }>({
    open: false,
  });
```

- [ ] **Step 3: ลบ `isAnalysis` + requisitions query + reqByInstrument + deleteReqMutation + onReqSaved**

ลบก้อนนี้ทั้งหมด (อยู่หลัง `createMutation` ก่อน `if (!room || !catalog)`):
```tsx
  const isAnalysis = roomSlug === ANALYSIS_ROOM_SLUG;

  const { data: requisitions = [] } = useQuery({
    queryKey: ["chemical-requisitions", roomSlug, reqTodayStr()],
    queryFn: () => api.getChemicalRequisitions({ room: roomSlug, date: reqTodayStr() }),
    enabled: isAnalysis,
    refetchOnWindowFocus: true,
  });

  const reqByInstrument = useMemo(
    () => groupRequisitionsByInstrument(requisitions),
    [requisitions],
  );

  const deleteReqMutation = useMutation({
    mutationFn: (id: string) => api.deleteChemicalRequisition(id),
    onSuccess: () => {
      toast.success("ยกเลิกการเบิกแล้ว (คืนสต็อก)");
      queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
      queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
    },
    onError: (err: Error) => toast.error(err.message || "ยกเลิกไม่สำเร็จ"),
  });

  const onReqSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };
```

> `useMemo`, `useMutation`, `useQuery`, `queryClient` ยังถูกใช้โดย `latestByInstrument`/`createMutation`/`todayRecords` — คงไว้.

- [ ] **Step 4: ลบการ์ด "เบิกสารเคมีวันนี้"**

ลบก้อนนี้ทั้งหมด (อยู่หลัง header `<div className="mb-4 ...">...</div>` ก่อน `<div className="space-y-6">`):
```tsx
      {isAnalysis && (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4 text-primary" />
              เบิกสารเคมีวันนี้
            </CardTitle>
            <Button size="sm" onClick={() => setReqDialog({ open: true })}>
              <Plus className="mr-1 h-4 w-4" />
              เบิกสารเคมี
            </Button>
          </CardHeader>
          <CardContent>
            {requisitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีการเบิกวันนี้</p>
            ) : (
              <ul className="divide-y">
                {requisitions.map((req) => (
                  <li key={req._id} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="w-12 text-xs tabular-nums text-muted-foreground">
                      {req.createdAt ? fmtTime(req.createdAt) : ""}
                    </span>
                    <span className="font-medium">{req.solventName}</span>
                    <span className="text-muted-foreground">x {req.qty} ขวด</span>
                    <span className="text-muted-foreground">to {req.instrumentName}</span>
                    {req.requestedBy?.name && (
                      <span className="text-xs text-muted-foreground">
                        by {req.requestedBy.name}
                      </span>
                    )}
                    <button
                      type="button"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      title="ยกเลิกการเบิก (คืนสต็อก)"
                      disabled={deleteReqMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`ยกเลิกการเบิก ${req.solventName} x ${req.qty} ขวด และคืนสต็อก?`)) {
                          deleteReqMutation.mutate(req._id);
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
```

> หลังลบก้อนนี้ helper `fmtTime` ยังถูกใช้ในการ์ดเครื่อง (`ตรวจล่าสุด`) — คงไว้.

- [ ] **Step 5: ลบบล็อก "สารเคมีที่เบิกวันนี้" ใต้การ์ดเครื่อง**

ลบก้อนนี้ (อยู่ใน `CardContent` ของแต่ละเครื่อง ก่อนบล็อกปุ่ม `{showResult ? (...) : (...)}`):
```tsx
                        {isAnalysis && (
                          <div className="border-t pt-3">
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                สารเคมีที่เบิกวันนี้
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 text-xs"
                                onClick={() => setReqDialog({ open: true, presetInstrumentId: instrument.id })}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                เบิกให้เครื่องนี้
                              </Button>
                            </div>
                            {(reqByInstrument[instrument.id] ?? []).length === 0 ? (
                              <p className="text-xs text-muted-foreground/70">-</p>
                            ) : (
                              <ul className="space-y-0.5">
                                {(reqByInstrument[instrument.id] ?? []).map((req) => (
                                  <li key={req._id} className="text-xs text-muted-foreground">
                                    {req.solventName} x {req.qty} ขวด
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
```

- [ ] **Step 6: ลบ render `<ChemicalRequisitionDialog/>` ท้าย component**

ลบก้อนนี้ (อยู่ก่อน `</>` ปิดท้าย return):
```tsx
      {reqDialog.open && (
        <ChemicalRequisitionDialog
          roomSlug={roomSlug}
          instruments={instruments.map((instrument) => ({
            id: instrument.id,
            name: instrument.name,
          }))}
          presetInstrumentId={reqDialog.presetInstrumentId}
          onClose={() => setReqDialog({ open: false })}
          onSaved={onReqSaved}
        />
      )}
```

> หลังลบ ปีกกา return จะเหลือ `<div className="space-y-6">...</div>` เป็น element สุดท้ายก่อน `</>`. ถ้า `<>...</>` เหลือลูกคนเดียว ปล่อย fragment ไว้ได้ (ไม่ต้องแก้เป็น element เดียว) — ไม่กระทบ.

- [ ] **Step 7: Type-check — ไม่มี error ใหม่ชี้ไฟล์นี้ (จับ import/ตัวแปรที่ค้าง)**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "RoomEquipmentCheckPage"`
Expected: ไม่มี output (empty). ถ้ามี error เช่น "X is declared but never used" หรือ "Cannot find name reqByInstrument" แปลว่าลบไม่ครบ → แก้ให้หมด.

- [ ] **Step 8: Lint (จับ unused import/var โดยเฉพาะ)**

Run: `npm run lint`
Expected: ไม่มี error ใหม่ — ยืนยันไม่มี import/ตัวแปรค้าง (`FlaskConical`, `Plus`, `X`, `reqDialog`, `isAnalysis`, `reqByInstrument`, `deleteReqMutation`, `onReqSaved`, `reqTodayStr`, `groupRequisitionsByInstrument`, `ANALYSIS_ROOM_SLUG`, `ChemicalRequisitionDialog` ต้องไม่เหลือ).

- [ ] **Step 9: รัน test suite**

Run: `npm run test`
Expected: PASS ทั้งหมด.

- [ ] **Step 10: Manual smoke (dev server)**

เปิด `/daily-check/analysis` → **ไม่มี** การ์ด "เบิกสารเคมีวันนี้" และ **ไม่มี** บล็อก "สารเคมีที่เบิกวันนี้" ใต้การ์ดเครื่อง เหลือแค่เช็กเครื่อง. เปิดห้องอื่น (`sample-prep`, `extraction`, `balance`) ทำงานปกติ.

- [ ] **Step 11: Commit**

```bash
git add src/pages/daily-check/RoomEquipmentCheckPage.tsx
git commit -m "refactor: remove chemical requisition from analysis room (moved to การเบิก stock)" -- src/pages/daily-check/RoomEquipmentCheckPage.tsx
```

---

## หลังทำครบ 3 tasks — Verification รวม (ผู้ใช้รันบนเครื่อง)

1. **เมนู**: ซ้ายขึ้น "การเบิก stock" (ไม่ใช่ "การบันทึก Standard").
2. **แท็บเบิก stock**: เบิก solvent A ×2 ให้ GC 8890 → toast สำเร็จ → โผล่ในรายการวันนี้ + qty solvent ลด 2. ลบรายการ → คืนสต็อก. รายการที่เคยเบิกไว้ก่อนย้าย (roomSlug `analysis`) ยังโชว์.
3. **แท็บประวัติ**: ตาราง + filter หมวด (standard/solvent/glassware) ทำงานเหมือนเดิม; การเบิกจากแท็บใหม่โผล่ในประวัติ (itemType solvent).
4. **ห้องวิเคราะห์**: `/daily-check/analysis` ไม่มีส่วนเบิกสารเคมีแล้ว.
5. **สิทธิ์**: โรล Lab เข้า `/stock-deduction` ได้อยู่แล้ว (seed มี path นี้ใน role `lab` + group `lab`). ตรวจ DB จริงผ่าน Access Control ว่าโรลที่ต้องเบิกมี `/stock-deduction` — ถ้า live DB drift ไปให้เพิ่ม path ผ่านหน้า Access Control.

## Self-Review Notes (ผู้เขียนแผนตรวจแล้ว)

- **Spec coverage**: rename เมนู (Task 2 Step 1) ✓; 2 แท็บ (Task 2) ✓; panel reuse (Task 1) ✓; ถอดจากห้องวิเคราะห์ (Task 3) ✓; permissions (Verification #5) ✓; ไม่แตะ backend ✓.
- **Placeholder scan**: ไม่มี TBD/TODO; ทุก step มีโค้ด/คำสั่งจริง.
- **Type consistency**: `ChemicalRequisitionPanel` props `{ roomSlug, instruments: {id,name}[] }` ตรงกันระหว่าง Task 1 (นิยาม) และ Task 2 (เรียกใช้); `getRoomCatalog(...)?.instruments.map(i => ({id, name}))` ให้ `{id,name}[]` ตรง props; `ChemicalRequisitionDialog` props ตรงกับที่ panel ส่ง (`roomSlug, instruments, onClose, onSaved` — `presetInstrumentId` optional ไม่ส่งได้).
