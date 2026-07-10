# Parameter Detail Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** คลิกแถว parameter ในหน้า `/parameter-settings` แล้วเปิด Sheet drawer ด้านขวาแสดงรายละเอียดเต็มแบบ read-only (สเปค: `docs/superpowers/specs/2026-07-10-parameter-detail-drawer-design.md`)

**Architecture:** สร้าง component ใหม่ `ParameterDetailDrawer` (shadcn Sheet, pattern เดียวกับ `MasterItemDetailDrawer`) + ย้าย display helper ที่ต้อง share ออกจาก `ParameterSettings.tsx` (3,134 บรรทัด) ไป `src/lib/parameterDisplay.ts` + ทำแถวตารางคลิกได้ด้วย state `viewingId` (derive object สดทุก render)

**Tech Stack:** React 18 + TypeScript, shadcn/ui Sheet, Vitest + @testing-library/react, ไม่มี API/backend ใหม่

## Global Constraints

- ห้ามรัน `npm run build` — type-check ด้วย `npx tsc -p tsconfig.app.json --noEmit` (root tsconfig เป็น no-op; repo มี latent error เดิม ~12 ตัว — เทียบว่า**ไม่มี error ใหม่**เท่านั้น)
- commit ด้วย **explicit pathspec** ทุกครั้ง (มี process อื่น commit แทรกใน repo ได้)
- UI label เป็นภาษาไทยตามสเปค — copy ข้อความจากแผนนี้ตรงตัว
- ไม่แตะ `ParameterDialog`, `ParameterCriteriaTabs`, dialog เกณฑ์ทั้ง 3 ตัว, backend
- test ทั้ง repo ต้องเขียวก่อน commit ทุก task: `npm run test`

---

### Task 1: แยก display helpers ไป `src/lib/parameterDisplay.ts`

ย้าย `FIELD_TYPE_META` / `SCOPE_LABEL` / `SCOPE_BADGE_CLASS` / type `OptionFilter` / `summarizeOptionFilter` ออกจาก `ParameterSettings.tsx` เป็น module กลาง (drawer ใน Task 2 ต้องใช้) — **ย้ายโค้ดตรงตัว ไม่แก้ behavior**

**Files:**
- Create: `src/lib/parameterDisplay.ts`
- Create: `src/lib/parameterDisplay.test.ts`
- Modify: `src/pages/ParameterSettings.tsx` (ลบ copy เดิม + import)

**Interfaces:**
- Produces (Task 2/3 ใช้):
  - `FIELD_TYPE_META: Record<ParameterValueFieldType, { label: string; Icon: typeof TypeIcon; accent: string; tint: string; text: string; iconText: string }>`
  - `SCOPE_LABEL: Record<ParameterScope, string>` / `SCOPE_BADGE_CLASS: Record<ParameterScope, string>`
  - `type OptionFilter = { itemNames?: string[]; commonNames?: string[]; productTypes?: string[]; categories?: string[]; subCategories?: string[]; itemGroups?: string[] }`
  - `summarizeOptionFilter(f: OptionFilter | undefined, groupNameById?: Map<string, string>): string`

- [ ] **Step 1: เขียนเทสที่ fail ก่อน**

สร้าง `src/lib/parameterDisplay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FIELD_TYPE_META, SCOPE_LABEL, summarizeOptionFilter } from "@/lib/parameterDisplay";

describe("parameterDisplay", () => {
  it("FIELD_TYPE_META ครบทุกชนิด field", () => {
    for (const key of ["text", "number", "float", "enum", "timer", "photo", "file", "reference"] as const) {
      expect(FIELD_TYPE_META[key].label).toBeTruthy();
      expect(FIELD_TYPE_META[key].Icon).toBeTruthy();
    }
    expect(SCOPE_LABEL.qc).toBe("QC");
    expect(SCOPE_LABEL.lab).toBe("Lab");
  });

  it("summarizeOptionFilter: ว่าง/undefined → ''", () => {
    expect(summarizeOptionFilter(undefined)).toBe("");
    expect(summarizeOptionFilter({})).toBe("");
  });

  it("summarizeOptionFilter: itemNames เกิน 2 ตัด +N", () => {
    expect(summarizeOptionFilter({ itemNames: ["A", "B", "C"] })).toBe("item: A/B+1");
  });

  it("summarizeOptionFilter: resolve ชื่อกลุ่มผ่าน map", () => {
    const map = new Map([["g1", "กลุ่มน้ำ"]]);
    expect(summarizeOptionFilter({ itemGroups: ["g1"] }, map)).toBe("กลุ่ม: กลุ่มน้ำ");
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `npx vitest run src/lib/parameterDisplay.test.ts`
Expected: FAIL — `Cannot find module '@/lib/parameterDisplay'` (หรือ resolve error)

- [ ] **Step 3: สร้าง `src/lib/parameterDisplay.ts`**

โค้ดย้ายตรงตัวจาก `ParameterSettings.tsx` (บรรทัด ~267-275 `SCOPE_*`, ~635-710 `FIELD_TYPE_META`, ~779-786 `OptionFilter`, ~809-832 `summarizeOptionFilter`):

```ts
// Shared display metadata for Parameter UI (list page + detail drawer).
import {
  Hash,
  Image as ImageIcon,
  Link2,
  List as ListIcon,
  Paperclip,
  Timer as TimerIcon,
  Type as TypeIcon,
} from "lucide-react";

import type { ParameterScope, ParameterValueFieldType } from "@/lib/api";
import { productTypeLabels } from "@/lib/productClassification";

export const SCOPE_LABEL: Record<ParameterScope, string> = {
  lab: "Lab",
  qc: "QC",
};

export const SCOPE_BADGE_CLASS: Record<ParameterScope, string> = {
  lab: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  qc: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
};

export const FIELD_TYPE_META: Record<
  ParameterValueFieldType,
  {
    label: string;
    Icon: typeof TypeIcon;
    accent: string;
    tint: string;
    text: string;
    iconText: string;
  }
> = {
  text: {
    label: "ข้อความ",
    Icon: TypeIcon,
    accent: "bg-slate-400",
    tint: "bg-slate-50/60",
    text: "text-slate-700",
    iconText: "text-slate-500",
  },
  number: {
    label: "จำนวนเต็ม",
    Icon: Hash,
    accent: "bg-blue-500",
    tint: "bg-blue-50/50",
    text: "text-blue-700",
    iconText: "text-blue-500",
  },
  float: {
    label: "ทศนิยม",
    Icon: Hash,
    accent: "bg-blue-500",
    tint: "bg-blue-50/50",
    text: "text-blue-700",
    iconText: "text-blue-500",
  },
  enum: {
    label: "ตัวเลือก",
    Icon: ListIcon,
    accent: "bg-violet-500",
    tint: "bg-violet-50/50",
    text: "text-violet-700",
    iconText: "text-violet-500",
  },
  timer: {
    label: "จับเวลา",
    Icon: TimerIcon,
    accent: "bg-amber-500",
    tint: "bg-amber-50/50",
    text: "text-amber-700",
    iconText: "text-amber-500",
  },
  photo: {
    label: "ภาพถ่าย",
    Icon: ImageIcon,
    accent: "bg-pink-500",
    tint: "bg-pink-50/50",
    text: "text-pink-700",
    iconText: "text-pink-500",
  },
  file: {
    label: "แนบไฟล์",
    Icon: Paperclip,
    accent: "bg-teal-500",
    tint: "bg-teal-50/50",
    text: "text-teal-700",
    iconText: "text-teal-500",
  },
  reference: {
    label: "อ้างอิง",
    Icon: Link2,
    accent: "bg-emerald-500",
    tint: "bg-emerald-50/50",
    text: "text-emerald-700",
    iconText: "text-emerald-500",
  },
};

export type OptionFilter = {
  itemNames?: string[];
  commonNames?: string[];
  productTypes?: string[];
  categories?: string[];
  subCategories?: string[];
  itemGroups?: string[];
};

export function summarizeOptionFilter(
  f: OptionFilter | undefined,
  groupNameById?: Map<string, string>,
): string {
  if (!f) return '';
  const parts: string[] = [];
  if ((f.itemNames?.length ?? 0) > 0) {
    parts.push(`item: ${(f.itemNames ?? []).slice(0, 2).join('/')}${(f.itemNames?.length ?? 0) > 2 ? `+${(f.itemNames?.length ?? 0) - 2}` : ''}`);
  }
  if ((f.commonNames?.length ?? 0) > 0) {
    parts.push(`common: ${(f.commonNames ?? []).slice(0, 3).join('/')}`);
  }
  if ((f.productTypes?.length ?? 0) > 0) {
    parts.push((f.productTypes ?? []).map((p) => productTypeLabels[p] ?? p).join('/'));
  }
  if ((f.categories?.length ?? 0) > 0) {
    parts.push((f.categories ?? []).join('/'));
  }
  if ((f.subCategories?.length ?? 0) > 0) {
    parts.push(`sub: ${(f.subCategories ?? []).slice(0, 3).join('/')}`);
  }
  if ((f.itemGroups?.length ?? 0) > 0) {
    const names = (f.itemGroups ?? []).map((id) => groupNameById?.get(id)).filter(Boolean) as string[];
    parts.push(names.length > 0 ? `กลุ่ม: ${names.slice(0, 3).join('/')}` : `กลุ่ม: ${(f.itemGroups ?? []).length}`);
  }
  return parts.join(' · ');
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run src/lib/parameterDisplay.test.ts`
Expected: PASS 4 เทส

- [ ] **Step 5: rewire `ParameterSettings.tsx`**

ทั้งหมดใน `src/pages/ParameterSettings.tsx`:

1. **ลบ** บล็อกเหล่านี้ (ค้นหาด้วยข้อความ anchor — ห้ามเหลือ copy ซ้ำ):
   - `const SCOPE_LABEL: Record<ParameterScope, string> = {` ถึง `};` และ `const SCOPE_BADGE_CLASS: Record<ParameterScope, string> = {` ถึง `};` (~บรรทัด 267-275)
   - `const FIELD_TYPE_META: Record<` ถึง `};` ปิดท้าย object reference (~บรรทัด 635-710)
   - `type OptionFilter = {` ถึง `};` (~บรรทัด 779-786)
   - `function summarizeOptionFilter(f: OptionFilter | undefined, groupNameById?: Map<string, string>): string {` ถึง `}` ปิดฟังก์ชัน (~บรรทัด 809-832)
2. **เพิ่ม import** (ใต้ import `@/lib/api`):
   ```ts
   import {
     FIELD_TYPE_META,
     SCOPE_BADGE_CLASS,
     SCOPE_LABEL,
     summarizeOptionFilter,
     type OptionFilter,
   } from "@/lib/parameterDisplay";
   ```
3. **ตัด lucide import ที่ไม่ใช้แล้ว** ออกจาก import block บนสุด: `Hash`, `Image as ImageIcon`, `List as ListIcon`, `Paperclip`, `Timer as TimerIcon`, `Type as TypeIcon` — **คง `Link2` ไว้** (ยังใช้ใน ReferenceField UI ~บรรทัด 1856)

- [ ] **Step 6: verify ทั้งชุด**

Run: `npx tsc -p tsconfig.app.json --noEmit` → ไม่มี error ใหม่ (เทียบกับ baseline ก่อนแก้ ถ้าไม่แน่ใจรันบน `git stash` เทียบ)
Run: `npm run test` → เขียวทั้งหมด
Run: `npx eslint src/lib/parameterDisplay.ts src/lib/parameterDisplay.test.ts src/pages/ParameterSettings.tsx` → ไม่มี error ใหม่ (unused import ต้องหมด)

- [ ] **Step 7: Commit**

```bash
git add src/lib/parameterDisplay.ts src/lib/parameterDisplay.test.ts src/pages/ParameterSettings.tsx
git commit -m "refactor(param): extract shared display meta to lib/parameterDisplay" -- src/lib/parameterDisplay.ts src/lib/parameterDisplay.test.ts src/pages/ParameterSettings.tsx
```

---

### Task 2: Component `ParameterDetailDrawer`

Sheet ด้านขวา read-only แสดงรายละเอียด parameter เต็ม ตามสเปค section 3

**Files:**
- Create: `src/components/lis/ParameterDetailDrawer.tsx`
- Test: `src/components/lis/ParameterDetailDrawer.test.tsx`

**Interfaces:**
- Consumes: `FIELD_TYPE_META`/`SCOPE_*`/`summarizeOptionFilter` จาก Task 1; `describeRule`/`describeOutputRule`/`describeSubstanceStandard`/`describeLabelTolerance` จาก `@/lib/standardOperators`; `formatTimerHuman`/`seedOptionOutputsFromLegacy` จาก `@/lib/parameterValidation`
- Produces (Task 3 ใช้):
  ```ts
  export function ParameterDetailDrawer(props: {
    parameter: ParameterItem;
    allParameters: ParameterItem[];
    groupNameById: Map<string, string>;
    onEdit: () => void;
    onClose: () => void;
  }): JSX.Element
  ```
  render เป็น Sheet `open` เสมอ — parent ควบคุมด้วย conditional render (`{viewing ? <ParameterDetailDrawer .../> : null}`)

- [ ] **Step 1: เขียนเทสที่ fail ก่อน**

สร้าง `src/components/lis/ParameterDetailDrawer.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ParameterItem } from "@/lib/api";
import { formatTimerHuman } from "@/lib/parameterValidation";
import { ParameterDetailDrawer } from "./ParameterDetailDrawer";

const groupNameById = new Map([["g1", "กลุ่มน้ำ"]]);

const sourceParam: ParameterItem = {
  _id: "src1",
  name: "ความหนืดก่อนกวน",
  scope: "qc",
  valueFields: [{ label: "ค่าแรก", type: "float" }],
};

function renderDrawer(parameter: ParameterItem, onEdit = vi.fn(), onClose = vi.fn()) {
  render(
    <ParameterDetailDrawer
      parameter={parameter}
      allParameters={[parameter, sourceParam]}
      groupNameById={groupNameById}
      onEdit={onEdit}
      onClose={onClose}
    />,
  );
  return { onEdit, onClose };
}

describe("ParameterDetailDrawer", () => {
  it("header: ชื่อ + scope + → Lab + สถานะ + note", () => {
    renderDrawer({
      _id: "p1",
      name: "ความหนืด",
      scope: "qc",
      shareWithLab: true,
      status: "active",
      note: "เขย่าก่อนวัด",
      valueFields: [],
    });
    expect(screen.getByText("ความหนืด")).toBeInTheDocument();
    expect(screen.getByText("QC")).toBeInTheDocument();
    expect(screen.getByText("→ Lab")).toBeInTheDocument();
    expect(screen.getByText("เปิด")).toBeInTheDocument();
    expect(screen.getByText("เขย่าก่อนวัด")).toBeInTheDocument();
  });

  it("ใช้กับ: applyAll โชว์ 'ทั้งหมด'", () => {
    renderDrawer({ _id: "p1", name: "X", applyAll: true, valueFields: [] });
    expect(screen.getByText("ทั้งหมด")).toBeInTheDocument();
  });

  it("ใช้กับ: โชว์ค่าเต็มทุกมิติ ไม่ตัด +N และ resolve ชื่อกลุ่ม", () => {
    renderDrawer({
      _id: "p1",
      name: "X",
      commonNames: ["EC", "SC", "WP"],
      itemGroups: ["g1"],
      valueFields: [],
    });
    for (const v of ["EC", "SC", "WP", "กลุ่มน้ำ"]) {
      expect(screen.getByText(v)).toBeInTheDocument();
    }
    expect(screen.queryByText(/\+1/)).not.toBeInTheDocument();
  });

  it("number ค่าเดียว: ข้อความเกณฑ์ between + หน่วย", () => {
    renderDrawer({
      _id: "p1",
      name: "X",
      valueFields: [
        { label: "ค่า", type: "float", unit: "cP", standardOperator: "between", standardValue: 10, standardValue2: 50 },
      ],
    });
    expect(screen.getByText("ค่าปกติ: 10 - 50 cP")).toBeInTheDocument();
  });

  it("เกณฑ์ต่อสาร 7 สาร: เห็น 5 + ดูทั้งหมด (7) → กดแล้วครบ + ปุ่มเป็น ย่อ", () => {
    const subs = Array.from({ length: 7 }, (_, i) => ({
      substance: `SUB${i + 1}`,
      operator: "gte" as const,
      value: 90,
    }));
    renderDrawer({
      _id: "p1",
      name: "X",
      valueFields: [
        { label: "%AI", type: "float", unit: "%", substanceMode: true, substanceStandards: subs },
      ],
    });
    expect(screen.getByText(/เกณฑ์ต่อสาร \(7 สาร\)/)).toBeInTheDocument();
    expect(screen.getByText(/SUB5/)).toBeInTheDocument();
    expect(screen.queryByText(/SUB6/)).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "ดูทั้งหมด (7)" });
    fireEvent.click(toggle);
    expect(screen.getByText(/SUB7/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ย่อ" })).toBeInTheDocument();
  });

  it("เกณฑ์ต่อสาร ≤5 สาร: ไม่มีปุ่มดูทั้งหมด", () => {
    renderDrawer({
      _id: "p1",
      name: "X",
      valueFields: [
        {
          label: "%AI",
          type: "float",
          substanceMode: true,
          substanceStandards: [{ substance: "SUB1", operator: "gte", value: 90 }],
        },
      ],
    });
    expect(screen.queryByRole("button", { name: /ดูทั้งหมด/ })).not.toBeInTheDocument();
  });

  it("enum: chip ตาม optionOutputs + requireNoteOn", () => {
    renderDrawer({
      _id: "p1",
      name: "X",
      valueFields: [
        {
          label: "ลักษณะ",
          type: "enum",
          options: ["ใส", "ขุ่น", "อื่นๆ"],
          optionOutputs: {
            "ใส": { kind: "normal" },
            "ขุ่น": { kind: "abnormal" },
            "อื่นๆ": { kind: "text", text: "ระบุเพิ่ม" },
          },
          requireNoteOn: ["ขุ่น"],
        },
      ],
    });
    expect(screen.getByText("ปกติ")).toBeInTheDocument();
    expect(screen.getByText("ไม่ปกติ")).toBeInTheDocument();
    expect(screen.getByText('ข้อความ: "ระบุเพิ่ม"')).toBeInTheDocument();
    expect(screen.getByText("ต้องกรอกหมายเหตุ")).toBeInTheDocument();
  });

  it("enum legacy (ไม่มี optionOutputs): expectedValues → ปกติ, ที่เหลือ → ไม่ปกติ", () => {
    renderDrawer({
      _id: "p1",
      name: "X",
      valueFields: [
        { label: "ลักษณะ", type: "enum", options: ["ใส", "ขุ่น"], expectedValues: ["ใส"] },
      ],
    });
    expect(screen.getByText("ปกติ")).toBeInTheDocument();
    expect(screen.getByText("ไม่ปกติ")).toBeInTheDocument();
  });

  it("timer/photo/file: รายละเอียดถูก", () => {
    renderDrawer({
      _id: "p1",
      name: "X",
      valueFields: [
        { label: "เวลากวน", type: "timer", timerDurationSec: 90, timerUnit: "minute" },
        { label: "รูป", type: "photo", maxPhotos: 3 },
        { label: "ผลแนบ", type: "file", allowedFileTypes: ["pdf", "excel"], maxFiles: 2 },
      ],
    });
    expect(screen.getByText(`จับเวลา: ${formatTimerHuman(90)}`)).toBeInTheDocument();
    expect(screen.getByText("สูงสุด 3 รูป")).toBeInTheDocument();
    expect(screen.getByText("PDF, EXCEL · สูงสุด 2 ไฟล์")).toBeInTheDocument();
  });

  it("reference: resolve ชื่อ parameter ต้นทาง + phase 2", () => {
    renderDrawer({
      _id: "p1",
      name: "X",
      valueFields: [
        { label: "อ้างอิง", type: "reference", refParameterId: "src1", refFieldLabel: "ค่าแรก", refPhase: 2 },
      ],
    });
    expect(screen.getByText("← ดึงจาก ความหนืดก่อนกวน · ค่าแรก · phase 2")).toBeInTheDocument();
  });

  it("chips: required/phase/ตัวเริ่ม Phase 2/หลายค่า/แบชล่าสุด", () => {
    renderDrawer({
      _id: "p1",
      name: "X",
      hasPhases: true,
      multiEntry: true,
      valueFields: [
        {
          label: "ค่า",
          type: "float",
          required: true,
          phase: "before",
          triggersPhase2: true,
          multiple: true,
          showLastBatch: true,
        },
      ],
    });
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("เฉพาะก่อน (Phase 1)")).toBeInTheDocument();
    expect(screen.getByText("ตัวเริ่ม Phase 2")).toBeInTheDocument();
    expect(screen.getByText("กรอกได้หลายค่า")).toBeInTheDocument();
    expect(screen.getByText("โชว์ค่าแบชล่าสุด")).toBeInTheDocument();
    expect(screen.getByText("มี 2 phase (ก่อน/หลัง)")).toBeInTheDocument();
    expect(screen.getByText("กรอกซ้ำได้หลายรายการ")).toBeInTheDocument();
  });

  it("ไม่มีช่องค่า → ข้อความว่าง; ปุ่มแก้ไขเรียก onEdit", () => {
    const { onEdit } = renderDrawer({ _id: "p1", name: "X", valueFields: [] });
    expect(screen.getByText("— ยังไม่มีช่องค่า")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /แก้ไข/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `npx vitest run src/components/lis/ParameterDetailDrawer.test.tsx`
Expected: FAIL — module `./ParameterDetailDrawer` ไม่มี

- [ ] **Step 3: สร้าง `src/components/lis/ParameterDetailDrawer.tsx`**

```tsx
import { useState } from "react";
import { Filter, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  OptionOutput,
  ParameterItem,
  ParameterScope,
  ParameterValueField,
} from "@/lib/api";
import {
  describeLabelTolerance,
  describeOutputRule,
  describeRule,
  describeSubstanceStandard,
} from "@/lib/standardOperators";
import {
  formatTimerHuman,
  seedOptionOutputsFromLegacy,
} from "@/lib/parameterValidation";
import {
  FIELD_TYPE_META,
  SCOPE_BADGE_CLASS,
  SCOPE_LABEL,
  summarizeOptionFilter,
} from "@/lib/parameterDisplay";
import { productTypeLabels } from "@/lib/productClassification";

const CRITERIA_PREVIEW_COUNT = 5;

type ParameterDetailDrawerProps = {
  parameter: ParameterItem;
  allParameters: ParameterItem[];
  groupNameById: Map<string, string>;
  onEdit: () => void;
  onClose: () => void;
};

/** เกณฑ์แบบ list (ต่อสาร / %สาร / กฎ) — โชว์ 5 แรก + ปุ่มคลี่ในที่ */
function CriteriaList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }
  const visible = showAll ? items : items.slice(0, CRITERIA_PREVIEW_COUNT);
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {visible.map((text, i) => (
        <p key={i} className="text-xs text-emerald-700">{text}</p>
      ))}
      {items.length > CRITERIA_PREVIEW_COUNT ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-primary hover:underline"
        >
          {showAll ? "ย่อ" : `ดูทั้งหมด (${items.length})`}
        </button>
      ) : null}
    </div>
  );
}

/** logic เดียวกับ StandardPreview (โหมดค่าเดียว) ในหน้า ParameterSettings */
function singleStandardText(field: ParameterValueField): { text: string; set: boolean } {
  const op = field.standardOperator;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  const unit = field.unit ? ` ${field.unit}` : "";
  if (!op) return { text: "ยังไม่ได้กำหนดเงื่อนไข — จะไม่ตรวจค่าผิดปกติ", set: false };
  if (v1 == null) return { text: "ยังไม่ได้กรอกค่ามาตรฐาน", set: false };
  switch (op) {
    case "lt": return { text: `ค่าปกติ: < ${v1}${unit}`, set: true };
    case "lte": return { text: `ค่าปกติ: ≤ ${v1}${unit}`, set: true };
    case "eq": return { text: `ค่าปกติ: = ${v1}${unit}`, set: true };
    case "gte": return { text: `ค่าปกติ: ≥ ${v1}${unit}`, set: true };
    case "gt": return { text: `ค่าปกติ: > ${v1}${unit}`, set: true };
    case "between":
      if (v2 == null) return { text: "ยังไม่ได้กรอกค่าสิ้นสุดของช่วง", set: false };
      return { text: `ค่าปกติ: ${v1} - ${v2}${unit}`, set: true };
    case "tolerance": {
      if (v2 == null || v2 <= 0) return { text: "ยังไม่ได้กรอก tolerance %", set: false };
      const low = v1 - Math.abs(v1) * (v2 / 100);
      const high = v1 + Math.abs(v1) * (v2 / 100);
      return { text: `ค่าปกติ: ${v1} ± ${v2}% (${low} - ${high})${unit}`, set: true };
    }
  }
  return { text: "", set: false };
}

function OptionOutputChip({ output }: { output: OptionOutput | undefined }) {
  if (!output || output.kind === "normal") {
    return <Badge className="bg-emerald-100 text-[10px] text-emerald-800 hover:bg-emerald-100">ปกติ</Badge>;
  }
  if (output.kind === "abnormal") {
    return <Badge className="bg-red-100 text-[10px] text-red-700 hover:bg-red-100">ไม่ปกติ</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-[10px] font-normal">
      ข้อความ: "{output.text ?? ""}"
    </Badge>
  );
}

function ApplyToSection({
  parameter,
  groupNameById,
}: {
  parameter: ParameterItem;
  groupNameById: Map<string, string>;
}) {
  if (parameter.applyAll) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">ทั้งหมด</Badge>;
  }
  const groups: { label: string; values: string[]; color: string }[] = [
    { label: "Item", values: parameter.itemNames ?? [], color: "bg-violet-50 text-violet-700" },
    { label: "Common", values: parameter.commonNames ?? [], color: "bg-blue-50 text-blue-700" },
    {
      label: "ประเภท",
      values: (parameter.productTypes ?? []).map((v) => productTypeLabels[v] ?? v),
      color: "bg-emerald-50 text-emerald-700",
    },
    { label: "หมวดหมู่", values: parameter.categories ?? [], color: "bg-amber-50 text-amber-700" },
    { label: "หมวดย่อย", values: parameter.subCategories ?? [], color: "bg-orange-50 text-orange-700" },
    {
      label: "กลุ่ม",
      values: (parameter.itemGroups ?? []).map((id) => groupNameById.get(id) ?? id),
      color: "bg-rose-50 text-rose-700",
    },
  ].filter((g) => g.values.length > 0);

  if (groups.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-1.5">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-wrap items-baseline gap-1">
          <span className="text-xs font-semibold text-muted-foreground">{g.label}:</span>
          {g.values.map((v) => (
            <span key={v} className={cn("rounded-md px-2 py-0.5 text-xs", g.color)}>
              {v}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function FieldDetail({
  field,
  allParameters,
  groupNameById,
}: {
  field: ParameterValueField;
  allParameters: ParameterItem[];
  groupNameById: Map<string, string>;
}) {
  const unit = field.unit ?? "";
  switch (field.type) {
    case "number":
    case "float": {
      const unitLine = field.unit ? (
        <p className="text-xs text-muted-foreground">หน่วย: {field.unit}</p>
      ) : null;
      if (field.labelToleranceMode) {
        const stds = field.labelToleranceStandards ?? [];
        return (
          <div className="space-y-1">
            {unitLine}
            <CriteriaList
              title={`ตาม %สาร (${stds.length} สาร)`}
              items={stds.map((s) => `${s.substance} — ${describeLabelTolerance(s, unit)}`)}
              emptyText="ยังไม่ได้ตั้งเกณฑ์ตาม %สาร"
            />
          </div>
        );
      }
      if (field.conditionalMode) {
        const rules = field.conditionalStandards ?? [];
        const isOutput = (field.conditionalResult ?? "standard") === "output";
        return (
          <div className="space-y-1">
            {unitLine}
            <CriteriaList
              title={`เงื่อนไขพิเศษ (${rules.length} กฎ)`}
              items={rules.map((r) => (isOutput ? describeOutputRule(r) : describeRule(r, unit)))}
              emptyText="ยังไม่ได้ตั้งกฎ"
            />
          </div>
        );
      }
      if (field.substanceMode) {
        const stds = field.substanceStandards ?? [];
        return (
          <div className="space-y-1">
            {unitLine}
            <CriteriaList
              title={`เกณฑ์ต่อสาร (${stds.length} สาร)`}
              items={stds.map((s) => `${s.substance} — ${describeSubstanceStandard(s, unit)}`)}
              emptyText="ยังไม่ได้ตั้งเงื่อนไขสาร"
            />
          </div>
        );
      }
      const single = singleStandardText(field);
      return (
        <div className="space-y-1">
          {unitLine}
          <p className={cn("text-xs", single.set ? "text-emerald-700" : "text-muted-foreground")}>
            {single.text}
          </p>
        </div>
      );
    }
    case "enum": {
      const opts = field.options ?? [];
      if (opts.length === 0) {
        return <p className="text-xs text-muted-foreground">ยังไม่มีตัวเลือก</p>;
      }
      const outputs =
        field.optionOutputs ?? seedOptionOutputsFromLegacy(opts, field.expectedValues ?? []);
      return (
        <div className="space-y-1">
          {opts.map((opt) => {
            const filter = field.optionFilters?.[opt];
            return (
              <div key={opt} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span>{opt}</span>
                <OptionOutputChip output={outputs[opt]} />
                {(field.requireNoteOn ?? []).includes(opt) ? (
                  <Badge variant="outline" className="text-[10px] font-normal">ต้องกรอกหมายเหตุ</Badge>
                ) : null}
                {filter ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-700">
                    <Filter className="h-2.5 w-2.5 shrink-0" />
                    {summarizeOptionFilter(filter, groupNameById)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    }
    case "timer":
      return (
        <p className="text-xs text-muted-foreground">
          {field.timerDurationSec && field.timerDurationSec > 0
            ? `จับเวลา: ${formatTimerHuman(field.timerDurationSec)}`
            : "ยังไม่ตั้งระยะเวลา"}
        </p>
      );
    case "photo":
      return <p className="text-xs text-muted-foreground">สูงสุด {field.maxPhotos ?? 5} รูป</p>;
    case "file": {
      const types = (field.allowedFileTypes ?? ["pdf"]).map((t) => t.toUpperCase()).join(", ");
      return (
        <p className="text-xs text-muted-foreground">
          {types} · สูงสุด {field.maxFiles ?? 5} ไฟล์
        </p>
      );
    }
    case "reference": {
      if (!field.refParameterId || !field.refFieldLabel) {
        return <p className="text-xs text-muted-foreground">ยังไม่ได้เลือก parameter ต้นทาง</p>;
      }
      const source = allParameters.find((p) => p._id === field.refParameterId);
      const phaseSuffix = field.refPhase === 2 ? " · phase 2" : "";
      return (
        <p className="text-xs text-muted-foreground">
          ← ดึงจาก {source?.name ?? field.refParameterId} · {field.refFieldLabel}
          {phaseSuffix}
        </p>
      );
    }
    case "text":
      return null;
  }
}

function FieldCard({
  field,
  index,
  parameter,
  allParameters,
  groupNameById,
}: {
  field: ParameterValueField;
  index: number;
  parameter: ParameterItem;
  allParameters: ParameterItem[];
  groupNameById: Map<string, string>;
}) {
  const meta = FIELD_TYPE_META[field.type];
  const Icon = meta.Icon;
  const chips: string[] = [];
  if (parameter.hasPhases) {
    const phase = field.phase ?? "both";
    chips.push(
      phase === "both" ? "ทั้ง 2 phase" : phase === "before" ? "เฉพาะก่อน (Phase 1)" : "เฉพาะหลัง (Phase 2)",
    );
    if (field.triggersPhase2) chips.push("ตัวเริ่ม Phase 2");
  }
  if (field.multiple) chips.push("กรอกได้หลายค่า");
  if (field.showLastBatch) chips.push("โชว์ค่าแบชล่าสุด");

  return (
    <div className="relative overflow-hidden rounded-lg border border-grey-200 bg-background">
      <div className={cn("absolute inset-y-0 left-0 w-1", meta.accent)} aria-hidden />
      <div className="space-y-2 py-2.5 pl-4 pr-3">
        <div className="flex items-baseline gap-2">
          <span className="w-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <Icon className={cn("h-4 w-4 shrink-0 self-center", meta.iconText)} />
          <span className="text-sm font-medium">
            {field.label?.trim() || <span className="italic text-muted-foreground">ยังไม่ได้ตั้งชื่อ</span>}
          </span>
          <span className={cn("text-xs font-medium", meta.text)}>{meta.label}</span>
          {field.required ? <span className="text-xs text-red-500">*</span> : null}
        </div>
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1 pl-6">
            {chips.map((c) => (
              <Badge key={c} variant="secondary" className="text-[10px] font-normal">
                {c}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="pl-6">
          <FieldDetail field={field} allParameters={allParameters} groupNameById={groupNameById} />
        </div>
      </div>
    </div>
  );
}

export function ParameterDetailDrawer({
  parameter,
  allParameters,
  groupNameById,
  onEdit,
  onClose,
}: ParameterDetailDrawerProps) {
  const scope = (parameter.scope ?? "qc") as ParameterScope;
  const status = parameter.status ?? "active";
  const fields = parameter.valueFields ?? [];
  const systemInfo: string[] = [];
  if (parameter.hasPhases) systemInfo.push("มี 2 phase (ก่อน/หลัง)");
  if (parameter.multiEntry) systemInfo.push("กรอกซ้ำได้หลายรายการ");

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <SheetHeader className="space-y-2 border-b border-border p-6 pr-12 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={cn("text-[10px] font-semibold uppercase", SCOPE_BADGE_CLASS[scope])}>
              {SCOPE_LABEL[scope]}
            </Badge>
            {scope === "qc" && parameter.shareWithLab ? (
              <Badge
                variant="outline"
                className="border-sky-300 bg-sky-50 text-[10px] text-sky-800"
                title="แชร์ให้ Lab อ่านได้"
              >
                → Lab
              </Badge>
            ) : null}
            <Badge variant={status === "active" ? "default" : "secondary"}>
              {status === "active" ? "เปิด" : "ปิด"}
            </Badge>
          </div>
          <SheetTitle className="text-xl font-bold">{parameter.name}</SheetTitle>
          <SheetDescription className="sr-only">
            รายละเอียดพารามิเตอร์ {parameter.name}
          </SheetDescription>
          {parameter.note ? (
            <p className="text-sm text-muted-foreground">{parameter.note}</p>
          ) : null}
        </SheetHeader>

        <div className="flex-1 space-y-5 p-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">ใช้กับ</h3>
            <ApplyToSection parameter={parameter} groupNameById={groupNameById} />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">ช่องค่า ({fields.length})</h3>
            {fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">— ยังไม่มีช่องค่า</p>
            ) : (
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <FieldCard
                    key={i}
                    field={field}
                    index={i}
                    parameter={parameter}
                    allParameters={allParameters}
                    groupNameById={groupNameById}
                  />
                ))}
              </div>
            )}
          </section>

          {systemInfo.length > 0 ? (
            <section className="space-y-1 border-t border-border pt-3">
              {systemInfo.map((line) => (
                <p key={line} className="text-xs text-muted-foreground">{line}</p>
              ))}
            </section>
          ) : null}
        </div>

        <SheetFooter className="gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            แก้ไข
          </Button>
          <Button type="button" onClick={onClose}>
            ปิด
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run src/components/lis/ParameterDetailDrawer.test.tsx`
Expected: PASS 12 เทส

หมายเหตุถ้าเทสไหน fail เรื่องข้อความ: ห้ามแก้ expectation ให้ตรง bug — เช็คก่อนว่า
component render ตามสเปคจริงไหม (ข้อความในเทสมาจากสเปคตรงตัว)

- [ ] **Step 5: verify + Commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` → ไม่มี error ใหม่
Run: `npx eslint src/components/lis/ParameterDetailDrawer.tsx src/components/lis/ParameterDetailDrawer.test.tsx` → สะอาด
Run: `npm run test` → เขียวทั้งหมด

```bash
git add src/components/lis/ParameterDetailDrawer.tsx src/components/lis/ParameterDetailDrawer.test.tsx
git commit -m "feat(param): add ParameterDetailDrawer read-only detail sheet" -- src/components/lis/ParameterDetailDrawer.tsx src/components/lis/ParameterDetailDrawer.test.tsx
```

---

### Task 3: ต่อ drawer เข้าหน้า ParameterSettings (คลิกแถว)

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

**Interfaces:**
- Consumes: `ParameterDetailDrawer` จาก Task 2 (props ตาม Interfaces ของ Task 2)
- Produces: — (task สุดท้าย)

- [ ] **Step 1: เพิ่ม import + state**

ใน `src/pages/ParameterSettings.tsx`:

1. import (ข้างๆ import component lis อื่น):
   ```ts
   import { ParameterDetailDrawer } from "@/components/lis/ParameterDetailDrawer";
   ```
2. ใน component หลัก (ใกล้ `const [deleting, setDeleting] = ...` ~บรรทัด 2535):
   ```ts
   const [viewingId, setViewingId] = useState<string | null>(null);
   ```
3. หลัง `const filtered = useMemo(...)` (~บรรทัด 2649) เพิ่ม derive สด (id หายจากลิสต์ → drawer ปิดเอง):
   ```ts
   const viewing = viewingId
     ? parameters.find((p) => p._id === viewingId) ?? null
     : null;
   ```

- [ ] **Step 2: ทำแถวคลิกได้ + stopPropagation ปุ่มเดิม**

ใน table body (~บรรทัด 2861) แก้ `<TableRow key={p._id ?? i}>` เป็น:

```tsx
<TableRow
  key={p._id ?? i}
  className="cursor-pointer"
  onClick={() => p._id && setViewingId(p._id)}
  title="คลิกเพื่อดูรายละเอียด"
>
```

และปุ่มท้ายแถว 2 ปุ่ม (~บรรทัด 2899-2915) ใส่ `stopPropagation`:

```tsx
<Button
  size="icon"
  variant="ghost"
  onClick={(e) => {
    e.stopPropagation();
    setEditing(p);
  }}
  title="แก้ไข"
>
  <Pencil className="h-4 w-4" />
</Button>
<Button
  size="icon"
  variant="ghost"
  onClick={(e) => {
    e.stopPropagation();
    setDeleting(p);
  }}
  title="ลบ"
  className="text-destructive hover:text-destructive"
>
  <Trash2 className="h-4 w-4" />
</Button>
```

- [ ] **Step 3: render drawer**

หลังบล็อก `<ParameterDialog ... />` (~บรรทัด 2944) เพิ่ม:

```tsx
{viewing ? (
  <ParameterDetailDrawer
    parameter={viewing}
    allParameters={parameters}
    groupNameById={groupNameById}
    onEdit={() => {
      setViewingId(null);
      setEditing(viewing);
    }}
    onClose={() => setViewingId(null)}
  />
) : null}
```

- [ ] **Step 4: verify ทั้งชุด**

Run: `npx tsc -p tsconfig.app.json --noEmit` → ไม่มี error ใหม่
Run: `npx eslint src/pages/ParameterSettings.tsx` → ไม่มี error ใหม่
Run: `npm run test` → เขียวทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(param): open detail drawer on parameter row click" -- src/pages/ParameterSettings.tsx
```

---

## หลังจบทุก task

- ค้าง **manual E2E ในเบราว์เซอร์** (คนรัน): เปิด `/parameter-settings` → คลิกแถว →
  drawer ขึ้นข้อมูลครบ → "ดูทั้งหมด (N)" คลี่ได้ → ปุ่มแก้ไขเปิด dialog เดิม →
  บันทึก → เปิด drawer ซ้ำเห็นค่าใหม่ → ปุ่ม ✏️/🗑️ ในตารางไม่เปิด drawer
- ไม่ push จนกว่าจะ E2E ผ่าน (auto-sync มีรอบของมันเอง)
