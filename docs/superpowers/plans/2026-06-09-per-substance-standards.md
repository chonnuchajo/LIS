# Per-Substance Standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ค่าที่ต้องใส่ชนิด number/float เปิดโหมด "แยกเงื่อนไขตามสาร" ได้ — ตั้งเกณฑ์ต่อสารผ่าน popup และตอนบันทึกผลแตกช่องกรอกรายสาร + validate อัตโนมัติแต่ละสาร

**Architecture:** เพิ่ม `substanceMode` + `substanceStandards[]` บน `ParameterValueField`. ตอน render/validate ใช้ helper กลาง `expandFieldForItem(field, commonName)` ที่แตก field เดียวเป็นหลาย "render unit" ราย substance โดยฉีด standard ของสารนั้นลงใน **virtual field** — ทำให้ `TestField` และ `isFieldAbnormal` เดิมทำงานต่อได้โดยไม่ต้องแก้ตัวมันเอง. ค่าผลเก็บใต้ composite key `label::substanceKey` ใน `result.values` (ไม่ต้อง migrate schema).

**Tech Stack:** React + TypeScript, Vitest, TanStack Query, shadcn/ui (Dialog), Express/Mongoose (ไม่แตะ — payload เดิมรองรับ key ใหม่อยู่แล้ว)

**Spec:** `docs/superpowers/specs/2026-06-09-per-substance-standards-design.md`

---

## File Structure

- `src/lib/api.ts` — เพิ่ม type `SubstanceStandard`, field ใหม่บน `ParameterValueField` (modify)
- `src/lib/substances.ts` — เพิ่ม `matchSubstanceKey`, `substanceFieldKey` (modify)
- `src/lib/standardOperators.ts` — **ใหม่**: `OPERATOR_OPTIONS` + `describeSubstanceStandard` ใช้ร่วมโดย dialog/preview
- `src/lib/parameterValidation.ts` — เพิ่ม `findSubstanceStandard`, `isSubstanceAbnormal`, `expandFieldForItem`; อัปเดต `countAbnormalInResults` (modify)
- `src/components/lis/SubstanceStandardsDialog.tsx` — **ใหม่**: popup เลือกสาร + ตั้งเกณฑ์
- `src/pages/ParameterSettings.tsx` — toggle + ปุ่มเปิด dialog + preview (modify)
- `src/pages/QCTestingDetailPage.tsx` — ใช้ `expandFieldForItem` ใน render/validate/countAbnormal (modify)
- `src/pages/LabTestingDetailPage.tsx` — เหมือน QC (2 จุด render) (modify)
- tests: `src/lib/substances.test.ts`, `src/lib/parameterValidation.test.ts`, `src/lib/standardOperators.test.ts`

**Match-key rule (ใช้ทุกที่):** `matchSubstanceKey(name) = substances.substanceKey(extractSubstanceName(name))` — จับคู่ config↔test-time ด้วยชื่อสาร token แรก lowercased.

---

## Task 1: Match-key + composite-key helpers (substances.ts)

**Files:**
- Modify: `src/lib/substances.ts`
- Test: `src/lib/substances.test.ts`

- [ ] **Step 1: Write failing tests**

เพิ่มท้ายไฟล์ `src/lib/substances.test.ts`:

```ts
import { matchSubstanceKey, substanceFieldKey } from "./substances";

describe("matchSubstanceKey", () => {
  it("reduces a spec string to its first-token lowercase key", () => {
    expect(matchSubstanceKey("ABAMECTIN 1.8% W/V EC")).toBe("abamectin");
  });
  it("trims and lowercases a bare name", () => {
    expect(matchSubstanceKey("  Imidacloprid ")).toBe("imidacloprid");
  });
  it("returns empty string for empty input", () => {
    expect(matchSubstanceKey("")).toBe("");
  });
  it("uses the first token of a merged 'A + B' fragment", () => {
    expect(matchSubstanceKey("Alpha + Beta")).toBe("alpha");
  });
});

describe("substanceFieldKey", () => {
  it("joins label and substance key with '::'", () => {
    expect(substanceFieldKey("ปริมาณสารสำคัญ", "ABAMECTIN 1.8% EC")).toBe(
      "ปริมาณสารสำคัญ::abamectin",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/substances.test.ts`
Expected: FAIL — `matchSubstanceKey`/`substanceFieldKey` is not exported.

- [ ] **Step 3: Implement helpers**

เพิ่มท้ายไฟล์ `src/lib/substances.ts`:

```ts
// Canonical match key for a substance: first whitespace token, trimmed + lowercased.
// Used on BOTH sides (config substanceStandards[].substance and test-time
// parseSubstances() output) so they line up regardless of trailing % / form spec.
export function matchSubstanceKey(name: string): string {
  return substanceKey(extractSubstanceName(name));
}

// Storage key for a per-substance value inside result.values:
// `${fieldLabel}::${matchSubstanceKey(substance)}`.
export function substanceFieldKey(label: string, substance: string): string {
  return `${label}::${matchSubstanceKey(substance)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/substances.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/substances.ts src/lib/substances.test.ts
git commit -m "feat(substances): matchSubstanceKey + substanceFieldKey helpers"
```

---

## Task 2: Data model — SubstanceStandard type + field flags (api.ts)

**Files:**
- Modify: `src/lib/api.ts` (รอบ ๆ บรรทัด 611–662)

ไม่มี runtime test (type-only) — verify ด้วย tsc ใน Task ถัด ๆ ไป

- [ ] **Step 1: Add type + fields**

ใน `src/lib/api.ts` หลัง `export type StandardOperator = ...` (บรรทัด ~620) เพิ่ม:

```ts
export type SubstanceStandard = {
  substance: string;      // เก็บแบบ extractSubstanceName เช่น "ABAMECTIN"
  operator: StandardOperator;
  value: number | null;
  value2?: number | null; // ใช้กับ between / tolerance
};
```

แล้วใน `export type ParameterValueField = { ... }` เพิ่มสองบรรทัดนี้ (วางใกล้ ๆ `standardValue2`):

```ts
  // Per-substance standards (number/float only). เมื่อ substanceMode = true
  // ค่าเดี่ยว standardOperator/standardValue ถูก ignore.
  substanceMode?: boolean;
  substanceStandards?: SubstanceStandard[];
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่จากไฟล์นี้ (repo อาจมี ~12 latent error เดิม — ห้ามเพิ่มของใหม่)

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): SubstanceStandard type + substanceMode/substanceStandards on ParameterValueField"
```

---

## Task 3: Shared operator options + describe helper (standardOperators.ts)

**Files:**
- Create: `src/lib/standardOperators.ts`
- Test: `src/lib/standardOperators.test.ts`

- [ ] **Step 1: Write failing test**

สร้าง `src/lib/standardOperators.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { OPERATOR_OPTIONS, describeSubstanceStandard } from "./standardOperators";

describe("OPERATOR_OPTIONS", () => {
  it("includes a 'none' entry plus all 7 operators", () => {
    const values = OPERATOR_OPTIONS.map((o) => o.value);
    expect(values).toContain("none");
    expect(values).toEqual(
      expect.arrayContaining(["lt", "lte", "eq", "gte", "gt", "between", "tolerance"]),
    );
  });
});

describe("describeSubstanceStandard", () => {
  it("renders a simple operator with unit", () => {
    expect(
      describeSubstanceStandard({ substance: "X", operator: "gte", value: 95, value2: null }, "%"),
    ).toBe("≥ 95%");
  });
  it("renders between", () => {
    expect(
      describeSubstanceStandard({ substance: "X", operator: "between", value: 2, value2: 3 }, ""),
    ).toBe("2 - 3");
  });
  it("renders tolerance", () => {
    expect(
      describeSubstanceStandard({ substance: "X", operator: "tolerance", value: 100, value2: 5 }, "%"),
    ).toBe("100 ± 5%%");
  });
  it("returns empty string when value missing", () => {
    expect(
      describeSubstanceStandard({ substance: "X", operator: "gte", value: null, value2: null }, "%"),
    ).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/standardOperators.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

สร้าง `src/lib/standardOperators.ts`:

```ts
import type { StandardOperator, SubstanceStandard } from "./api";

export const OPERATOR_OPTIONS: { value: StandardOperator | "none"; label: string }[] = [
  { value: "none", label: "— ไม่ตรวจ —" },
  { value: "lt", label: "น้อยกว่า (<)" },
  { value: "lte", label: "น้อยกว่าหรือเท่ากับ (≤)" },
  { value: "eq", label: "เท่ากับ (=)" },
  { value: "gte", label: "มากกว่าหรือเท่ากับ (≥)" },
  { value: "gt", label: "มากกว่า (>)" },
  { value: "between", label: "อยู่ในช่วง (between)" },
  { value: "tolerance", label: "ค่ามาตรฐาน ± %" },
];

// สรุปเกณฑ์ของ SubstanceStandard เป็นข้อความสั้น เช่น "≥ 95%"
export function describeSubstanceStandard(std: SubstanceStandard, unit: string): string {
  const u = unit ? unit : "";
  const v1 = std.value;
  const v2 = std.value2;
  if (v1 == null) return "";
  switch (std.operator) {
    case "lt": return `< ${v1}${u}`;
    case "lte": return `≤ ${v1}${u}`;
    case "eq": return `= ${v1}${u}`;
    case "gte": return `≥ ${v1}${u}`;
    case "gt": return `> ${v1}${u}`;
    case "between": return v2 == null ? "" : `${v1} - ${v2}${u}`;
    case "tolerance": return v2 == null ? "" : `${v1} ± ${v2}%${u}`;
    default: return "";
  }
}
```

> หมายเหตุ: เคส tolerance ในเทสต์ให้ผล `"100 ± 5%%"` (unit `%` ต่อท้าย `±5%`) — ตั้งใจ เพราะ unit เป็น `%` เอง

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/standardOperators.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/standardOperators.ts src/lib/standardOperators.test.ts
git commit -m "feat(standards): shared OPERATOR_OPTIONS + describeSubstanceStandard"
```

---

## Task 4: Validation + field expansion (parameterValidation.ts)

**Files:**
- Modify: `src/lib/parameterValidation.ts`
- Test: `src/lib/parameterValidation.test.ts`

- [ ] **Step 1: Write failing tests**

เพิ่มท้าย `src/lib/parameterValidation.test.ts` (และเพิ่ม import):

```ts
import {
  findSubstanceStandard,
  isSubstanceAbnormal,
  expandFieldForItem,
} from "./parameterValidation";
import type { ParameterValueField } from "./api";

const subField: ParameterValueField = {
  label: "ปริมาณสารสำคัญ",
  type: "number",
  unit: "%",
  substanceMode: true,
  substanceStandards: [
    { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
    { substance: "IMIDACLOPRID", operator: "between", value: 90, value2: 100 },
  ],
};

describe("findSubstanceStandard", () => {
  it("matches by first-token, case-insensitive, ignoring form spec", () => {
    expect(findSubstanceStandard(subField, "abamectin 1.8% w/v ec")?.value).toBe(95);
  });
  it("returns undefined when no substance matches", () => {
    expect(findSubstanceStandard(subField, "GLYPHOSATE")).toBeUndefined();
  });
});

describe("isSubstanceAbnormal", () => {
  it("flags a value below a gte standard", () => {
    const std = findSubstanceStandard(subField, "ABAMECTIN");
    expect(isSubstanceAbnormal(subField, std, 90)).toBe(true);
    expect(isSubstanceAbnormal(subField, std, 96)).toBe(false);
  });
  it("never flags when there is no standard", () => {
    expect(isSubstanceAbnormal(subField, undefined, 0)).toBe(false);
  });
});

describe("expandFieldForItem", () => {
  it("returns the field unchanged for non-substance fields", () => {
    const plain: ParameterValueField = { label: "pH", type: "number" };
    const units = expandFieldForItem(plain, "ABAMECTIN");
    expect(units).toHaveLength(1);
    expect(units[0].key).toBe("pH");
    expect(units[0].field).toBe(plain);
  });

  it("expands one unit per substance with injected standard + composite key", () => {
    const units = expandFieldForItem(subField, "ABAMECTIN + IMIDACLOPRID");
    expect(units).toHaveLength(2);
    expect(units[0].key).toBe("ปริมาณสารสำคัญ::abamectin");
    expect(units[0].field.label).toBe("ปริมาณสารสำคัญ — ABAMECTIN");
    expect(units[0].field.standardOperator).toBe("gte");
    expect(units[0].field.standardValue).toBe(95);
    expect(units[0].field.substanceMode).toBe(false); // virtual field ไม่ recurse
  });

  it("expands substances with no standard (no operator → no validation)", () => {
    const units = expandFieldForItem(subField, "GLYPHOSATE");
    expect(units).toHaveLength(1);
    expect(units[0].field.standardOperator).toBeUndefined();
  });

  it("falls back to a single plain unit when commonName is empty", () => {
    const units = expandFieldForItem(subField, "");
    expect(units).toHaveLength(1);
    expect(units[0].key).toBe("ปริมาณสารสำคัญ");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Implement**

ใน `src/lib/parameterValidation.ts` เพิ่ม import บนสุด:

```ts
import { parseSubstances, extractSubstanceName, matchSubstanceKey, substanceFieldKey } from "./substances";
import type { SubstanceStandard } from "./api";
```

เพิ่มฟังก์ชันใหม่ (วางหลัง `isFieldAbnormal`):

```ts
export function findSubstanceStandard(
  field: ParameterValueField,
  substanceName: string,
): SubstanceStandard | undefined {
  const key = matchSubstanceKey(substanceName);
  if (!key) return undefined;
  return (field.substanceStandards ?? []).find(
    (s) => matchSubstanceKey(s.substance) === key,
  );
}

// เช็คผิดปกติของค่ารายสาร โดยสร้าง virtual field แล้ว reuse isNumericAbnormal เดิม
export function isSubstanceAbnormal(
  field: ParameterValueField,
  std: SubstanceStandard | undefined,
  value: unknown,
): boolean {
  if (!std || !std.operator || std.value == null) return false;
  return isNumericAbnormal(
    {
      ...field,
      standardOperator: std.operator,
      standardValue: std.value,
      standardValue2: std.value2 ?? null,
    },
    value,
  );
}

export type RenderFieldUnit = {
  key: string;                 // ใช้เป็นทั้ง React key และ storage key ใน result.values
  field: ParameterValueField;  // อาจเป็น virtual field (ฉีด standard ของสารแล้ว)
  substanceName?: string;      // มีค่าเมื่อเป็น unit รายสาร
};

// แตก field เดียวเป็นหลาย render unit เมื่อ substanceMode เปิด.
// non-substance → คืน unit เดียวที่อ้าง field เดิม (key = field.label).
export function expandFieldForItem(
  field: ParameterValueField,
  commonName: string | undefined,
): RenderFieldUnit[] {
  const isNumeric = field.type === "number" || field.type === "float";
  if (!field.substanceMode || !isNumeric) {
    return [{ key: field.label, field }];
  }
  const substances = parseSubstances(commonName ?? "");
  if (substances.length === 0 || (substances.length === 1 && !substances[0])) {
    return [{ key: field.label, field }];
  }
  return substances.map((raw) => {
    const name = extractSubstanceName(raw) || raw;
    const std = findSubstanceStandard(field, name);
    const vfield: ParameterValueField = {
      ...field,
      label: `${field.label} — ${name}`,
      substanceMode: false,
      standardOperator: std?.operator,
      standardValue: std?.value ?? null,
      standardValue2: std?.value2 ?? null,
    };
    return { key: substanceFieldKey(field.label, name), field: vfield, substanceName: name };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(validation): findSubstanceStandard + isSubstanceAbnormal + expandFieldForItem"
```

---

## Task 5: countAbnormalInResults handles substanceMode (key-scan)

**Files:**
- Modify: `src/lib/parameterValidation.ts:55-74` (`countAbnormalInResults`)
- Test: `src/lib/parameterValidation.test.ts`

> ฟังก์ชันนี้ไม่มี commonName ในมือ — ใช้วิธี scan keys ใน `values` ที่ขึ้นต้นด้วย `${field.label}::` แล้ว match กับ substanceStandards

- [ ] **Step 1: Write failing test**

เพิ่มใน block `describe("countAbnormalInResults", ...)` ของ `parameterValidation.test.ts`:

```ts
it("counts per-substance abnormals via composite keys", () => {
  const p = {
    _id: "ps",
    name: "active",
    valueFields: [subField], // จาก Task 4
  } as unknown as ParameterItem;
  const r = {
    parameterId: "ps",
    itemSeq: 1,
    values: {
      "ปริมาณสารสำคัญ::abamectin": 90,      // < 95 → abnormal
      "ปริมาณสารสำคัญ::imidacloprid": 95,   // ใน 90-100 → ปกติ
    },
  } as unknown as QCTestResult;
  expect(countAbnormalInResults([r], [p])).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/parameterValidation.test.ts -t "per-substance abnormals"`
Expected: FAIL — ปัจจุบันอ่าน `values[field.label]` เดียว ได้ 0

- [ ] **Step 3: Implement — แก้ลูปใน countAbnormalInResults**

แทนที่ลูป `for (const field of param.valueFields) {...}` (บรรทัด ~69-72) ด้วย:

```ts
    for (const field of param.valueFields) {
      const isNumeric = field.type === "number" || field.type === "float";
      if (field.substanceMode && isNumeric) {
        const prefix = `${field.label}::`;
        for (const [vkey, vval] of Object.entries(values)) {
          if (!vkey.startsWith(prefix)) continue;
          const subKey = vkey.slice(prefix.length);
          const std = (field.substanceStandards ?? []).find(
            (s) => matchSubstanceKey(s.substance) === subKey,
          );
          if (isSubstanceAbnormal(field, std, vval)) count += 1;
        }
        continue;
      }
      if (isFieldAbnormal(field, values[field.label])) count += 1;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: PASS (รวมเทสต์เดิมทั้งหมด)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(validation): countAbnormalInResults counts per-substance values"
```

---

## Task 6: SubstanceStandardsDialog component

**Files:**
- Create: `src/components/lis/SubstanceStandardsDialog.tsx`

> Component นี้ไม่มี unit test (UI-heavy) — verify ด้วย tsc + manual ใน Task 10. โครงสร้าง: ฝั่งซ้ายเลือกสารจาก master items (กรองด้วย commonName / ชื่อ / กลุ่ม + ค้นหา), ฝั่งขวาแก้เกณฑ์ต่อสาร

- [ ] **Step 1: Implement component**

สร้าง `src/components/lis/SubstanceStandardsDialog.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Search } from "lucide-react";
import { api, type ParameterValueField, type SubstanceStandard, type StandardOperator } from "@/lib/api";
import { parseSubstances, extractSubstanceName, matchSubstanceKey } from "@/lib/substances";
import { OPERATOR_OPTIONS, describeSubstanceStandard } from "@/lib/standardOperators";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";

const COMMON_NAME_KEYS = ["common_name", "commonname", "commonName", "item_name2", "itemType"];
const ITEM_NAME_KEYS = ["item_name", "itemname", "itemName", "description", "item_desc"];

function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

type Props = {
  open: boolean;
  field: ParameterValueField;
  onClose: () => void;
  onSave: (next: SubstanceStandard[]) => void;
};

export function SubstanceStandardsDialog({ open, field, onClose, onSave }: Props) {
  const unit = field.unit ? ` ${field.unit}` : "";
  const [list, setList] = useState<SubstanceStandard[]>(field.substanceStandards ?? []);
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState("");

  // reseed รายการทุกครั้งที่เปิด dialog (component คงอยู่ในหน้า ไม่ remount)
  useEffect(() => {
    if (open) setList(field.substanceStandards ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: masterRows = [] } = useQuery<Record<string, unknown>[]>({
    queryKey: ["master-items"],
    queryFn: async () => {
      const res = await api.get<unknown>("/master-items");
      return (Array.isArray(res) ? res : (res as { data?: unknown[] })?.data ?? []) as Record<string, unknown>[];
    },
    enabled: open,
  });

  const { data: groups = [] } = useQuery<{ _id: string; name: string; commonNames?: string[] }[]>({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const res = await api.get<unknown>("/item-groups");
      return (Array.isArray(res) ? res : (res as { data?: unknown[] })?.data ?? []) as { _id: string; name: string; commonNames?: string[] }[];
    },
    enabled: open,
  });

  // dedupe substances by match-key, keep first display name
  const buildSubstances = (commonNames: string[]): string[] => {
    const byKey = new Map<string, string>();
    for (const cn of commonNames) {
      for (const raw of parseSubstances(cn)) {
        const name = extractSubstanceName(raw) || raw;
        const key = matchSubstanceKey(name);
        if (key && !byKey.has(key)) byKey.set(key, name);
      }
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b, ["th", "en"]));
  };

  const byCommonName = useMemo(
    () => buildSubstances(masterRows.map((r) => pickField(r, COMMON_NAME_KEYS)).filter(Boolean)),
    [masterRows],
  );
  const byName = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? masterRows.filter((r) => pickField(r, ITEM_NAME_KEYS).toLowerCase().includes(q))
      : masterRows;
    return buildSubstances(rows.map((r) => pickField(r, COMMON_NAME_KEYS)).filter(Boolean));
  }, [masterRows, search]);

  const selectedKeys = useMemo(() => new Set(list.map((s) => matchSubstanceKey(s.substance))), [list]);

  const addSubstance = (name: string) => {
    const key = matchSubstanceKey(name);
    if (!key || selectedKeys.has(key)) return;
    setList((prev) => [...prev, { substance: name, operator: "gte", value: null, value2: null }]);
  };
  const removeAt = (i: number) => setList((prev) => prev.filter((_, idx) => idx !== i));
  const patchAt = (i: number, patch: Partial<SubstanceStandard>) =>
    setList((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const filterBox = (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา..." className="h-9 pl-8" />
    </div>
  );

  const pickList = (names: string[]) => (
    <div className="max-h-56 overflow-y-auto rounded border divide-y">
      {names.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">ไม่พบสาร</p>
      ) : (
        names.map((name) => {
          const picked = selectedKeys.has(matchSubstanceKey(name));
          return (
            <button
              key={name}
              type="button"
              disabled={picked}
              onClick={() => addSubstance(name)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40"
            >
              <span className="truncate">{name}</span>
              {!picked && <Plus className="h-4 w-4 text-primary shrink-0" />}
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>ตั้งเงื่อนไขรายสาร — {field.label}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* ฝั่งเลือกสาร */}
          <div>
            <Label className="text-sm mb-1.5 block">เลือกสาร</Label>
            <Tabs defaultValue="common">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="common">commonName</TabsTrigger>
                <TabsTrigger value="name">ชื่อ</TabsTrigger>
                <TabsTrigger value="group">กลุ่ม</TabsTrigger>
              </TabsList>
              <TabsContent value="common">{pickList(byCommonName)}</TabsContent>
              <TabsContent value="name">
                {filterBox}
                {pickList(byName)}
              </TabsContent>
              <TabsContent value="group">
                <div className="max-h-56 overflow-y-auto rounded border divide-y">
                  {groups.map((g) => (
                    <button
                      key={g._id}
                      type="button"
                      onClick={() => buildSubstances(g.commonNames ?? []).forEach(addSubstance)}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">{g.name}</span>
                      <Plus className="h-4 w-4 text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
            <div className="mt-2 flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addSubstance(manual); setManual(""); }
                }}
                placeholder="พิมพ์ชื่อสารเพิ่มเอง แล้ว Enter"
                className="h-9"
              />
              <Button type="button" variant="outline" className="h-9" onClick={() => { addSubstance(manual); setManual(""); }}>
                เพิ่ม
              </Button>
            </div>
          </div>

          {/* ฝั่งแก้เกณฑ์ */}
          <div>
            <Label className="text-sm mb-1.5 block">เกณฑ์ต่อสาร ({list.length})</Label>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่ได้เลือกสาร</p>
              ) : (
                list.map((std, i) => (
                  <div key={`${std.substance}-${i}`} className="rounded border p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{std.substance}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAt(i)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={std.operator}
                        onValueChange={(v) => patchAt(i, { operator: v as StandardOperator })}
                      >
                        <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OPERATOR_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={std.value ?? ""}
                        onChange={(e) => patchAt(i, { value: e.target.value === "" ? null : Number(e.target.value) })}
                        placeholder={std.operator === "tolerance" ? "ค่ามาตรฐาน" : std.operator === "between" ? "ตั้งแต่" : "ค่า"}
                        className="h-8 w-24"
                      />
                      {(std.operator === "between" || std.operator === "tolerance") && (
                        <Input
                          type="number"
                          value={std.value2 ?? ""}
                          onChange={(e) => patchAt(i, { value2: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder={std.operator === "tolerance" ? "± %" : "ถึง"}
                          className="h-8 w-24"
                        />
                      )}
                      <span className="text-xs text-emerald-700">{describeSubstanceStandard(std, unit.trim())}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="button" variant="primary" onClick={() => { onSave(list); onClose(); }}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่. ถ้า `@/components/ui/tabs` ไม่มี ให้เช็คด้วย `ls src/components/ui/tabs.tsx` — ถ้าไม่มีให้เปลี่ยน Tabs เป็นปุ่ม segmented ธรรมดา (3 ปุ่ม + state `mode`).

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/SubstanceStandardsDialog.tsx
git commit -m "feat(parameters): SubstanceStandardsDialog — pick substances + per-substance standards"
```

---

## Task 7: ParameterSettings — toggle + dialog wiring + preview

**Files:**
- Modify: `src/pages/ParameterSettings.tsx` (บล็อก `requiresUnit` ~1206-1325 และ `StandardPreview` ~453-495)

- [ ] **Step 1: Add import + dialog state**

บนสุดของไฟล์ (กับ import อื่น) เพิ่ม:

```ts
import { SubstanceStandardsDialog } from "@/components/lis/SubstanceStandardsDialog";
import { describeSubstanceStandard } from "@/lib/standardOperators";
```

หา component ที่ render value-field editor (ตัวที่มี `requiresUnit` + `onChange(field)`); เพิ่ม state ใกล้ ๆ `optionDraft`:

```ts
const [substanceDialogOpen, setSubstanceDialogOpen] = useState(false);
```

- [ ] **Step 2: Toggle + conditional block**

ในบล็อก `{requiresUnit ? ( ... ) : null}` (เริ่ม ~1206) — ครอบเนื้อหาเดิมด้วยเงื่อนไข substanceMode. แก้เป็น:

```tsx
{requiresUnit ? (
  <div className="space-y-3">
    {/* toggle แยกรายสาร */}
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox
        checked={!!field.substanceMode}
        onCheckedChange={(c) =>
          onChange({
            ...field,
            substanceMode: !!c,
            substanceStandards: c ? field.substanceStandards ?? [] : field.substanceStandards,
            // เมื่อเปิดโหมดสาร ล้างค่าเดี่ยว
            standardOperator: c ? undefined : field.standardOperator,
            standardValue: c ? null : field.standardValue,
            standardValue2: c ? null : field.standardValue2,
          })
        }
      />
      แยกเงื่อนไขตามสาร
    </label>

    {field.substanceMode ? (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-3 space-y-1.5">
            <Label className="text-sm">หน่วย *</Label>
            <Input
              value={field.unit ?? ""}
              onChange={(e) => onChange({ ...field, unit: e.target.value })}
              placeholder="เช่น %, mg/L"
              className="h-10"
            />
          </div>
          <div className="sm:col-span-9 flex items-end">
            <Button type="button" variant="outline" className="h-10" onClick={() => setSubstanceDialogOpen(true)}>
              ตั้งเงื่อนไขรายสาร ({(field.substanceStandards ?? []).length} สาร)
            </Button>
          </div>
        </div>
        <StandardPreview field={field} />
        <SubstanceStandardsDialog
          open={substanceDialogOpen}
          field={field}
          onClose={() => setSubstanceDialogOpen(false)}
          onSave={(next) => onChange({ ...field, substanceStandards: next })}
        />
      </div>
    ) : (
      <div className="space-y-3">
        {/* ----- บล็อกหน่วย+เงื่อนไขเดี่ยวเดิมทั้งหมด (ที่อยู่ใน <div className="space-y-3"> เดิม) ----- */}
        {/* ย้ายเนื้อหาเดิมตั้งแต่ <div className="grid ... sm:grid-cols-12"> หน่วย/เงื่อนไข/ค่ามาตรฐาน
            มาจนถึง </div> ก่อน <StandardPreview/> มาวางตรงนี้ทั้งหมด แล้วตามด้วย: */}
        <StandardPreview field={field} />
      </div>
    )}
  </div>
) : null}
```

> หมายเหตุการ refactor: เนื้อหาเดิมในบล็อก `requiresUnit` (หน่วย + เงื่อนไข + ค่ามาตรฐาน between/tolerance/single + `<StandardPreview/>`) ให้ย้ายมาอยู่ใต้กิ่ง `else` (`!field.substanceMode`) แบบยกมาทั้งก้อน ไม่ต้องแก้ logic ภายใน

- [ ] **Step 3: Update StandardPreview to summarize substance mode**

แก้ต้นฟังก์ชัน `StandardPreview` (บรรทัด ~453) เพิ่มสาขา substanceMode ก่อน logic เดิม:

```tsx
function StandardPreview({ field }: { field: ParameterValueField }) {
  if (field.substanceMode) {
    const stds = field.substanceStandards ?? [];
    if (stds.length === 0) {
      return <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้งเงื่อนไขสาร</p>;
    }
    return (
      <p className="text-xs text-emerald-700">
        {stds
          .map((s) => `${s.substance} ${describeSubstanceStandard(s, field.unit ?? "")}`.trim())
          .join(" · ")}
      </p>
    );
  }
  const op = field.standardOperator;
  // ...ของเดิมต่อจากนี้ทั้งหมด...
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json` แล้ว `npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 5: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameters): substanceMode toggle + dialog + preview in ParameterSettings"
```

---

## Task 8: QC testing detail — render/validate/count per substance

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

- [ ] **Step 1: Add import**

เพิ่มใน import จาก parameterValidation:

```ts
import { expandFieldForItem } from "@/lib/parameterValidation";
```

- [ ] **Step 2: Swap the render loop (บรรทัด ~839-884)**

แทนที่ callback ใน `fields.map((field) => { ... })` — ส่วนที่ return `<div key={field.label}>...<TestField .../>...</div>` (กิ่ง non-reference) — ให้คืน **หลาย TestField** ผ่าน `expandFieldForItem`. แก้ block หลังกิ่ง reference เป็น:

```tsx
                          const units = expandFieldForItem(field, item.commonName);
                          return units.map((unit) => {
                            const noteLabel = noteLabelFor(unit.key);
                            const beforeRef =
                              param.hasPhases &&
                              effectivePhase === 2 &&
                              (field.phase ?? 'both') === 'both'
                                ? (values[k]?.[unit.key] ?? '')
                                : null;
                            return (
                              <div key={unit.key}>
                                <TestField
                                  field={unit.field}
                                  item={item}
                                  itemGroupIds={idsFor(item)}
                                  value={phaseValues[k]?.[unit.key] ?? ''}
                                  noteValue={phaseValues[k]?.[noteLabel] ?? ''}
                                  saveInfo={phaseSaves[k]?.[unit.key]}
                                  noteSaveInfo={phaseSaves[k]?.[noteLabel]}
                                  disabled={isLocked || phaseLocked}
                                  onChange={(val) =>
                                    handleFieldChange(petition, item, param, unit.key, val, effectivePhase)
                                  }
                                  onNoteChange={(val) =>
                                    handleFieldChange(petition, item, param, noteLabel, val, effectivePhase)
                                  }
                                  previousValue={getPreviousValue(previousLookup, item, param._id!, unit.key)}
                                />
                                {beforeRef != null && beforeRef !== '' ? (
                                  <p className="text-[10px] text-grey-400 mt-0.5">
                                    ก่อน: <span className="font-mono">{String(beforeRef)}</span>
                                  </p>
                                ) : null}
                              </div>
                            );
                          });
```

> `fields.map` คืน array-of-arrays ได้ — React flatten ให้เอง

- [ ] **Step 3: Update countAbnormal() (บรรทัด ~552-574)**

แก้สองลูป `(param.valueFields ?? []).forEach((field) => {...})` ให้วน unit:

```tsx
        (param.valueFields ?? []).forEach((field) => {
          if ((field.phase ?? 'both') === 'after') return;
          expandFieldForItem(field, item.commonName).forEach((unit) => {
            if (isFieldAbnormal(unit.field, p1Values[unit.key])) count += 1;
          });
        });
        if (param.hasPhases) {
          const p2Values = valuesPhase2[k] ?? {};
          (param.valueFields ?? []).forEach((field) => {
            const ph = field.phase ?? 'both';
            if (ph === 'before') return;
            expandFieldForItem(field, item.commonName).forEach((unit) => {
              if (isFieldAbnormal(unit.field, p2Values[unit.key])) count += 1;
            });
          });
        }
```

- [ ] **Step 4: Update validate() required-check (บรรทัด ~585-601)**

แก้ลูป `visibleFields(param, phaseToCheck).forEach((field) => {...})`:

```tsx
        visibleFields(param, phaseToCheck).forEach((field) => {
          if (field.type === 'reference') return;
          expandFieldForItem(field, item.commonName).forEach((unit) => {
            const val = itemValues[unit.key];
            if (unit.field.required && (val == null || String(val).trim() === '')) {
              missing.push(`รายการ ${item.seq} › ${param.name} › ${unit.field.label}`);
              return;
            }
            if (
              unit.field.type === 'enum' &&
              (unit.field.requireNoteOn ?? []).includes(String(val ?? ''))
            ) {
              const noteVal = itemValues[noteLabelFor(unit.key)];
              if (!noteVal || String(noteVal).trim() === '') {
                missing.push(`รายการ ${item.seq} › ${param.name} › ${unit.field.label} (คำอธิบาย)`);
              }
            }
          });
        });
```

- [ ] **Step 5: Type-check + run tests**

Run: `npx tsc -p tsconfig.app.json` แล้ว `npx vitest run`
Expected: ไม่มี error ใหม่; เทสต์ผ่านหมด

- [ ] **Step 6: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-testing): render + validate + count per-substance fields"
```

---

## Task 9: Lab testing detail — render/validate/count per substance

**Files:**
- Modify: `src/pages/LabTestingDetailPage.tsx`

> เหมือน QC ทุกประการ แต่ Lab มี render สองจุด: lab params (บรรทัด ~767-811) และ shared QC params read-only (บรรทัด ~841-869). อัปเดตทั้งสองจุด + `countAbnormal` + `validate` ของหน้านี้

- [ ] **Step 1: Add import**

```ts
import { expandFieldForItem } from "@/lib/parameterValidation";
```

- [ ] **Step 2: Swap render site #1 (lab params, ~767-811)**

แทน block non-reference (`<div key={field.label}>...<TestField.../>...</div>`) ด้วยรูปแบบ units เดียวกับ Task 8 Step 2 — แต่ใช้ field set ของ Lab (ไม่มี `previousValue` prop ที่นี่):

```tsx
                              const units = expandFieldForItem(field, item.commonName);
                              return units.map((unit) => {
                                const noteLabel = noteLabelFor(unit.key);
                                const beforeRef =
                                  param.hasPhases &&
                                  effectivePhase === 2 &&
                                  (field.phase ?? 'both') === 'both'
                                    ? (values[k]?.[unit.key] ?? '')
                                    : null;
                                return (
                                  <div key={unit.key}>
                                    <TestField
                                      field={unit.field}
                                      item={item}
                                      itemGroupIds={idsFor(item)}
                                      value={phaseValues[k]?.[unit.key] ?? ''}
                                      noteValue={phaseValues[k]?.[noteLabel] ?? ''}
                                      saveInfo={phaseSaves[k]?.[unit.key]}
                                      noteSaveInfo={phaseSaves[k]?.[noteLabel]}
                                      disabled={isLocked || phaseLocked}
                                      onChange={(val) =>
                                        handleFieldChange(petition, item, param, unit.key, val, effectivePhase)
                                      }
                                      onNoteChange={(val) =>
                                        handleFieldChange(petition, item, param, noteLabel, val, effectivePhase)
                                      }
                                    />
                                    {beforeRef != null && beforeRef !== '' ? (
                                      <p className="text-[10px] text-grey-400 mt-0.5">
                                        ก่อน: <span className="font-mono">{String(beforeRef)}</span>
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              });
```

- [ ] **Step 3: Swap render site #2 (shared QC read-only, ~841-869)**

แทน block non-reference ด้วย:

```tsx
                              const units = expandFieldForItem(field, item.commonName);
                              return units.map((unit) => {
                                const noteLabel = noteLabelFor(unit.key);
                                return (
                                  <TestField
                                    key={unit.key}
                                    field={unit.field}
                                    item={item}
                                    itemGroupIds={idsFor(item)}
                                    value={phaseValues[k]?.[unit.key] ?? ''}
                                    noteValue={phaseValues[k]?.[noteLabel] ?? ''}
                                    saveInfo={phaseSaves[k]?.[unit.key]}
                                    noteSaveInfo={phaseSaves[k]?.[noteLabel]}
                                    readOnly
                                    onChange={() => {}}
                                    onNoteChange={() => {}}
                                  />
                                );
                              });
```

- [ ] **Step 4: Update countAbnormal() + validate() ของ Lab page**

ทำแบบเดียวกับ Task 8 Step 3–4 (ค้นหา `isFieldAbnormal(field,` และ `visibleFields(param` ใน `LabTestingDetailPage.tsx` แล้วแก้ให้วน `expandFieldForItem(field, item.commonName).forEach((unit) => ...)` ใช้ `unit.field` + `unit.key`). โครงโค้ดเหมือน Task 8 ทุกบรรทัด — เปลี่ยนเฉพาะชื่อ state ถ้าต่าง (ใช้ที่หน้านี้ประกาศไว้)

- [ ] **Step 5: Type-check + tests + lint**

Run: `npx tsc -p tsconfig.app.json` แล้ว `npx vitest run` แล้ว `npm run lint`
Expected: ไม่มี error ใหม่; เทสต์ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/pages/LabTestingDetailPage.tsx
git commit -m "feat(lab-testing): render + validate + count per-substance fields"
```

---

## Task 10: Manual verification + seed export

**Files:** ไม่มีการแก้โค้ด (verification เท่านั้น)

- [ ] **Step 1: รันแอป (frontend + backend)**

```bash
cd server && npm run dev    # terminal 1 (port 3001)
npm run dev                 # terminal 2 (port 8000)
```

- [ ] **Step 2: Config — สร้าง/แก้พารามิเตอร์**

1. เปิดหน้า **พารามิเตอร์การตรวจสอบ** → เพิ่ม value field ชนิด `number` (เช่น "ปริมาณสารสำคัญ" หน่วย `%`)
2. ติ๊ก **"แยกเงื่อนไขตามสาร"** → กด **ตั้งเงื่อนไขรายสาร**
3. ใน popup: เลือกสารจากแท็บ commonName / ค้นหาด้วยชื่อ / กดกลุ่ม; ตั้ง operator + ค่า ต่อสาร → บันทึก
4. ตรวจ preview ใต้ช่องสรุปสาร+เกณฑ์ถูกต้อง → บันทึกพารามิเตอร์

ยืนยัน: เปิดแก้ซ้ำ ค่าที่ตั้งไว้ยังอยู่ (roundtrip ผ่าน `updateParameter`)

- [ ] **Step 3: Test-time — บันทึกผล**

1. เปิด petition ที่มี item ซึ่ง commonName มีหลายสาร (`A + B`) เข้าหน้า **QC ทดสอบ** (และ **Lab ทดสอบ**)
2. ยืนยันช่องพารามิเตอร์นั้นแตกเป็น **หลายช่อง** "ชื่อช่อง — ชื่อสาร"
3. กรอกค่าที่ผิดเกณฑ์ของสารหนึ่ง → ขึ้นไอคอนเตือน/กรอบแดงเฉพาะสารนั้น; สารที่ไม่ตั้งเกณฑ์ → กรอกได้ ไม่เตือน
4. บันทึก แล้ว reload → ค่ารายสารยังอยู่ (composite key roundtrip)

- [ ] **Step 4: Full test + type-check**

```bash
npx vitest run
npx tsc -p tsconfig.app.json
npm run lint
```
Expected: เทสต์ผ่านหมด, ไม่มี type error ใหม่, lint สะอาด

- [ ] **Step 5: Seed export (ตาม memory seed-data backup)**

```bash
cd server && npm run seed:export
cd ..
git add server/seed-data
git commit -m "chore(seed): export after per-substance standards"
```

---

## Task 11: Backend abnormal-flags endpoint handles substanceMode

**Files:**
- Modify: `server/routes/qcResults.js` (the `/abnormal-flags` route, ~line 122-160, and helper area ~line 12-46)
- Test: manual (backend has no unit-test harness for routes here)

> Gap found in final review: the list/approval **abnormal indicator** comes from `GET /qc-results/abnormal-flags`, which loops `isFieldAbnormal(field, values[field.label])`. For substanceMode fields the values live under composite keys `label::substance`, so per-substance abnormalities never flag on the list pages. Mirror the frontend `countAbnormalInResults` substance branch in JS.

- [ ] **Step 1: Add JS substance helpers** near the existing `isFieldAbnormal` (server/routes/qcResults.js ~line 46):

```js
// mirror of src/lib/substances.ts matchSubstanceKey: first whitespace token, lowercased
function matchSubstanceKeyJS(name) {
  return String(name || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
}

// mirror of src/lib/parameterValidation.ts isSubstanceAbnormal: build a virtual field, reuse isNumericAbnormal
function isSubstanceAbnormalJS(field, std, value) {
  if (!std || !std.operator || std.value == null) return false;
  return isNumericAbnormal(
    { ...field, standardOperator: std.operator, standardValue: std.value, standardValue2: std.value2 ?? null },
    value,
  );
}
```

- [ ] **Step 2: Update the abnormal-flags inner loop** (replace the `for (const field of param.valueFields) { if (isFieldAbnormal(field, values[field.label])) {...} }` body):

```js
      for (const field of param.valueFields) {
        const isNumeric = field.type === "number" || field.type === "float";
        if (field.substanceMode && isNumeric) {
          const prefix = `${field.label}::`;
          let flagged = false;
          for (const [vkey, vval] of Object.entries(values)) {
            if (!vkey.startsWith(prefix)) continue;
            const subKey = vkey.slice(prefix.length);
            const std = (field.substanceStandards || []).find(
              (s) => matchSubstanceKeyJS(s.substance) === subKey,
            );
            if (isSubstanceAbnormalJS(field, std, vval)) { flagged = true; break; }
          }
          if (flagged) { map[d.petitionId] = true; break; }
          continue;
        }
        if (isFieldAbnormal(field, values[field.label])) {
          map[d.petitionId] = true;
          break;
        }
      }
```

- [ ] **Step 3:** Confirm the route still parses/loads (start `cd server && npm run dev` briefly or `node -e "require('./server/routes/qcResults.js')"` won't work standalone due to deps — instead verify with `node --check server/routes/qcResults.js`).

- [ ] **Step 4: Commit** `git add server/routes/qcResults.js && git commit -m "fix(qc-results): abnormal-flags endpoint counts per-substance values" -- server/routes/qcResults.js`

---

## Task 12: qcProgress counts substanceMode fields per substance

**Files:**
- Modify: `src/lib/qcProgress.ts` (`computePetitionProgress`, ~line 38-49)
- Test: `src/lib/qcProgress.test.ts` if it exists; else add a focused test

> Gap found in final review: `computePetitionProgress` does `total += 1` per field and `filledLabels?.has(f.label)`. For substanceMode the stored keys are composite, so the field is never counted as filled and the denominator is wrong (should be N substances). It has `petition.items`, so it can call `expandFieldForItem(field, item.commonName)`.

- [ ] **Step 1:** import `expandFieldForItem` from `@/lib/parameterValidation`.

- [ ] **Step 2:** replace the inner `for (const f of fields) { total += 1; if (filledLabels?.has(f.label)) filled += 1; }` with:

```ts
      for (const f of fields) {
        for (const unit of expandFieldForItem(f, item.commonName)) {
          total += 1;
          if (filledLabels?.has(unit.key)) filled += 1;
        }
      }
```

(`fields` is already filtered by `isCountableField`; substanceMode fields are number/float so all units are countable.)

- [ ] **Step 3:** if `src/lib/qcProgress.test.ts` exists, add a test: a petition item with commonName "A + B", a substanceMode field, entries.filledLabels=["label::a"] → total counts 2, filled 1. Run `npx vitest run src/lib/qcProgress.test.ts`.

- [ ] **Step 4:** `npx tsc -p tsconfig.app.json`, then commit `git add src/lib/qcProgress.ts (+ test) && git commit -m "fix(qc-progress): count substanceMode fields per substance"`.

---

## Notes / Out of scope (จาก spec)

- หน้า read-only / print template / report ยังไม่ render composite per-substance values — follow-up แยก
- `reference` field ชี้มาที่ช่อง substanceMode — ยังไม่รองรับ (ชี้ได้เฉพาะช่องปกติ)
- Known limitation: สารที่ `parseSubstances` ยุบรวม (`A + B`) จะ match ด้วย token แรกของก้อนที่ยุบ
