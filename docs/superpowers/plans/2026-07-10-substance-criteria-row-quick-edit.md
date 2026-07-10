# Substance Criteria Row Quick Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** คลิกแถวสารในแท็บ "แยกตามสาร" (หน้า ตั้งค่าพารามิเตอร์) แล้วเปิดฟอร์มแก้เกณฑ์เฉพาะสารนั้นตัวเดียว แทนการเปิด `SubstanceStandardsDialog` ตัวเต็มที่โชว์ทุกสาร

**Architecture:** dialog เล็กใหม่ `SubstanceStandardRowDialog` แก้เกณฑ์ 1 รายการ; ต่อสาย `ruleIndex` (มีอยู่แล้วใน `SubstanceCriteriaRow`) ผ่าน `onEditField` → `CriteriaEditorTarget` → เลือก render dialog เล็กเมื่อ `ruleIndex != null` และเกณฑ์ตัวนั้นยังอยู่, fallback dialog ตัวเต็มเมื่อเป็น setup row / index หลุด; บันทึกผ่าน `handleSaveCriteriaField` path เดิม (แทนที่เฉพาะตำแหน่ง `ruleIndex` ใน array)

**Tech Stack:** React 18 + TypeScript, shadcn/ui (`Dialog`, `NativeSelect`, `Input`, `Button`, `Label`), Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-10-substance-criteria-row-quick-edit-design.md`

## Global Constraints

- ไฟล์ที่แตะได้เท่านั้น: `src/components/lis/SubstanceStandardRowDialog.tsx` (+`.test.tsx`, สร้างใหม่), `src/components/lis/ParameterCriteriaTabs.tsx` (+`.test.tsx`), `src/pages/ParameterSettings.tsx`
- **ห้ามแตะ**: `SubstanceStandardsDialog.tsx`, `parameterCriteriaRows.ts`, แท็บ เงื่อนไขพิเศษ/ตาม %สาร (พฤติกรรมเดิม — เรียก `onEditField` แบบ 3 อาร์กิวเมนต์ต่อไป), schema (`src/lib/api.ts`), backend
- **ห้ามรัน `npm run build`** — type-check ด้วย `npx tsc -p tsconfig.app.json --noEmit` เท่านั้น (root tsconfig เป็น no-op; repo มี latent error เดิม ~12 ตัว → เกณฑ์คือไม่มี error ใหม่ในไฟล์ที่แตะ)
- commit ด้วย **explicit pathspec เท่านั้น** (มี process/เซสชันอื่น commit แทรกในรีโปนี้): `git add <files> && git commit -m "..." -- <files>`
- semantics `value2` ค้างเมื่อสลับ operator = คงพฤติกรรมเดิมของ dialog ตัวเต็ม (ไม่เคลียร์)
- ข้อความไทยเป๊ะ: checkbox `ให้หัวหน้า QC พิจารณาเท่านั้น`, ปุ่ม `ยกเลิก`/`บันทึก`, บรรทัดรอง `{parameterName} · {fieldLabel}`

---

### Task 1: `SubstanceStandardRowDialog` (dialog เล็กแก้เกณฑ์ 1 สาร)

**Files:**
- Create: `src/components/lis/SubstanceStandardRowDialog.tsx`
- Test: `src/components/lis/SubstanceStandardRowDialog.test.tsx`

**Interfaces:**
- Consumes: `SubstanceStandard`, `StandardOperator` จาก `@/lib/api`; `OPERATOR_OPTIONS` จาก `@/lib/standardOperators`; UI primitives จาก `@/components/ui/*`
- Produces (Task 3 ใช้): `SubstanceStandardRowDialog` props
  `{ open: boolean; substance: SubstanceStandard & { headOnly?: boolean }; parameterName: string; fieldLabel: string; unit?: string; onClose: () => void; onSave: (next: SubstanceStandard & { headOnly?: boolean }) => void }` —
  ปุ่มบันทึกเรียก `onSave(merged)` แล้ว `onClose()` (ลำดับเดียวกับ dialog ตัวเต็ม เพื่อให้ busy-ref ใน ParameterSettings ทำงานแบบเดิม)

- [ ] **Step 1: เขียนเทสที่ fail ก่อน** — สร้าง `src/components/lis/SubstanceStandardRowDialog.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SubstanceStandard } from "@/lib/api";
import { SubstanceStandardRowDialog } from "./SubstanceStandardRowDialog";

type EditableSubstanceStandard = SubstanceStandard & { headOnly?: boolean };

const baseSubstance: EditableSubstanceStandard = {
  substance: "ABAMECTIN 1.8% W/V EC",
  operator: "gte",
  value: 95,
  value2: null,
  productTypes: ["water"],
  categories: ["RM"],
} as EditableSubstanceStandard;

function renderDialog(substance: EditableSubstanceStandard = baseSubstance) {
  const onSave = vi.fn<(next: EditableSubstanceStandard) => void>();
  const onClose = vi.fn();
  render(
    <SubstanceStandardRowDialog
      open
      substance={substance}
      parameterName="ปริมาณสารสำคัญ"
      fieldLabel="Active"
      unit="%"
      onClose={onClose}
      onSave={onSave}
    />,
  );
  return { onSave, onClose };
}

describe("SubstanceStandardRowDialog", () => {
  it("renders the substance name, context line, and prefilled criteria", () => {
    renderDialog();

    expect(screen.getByText("ABAMECTIN 1.8% W/V EC")).toBeInTheDocument();
    expect(screen.getByText("ปริมาณสารสำคัญ · Active")).toBeInTheDocument();
    expect(screen.getByLabelText("เงื่อนไข")).toHaveValue("gte");
    expect(screen.getByLabelText("ค่า")).toHaveValue(95);
    expect(screen.queryByLabelText("ถึง")).not.toBeInTheDocument();
  });

  it("shows both value inputs for a between rule and keeps them after switching to tolerance", () => {
    renderDialog({ ...baseSubstance, operator: "between", value: 78, value2: 82 });

    expect(screen.getByLabelText("ตั้งแต่")).toHaveValue(78);
    expect(screen.getByLabelText("ถึง")).toHaveValue(82);

    fireEvent.change(screen.getByLabelText("เงื่อนไข"), { target: { value: "tolerance" } });

    expect(screen.getByLabelText("ค่ามาตรฐาน")).toHaveValue(78);
    expect(screen.getByLabelText("+/- %")).toHaveValue(82);
  });

  it("saves the edited rule, preserving untouched properties, then closes", () => {
    const { onSave, onClose } = renderDialog();

    fireEvent.change(screen.getByLabelText("ค่า"), { target: { value: "97" } });
    fireEvent.click(screen.getByLabelText("ให้หัวหน้า QC พิจารณาเท่านั้น"));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      ...baseSubstance,
      operator: "gte",
      value: 97,
      value2: null,
      headOnly: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels without saving", () => {
    const { onSave, onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `npx vitest run src/components/lis/SubstanceStandardRowDialog.test.tsx`
Expected: FAIL — resolve import `./SubstanceStandardRowDialog` ไม่ได้ (ไฟล์ยังไม่มี)

- [ ] **Step 3: สร้าง component** — `src/components/lis/SubstanceStandardRowDialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { StandardOperator, SubstanceStandard } from "@/lib/api";
import { OPERATOR_OPTIONS } from "@/lib/standardOperators";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";

type EditableSubstanceStandard = SubstanceStandard & { headOnly?: boolean };

type Props = {
  open: boolean;
  substance: EditableSubstanceStandard;
  parameterName: string;
  fieldLabel: string;
  unit?: string;
  onClose: () => void;
  onSave: (next: EditableSubstanceStandard) => void;
};

function parseNumberInput(raw: string): number | null {
  return raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
}

export function SubstanceStandardRowDialog({
  open, substance, parameterName, fieldLabel, unit, onClose, onSave,
}: Props) {
  const [operator, setOperator] = useState<StandardOperator>(substance.operator);
  const [value, setValue] = useState<number | null>(substance.value ?? null);
  const [value2, setValue2] = useState<number | null>(substance.value2 ?? null);
  const [headOnly, setHeadOnly] = useState(substance.headOnly === true);

  useEffect(() => {
    if (open) {
      setOperator(substance.operator);
      setValue(substance.value ?? null);
      setValue2(substance.value2 ?? null);
      setHeadOnly(substance.headOnly === true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, substance]);

  const needsValue2 = operator === "between" || operator === "tolerance";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words">{substance.substance}</DialogTitle>
          <DialogDescription>{parameterName} · {fieldLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="substance-row-operator" className="text-sm">เงื่อนไข</Label>
            <NativeSelect
              id="substance-row-operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value as StandardOperator)}
              className="h-10"
            >
              {OPERATOR_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="substance-row-value" className="text-sm">
                {operator === "tolerance" ? "ค่ามาตรฐาน" : operator === "between" ? "ตั้งแต่" : "ค่า"}
              </Label>
              <Input
                id="substance-row-value"
                type="number"
                value={value ?? ""}
                onChange={(e) => setValue(parseNumberInput(e.target.value))}
                className="h-10"
              />
            </div>
            {needsValue2 && (
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="substance-row-value2" className="text-sm">
                  {operator === "tolerance" ? "+/- %" : "ถึง"}
                </Label>
                <Input
                  id="substance-row-value2"
                  type="number"
                  value={value2 ?? ""}
                  onChange={(e) => setValue2(parseNumberInput(e.target.value))}
                  className="h-10"
                />
              </div>
            )}
            {unit ? <span className="pb-2.5 text-sm text-muted-foreground">{unit}</span> : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-amber-700">
            <input
              type="checkbox"
              checked={headOnly}
              onChange={(e) => setHeadOnly(e.target.checked)}
            />
            ให้หัวหน้า QC พิจารณาเท่านั้น
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onSave({ ...substance, operator, value, value2, headOnly });
              onClose();
            }}
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run src/components/lis/SubstanceStandardRowDialog.test.tsx`
Expected: PASS 4/4, ไม่มี warning (มี `DialogDescription` แล้ว Radix ไม่บ่น)

- [ ] **Step 5: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ที่อ้างถึง `SubstanceStandardRowDialog`

- [ ] **Step 6: Commit (explicit pathspec)**

```bash
git add src/components/lis/SubstanceStandardRowDialog.tsx src/components/lis/SubstanceStandardRowDialog.test.tsx
git commit -m "feat(parameter-settings): add single-substance criteria edit dialog" -- src/components/lis/SubstanceStandardRowDialog.tsx src/components/lis/SubstanceStandardRowDialog.test.tsx
```

---

### Task 2: `ParameterCriteriaTabs` — ส่ง `ruleIndex` + คลิกทั้งแถว

**Files:**
- Modify: `src/components/lis/ParameterCriteriaTabs.tsx` (props type ~บรรทัด 106, substance rows ~246-258, `EditButton` ~479-485)
- Test: `src/components/lis/ParameterCriteriaTabs.test.tsx`

**Interfaces:**
- Consumes: `SubstanceCriteriaRow.ruleIndex: number | null` (มีอยู่แล้วจาก `parameterCriteriaRows.ts` — setup row = null)
- Produces (Task 3 ใช้): `onEditField(mode, parameterId, fieldIndex, ruleIndex?: number | null)` — แท็บ substance ส่ง `row.ruleIndex` เสมอ (ทั้งคลิกแถวและปุ่ม ✎); แท็บ conditional/labelTolerance เรียก 3 อาร์กิวเมนต์เหมือนเดิม

- [ ] **Step 1: เขียน/แก้เทสให้ fail ก่อน** — ใน `ParameterCriteriaTabs.test.tsx`:

1a. แก้ assert เดิมในเทส `"renders substance table rows without field, type, category, condition, or head-only columns"` (ท้ายเทส):

```tsx
// เดิม
    fireEvent.click(within(table).getAllByRole("button")[0]);
    expect(onEditField).toHaveBeenCalledWith("substance", "p1", 0);

// ใหม่ — แถวแรกหลัง sort A-Z คือ ABAMECTIN ซึ่งเป็น index 1 ใน substanceStandards
// (พิสูจน์ว่า ruleIndex มาจากข้อมูล ไม่ใช่ลำดับแสดงผล) และ stopPropagation ทำให้ยิงครั้งเดียว
    fireEvent.click(within(table).getAllByRole("button")[0]);
    expect(onEditField).toHaveBeenCalledTimes(1);
    expect(onEditField).toHaveBeenCalledWith("substance", "p1", 0, 1);
```

1b. เพิ่มเทสใหม่ 2 ตัว ต่อท้ายเทสข้อ 1a (ใน describe เดิม):

```tsx
  it("opens the row's rule when clicking anywhere on a substance row", () => {
    const { onEditField } = renderCriteriaTabs({ value: "substance" });

    fireEvent.click(within(screen.getByRole("table")).getByText("BIFENTHRIN"));

    expect(onEditField).toHaveBeenCalledTimes(1);
    expect(onEditField).toHaveBeenCalledWith("substance", "p1", 0, 2);
  });

  it("passes a null rule index for the setup row of an unconfigured field", () => {
    const { onEditField } = renderCriteriaTabs({
      value: "substance",
      parameters: [
        {
          _id: "p-empty",
          name: "Parameter Empty",
          scope: "qc",
          valueFields: [
            { label: "Active", type: "number", substanceMode: true, substanceStandards: [] },
          ],
        },
      ],
    });

    fireEvent.click(within(screen.getByRole("table")).getByRole("button"));

    expect(onEditField).toHaveBeenCalledWith("substance", "p-empty", 0, null);
  });
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `npx vitest run src/components/lis/ParameterCriteriaTabs.test.tsx`
Expected: FAIL 3 จุด — assert 4 args ได้ 3 args (เทส 1a), คลิกแถวไม่ยิง handler (เทสแรกของ 1b), setup row ได้ 3 args (เทสที่สองของ 1b); เทสอื่นผ่าน

- [ ] **Step 3: แก้ component** — 3 จุดใน `ParameterCriteriaTabs.tsx`:

3a. props type (~บรรทัด 106):

```tsx
// เดิม
  onEditField: (mode: AdvancedCriteriaMode, parameterId: string, fieldIndex: number) => void;
// ใหม่
  onEditField: (mode: AdvancedCriteriaMode, parameterId: string, fieldIndex: number, ruleIndex?: number | null) => void;
```

3b. substance rows (~บรรทัด 246-258) — แถวคลิกได้ + ปุ่มส่ง ruleIndex:

```tsx
              {visibleSubstanceRows.map((row) => (
                <TableRow
                  key={row.rowId}
                  className="cursor-pointer"
                  onClick={() => onEditField("substance", row.parameterId, row.fieldIndex, row.ruleIndex)}
                >
                  <TableCell className="font-medium">{row.parameterName}</TableCell>
                  <TableCell>{row.substance}</TableCell>
                  <TableCell>{row.value ?? "-"}</TableCell>
                  <TableCell>{row.value2 ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      label={`แก้ไขเกณฑ์สาร ${row.fieldLabel}`}
                      onClick={() => onEditField("substance", row.parameterId, row.fieldIndex, row.ruleIndex)}
                    />
                  </TableCell>
                </TableRow>
              ))}
```

3c. `EditButton` (~บรรทัด 479-485) — กันคลิกปุ่มแล้ว bubble ไปแถว (แท็บอื่นไม่มี row onClick จึงไม่กระทบ):

```tsx
function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  );
}
```

แท็บ conditional / labelTolerance: **ไม่แตะ** (เรียก 3 อาร์กิวเมนต์เหมือนเดิม — TS ผ่านเพราะพารามิเตอร์ที่ 4 optional)

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run src/components/lis/ParameterCriteriaTabs.test.tsx`
Expected: PASS 18/18 (16 เดิม + 2 ใหม่)

- [ ] **Step 5: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ (ParameterSettings ยังส่ง handler 3 พารามิเตอร์เข้า prop 4-พารามิเตอร์ optional ได้ — assignable)

- [ ] **Step 6: Commit (explicit pathspec)**

```bash
git add src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx
git commit -m "feat(parameter-settings): pass rule index and row click from substance criteria tab" -- src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx
```

---

### Task 3: `ParameterSettings` — เปิด dialog เล็กตาม `ruleIndex` (+ fallback ตัวเต็ม)

**Files:**
- Modify: `src/pages/ParameterSettings.tsx` (import ~บรรทัด 30, `CriteriaEditorTarget` ~126, derive ~2677, `handleEditCriteriaField` ~2685, render branch ~2947)

**Interfaces:**
- Consumes: `SubstanceStandardRowDialog` (Task 1), `onEditField` 4-อาร์กิวเมนต์ (Task 2), `handleSaveCriteriaField`/`closeCriteriaEditor`/busy-ref เดิม (ไม่แก้)
- Produces: — (จุดจบของ feature)

ไม่มีเทสระดับหน้า (ParameterSettings ไม่มี test file) — verification = เทส component 2 ไฟล์ + full suite + tsc; TDD ไม่ applicable กับ wiring นี้

- [ ] **Step 1: แก้โค้ด 5 จุด** (ตำแหน่งอาจขยับ ±บรรทัด ให้ match ด้วยเนื้อโค้ดเดิม):

1a. import (ใต้ import `SubstanceStandardsDialog` บรรทัด ~30):

```tsx
import { SubstanceStandardsDialog } from "@/components/lis/SubstanceStandardsDialog";
import { SubstanceStandardRowDialog } from "@/components/lis/SubstanceStandardRowDialog";
```

1b. `CriteriaEditorTarget` (~บรรทัด 126-130):

```tsx
type CriteriaEditorTarget = {
  mode: AdvancedCriteriaMode;
  parameterId: string;
  fieldIndex: number;
  ruleIndex: number | null;
};
```

1c. derive `criteriaRowStandard` — วางต่อท้ายบล็อก `criteriaField` (~บรรทัด 2677-2679):

```tsx
  const criteriaField = criteriaParameter && criteriaEditor
    ? criteriaParameter.valueFields?.[criteriaEditor.fieldIndex]
    : undefined;

  const criteriaRowStandard =
    criteriaEditor?.mode === "substance" && criteriaEditor.ruleIndex != null
      ? criteriaField?.substanceStandards?.[criteriaEditor.ruleIndex]
      : undefined;
```

1d. `handleEditCriteriaField` (~บรรทัด 2685-2695) — รับ + เก็บ `ruleIndex`:

```tsx
  const handleEditCriteriaField = (
    mode: AdvancedCriteriaMode,
    parameterId: string,
    fieldIndex: number,
    ruleIndex: number | null = null,
  ) => {
    const parameter = parameters.find((item) => item._id === parameterId);
    const field = parameter?.valueFields?.[fieldIndex];
    if (!parameter || !field) {
      toast.error("ไม่พบ parameter หรือ field ที่ต้องการแก้ไข");
      return;
    }
    criteriaSaveBusyRef.current = false;
    setCriteriaSaveBusy(false);
    setCriteriaEditor({ mode, parameterId, fieldIndex, ruleIndex });
  };
```

1e. render branch substance (~บรรทัด 2947-2953) — เดิม:

```tsx
        criteriaEditor.mode === "substance" ? (
          <SubstanceStandardsDialog
            open
            field={criteriaField}
            onClose={closeCriteriaEditor}
            onSave={(next) => handleSaveCriteriaField({ ...criteriaField, substanceStandards: next })}
          />
        ) : criteriaEditor.mode === "conditional" ? (
```

ใหม่ (dialog เล็กเมื่อมีเกณฑ์ตัวนั้นจริง, fallback ตัวเต็มเมื่อ setup row / index หลุด):

```tsx
        criteriaEditor.mode === "substance" ? (
          criteriaRowStandard ? (
            <SubstanceStandardRowDialog
              open
              substance={criteriaRowStandard}
              parameterName={criteriaParameter?.name ?? ""}
              fieldLabel={criteriaField.label}
              unit={criteriaField.unit}
              onClose={closeCriteriaEditor}
              onSave={(next) =>
                handleSaveCriteriaField({
                  ...criteriaField,
                  substanceStandards: (criteriaField.substanceStandards ?? []).map((standard, index) =>
                    index === criteriaEditor.ruleIndex ? next : standard,
                  ),
                })
              }
            />
          ) : (
            <SubstanceStandardsDialog
              open
              field={criteriaField}
              onClose={closeCriteriaEditor}
              onSave={(next) => handleSaveCriteriaField({ ...criteriaField, substanceStandards: next })}
            />
          )
        ) : criteriaEditor.mode === "conditional" ? (
```

หมายเหตุ: ปุ่ม "ตั้งเงื่อนไขรายสาร (N สาร)" ในฟอร์มแก้ parameter (บรรทัด ~1440) ใช้ `SubstanceStandardsDialog` instance คนละตัว — **ไม่แตะ** ยังเปิดตัวเต็มเหมือนเดิม

- [ ] **Step 2: รันเทส component ทั้งสอง**

Run: `npx vitest run src/components/lis/SubstanceStandardRowDialog.test.tsx src/components/lis/ParameterCriteriaTabs.test.tsx`
Expected: PASS 22/22

- [ ] **Step 3: full suite + type-check**

Run: `npm run test`
Expected: เขียวทั้งหมด (ถ้ามี fail ในไฟล์ที่ไม่ได้แตะ ให้รายงานเป็น concern — อาจมาจากเซสชันคู่ขนาน อย่าแก้เอง)

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่อ้างถึง ParameterSettings / SubstanceStandardRowDialog / ParameterCriteriaTabs

- [ ] **Step 4: Commit (explicit pathspec)**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameter-settings): open per-substance quick edit from criteria row" -- src/pages/ParameterSettings.tsx
```

---

## Manual E2E (หลังจบ — ทำโดย user)

1. หน้า ตั้งค่าพารามิเตอร์ → แท็บ "แยกตามสาร" → คลิกแถวสาร (หรือปุ่ม ✎) → ขึ้น dialog เล็กของสารนั้นตัวเดียว
2. แก้เงื่อนไข/ค่า → บันทึก → toast สำเร็จ → ค่าในตารางอัปเดต, สารตัวอื่นไม่กระทบ
3. แถว "ยังไม่ตั้งค่า" (field ที่ไม่มีสาร) → ยังเปิด dialog ตัวเต็ม
4. ฟอร์มแก้ parameter → ปุ่ม "ตั้งเงื่อนไขรายสาร (N สาร)" → ยังเปิด dialog ตัวเต็ม (เพิ่ม/ลบสารได้)
5. แท็บ เงื่อนไขพิเศษ / ตาม %สาร → เปิด dialog เดิมของมัน
