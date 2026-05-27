# ENUM Option Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม per-option filter ให้ enum field ใน Parameter Settings — แต่ละ option กำหนดได้ว่า "แสดงเฉพาะ item ที่..." ตาม `productType` (water/sand/powder) และ `subCategory` (เช่น ULV, EC) — Lab/QC Testing เรนเดอร์เฉพาะ option ที่ผ่าน filter; option ที่ไม่มี filter = แสดงทุก item (backward-compatible)

**Architecture:** เพิ่ม `optionFilters` (Map keyed by option string) ใน `ValueFieldSchema` ทั้งฝั่ง Mongoose และ TS type. Refactor `parameterAppliesToItem` ใน `petitionTestItems.ts` เพื่อ extract helpers `getItemProductType` / `getItemSubCategory` แล้วเขียน `visibleEnumOptions(field, item)` ใหม่. UI ใน ParameterSettings เพิ่ม popover ในก้อน option; Lab/QC pages ใช้ helper filter ตอน render `<Select>` และจัดการ "ค่าเดิมที่นอกเงื่อนไข" ใน select.

**Tech Stack:** Mongoose 8 (Map subdocument), React 18 + TS, shadcn `<Popover>` `<Checkbox>` `<Select>`, Vitest (unit), Sonner toast.

**Spec:** [docs/superpowers/specs/2026-05-27-enum-option-filter-design.md](../specs/2026-05-27-enum-option-filter-design.md)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `server/models/Parameter.js` | Schema: เพิ่ม `optionFilters` ใน `ValueFieldSchema`; validation: drop orphan keys + ตรวจ `productTypes` enum |
| `src/lib/api.ts` | TS type: ขยาย `ParameterValueField` ให้รับ `optionFilters` |
| `src/lib/petitionTestItems.ts` | Helpers: `getItemProductType`, `getItemSubCategory`, `visibleEnumOptions` (refactor extracted logic จาก `parameterAppliesToItem`) |
| `src/lib/petitionTestItems.test.ts` (สร้างใหม่) | Vitest unit tests สำหรับ helpers |
| `src/pages/ParameterSettings.tsx` | UI: ปุ่ม "เฉพาะ" + popover (productType checkboxes + subCategory chips) ในแต่ละ enum option; badge แสดง filter; cleanup ตอนลบ option |
| `src/pages/LabTestingDetailPage.tsx` | Pass `item` ลง `TestField`; เรียก `visibleEnumOptions` ตอน render enum; handle saved-but-filtered option |
| `src/pages/QCTestingDetailPage.tsx` | เหมือน Lab page |

> หมายเหตุ: `src/lib/qcProgress.ts` **ไม่ต้องแก้** — `computePetitionProgress` นับเฉพาะ field-level (label) ไม่ได้นับ per-option

---

## Task 1: Server schema + validation

**Files:**
- Modify: `server/models/Parameter.js:3-45` (`ValueFieldSchema`)
- Modify: `server/models/Parameter.js:65-154` (`ParameterSchema.pre('validate')`)

- [ ] **Step 1: เพิ่ม `optionFilters` ใน `ValueFieldSchema`**

แก้ `server/models/Parameter.js` — หลังบรรทัด `refPhase: { type: Number, enum: [1, 2, null], default: 1 },` (บรรทัด 44) เพิ่ม:

```js
  optionFilters: {
    type: Map,
    of: new mongoose.Schema({
      productTypes: { type: [String], default: [] },
      subCategories: { type: [String], default: [] },
    }, { _id: false }),
    default: undefined,
  },
```

- [ ] **Step 2: เพิ่ม validation rules ใน `pre('validate')` block**

ใน `for (const f of this.valueFields || []) { ... }` หลัง block `if (f.type === 'enum' && (!f.options || f.options.length === 0)) { ... }` (บรรทัด 70-72) เพิ่ม:

```js
    if (f.type === 'enum' && f.optionFilters) {
      const opts = new Set(f.options || []);
      const allowedPT = new Set(['water', 'sand', 'powder']);
      // Drop orphan keys (option ถูกลบไปแล้ว แต่ filter ยังค้างอยู่)
      for (const key of Array.from(f.optionFilters.keys())) {
        if (!opts.has(key)) f.optionFilters.delete(key);
      }
      // Validate productTypes values
      for (const [key, val] of f.optionFilters.entries()) {
        const pts = val?.productTypes || [];
        const invalid = pts.filter((p) => !allowedPT.has(p));
        if (invalid.length > 0) {
          return next(new Error(`optionFilters[${key}].productTypes มีค่าที่ไม่รองรับ: ${invalid.join(', ')} (รองรับเฉพาะ water/sand/powder) — ช่อง "${f.label}"`));
        }
        // Normalize subCategories to uppercase trimmed
        const scs = (val?.subCategories || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
        val.subCategories = scs;
      }
    }
```

- [ ] **Step 3: ทดสอบด้วย Node REPL ว่า schema parse ได้**

Run:
```bash
node -e "const m=require('./server/models/Parameter'); console.log(Object.keys(m.schema.path('valueFields').schema.paths));"
```
Expected: output มี `'optionFilters'` ปนอยู่ในรายการ

- [ ] **Step 4: Commit**

```bash
git add server/models/Parameter.js
git commit -m "feat(parameter): add optionFilters to ValueFieldSchema with validation"
```

---

## Task 2: Client TS type

**Files:**
- Modify: `src/lib/api.ts:263-287` (`ParameterValueField` type)

- [ ] **Step 1: ขยาย type**

แก้ `src/lib/api.ts` — หลังบรรทัด `refPhase?: 1 | 2 | null;` (ก่อน `};` ที่ปิด `ParameterValueField`) เพิ่ม:

```ts
  // Per-option filter: keyed by option string.
  // ถ้า key ไม่มี = option แสดงให้ทุก item (default)
  optionFilters?: Record<string, {
    productTypes?: string[];   // 'water' | 'sand' | 'powder'
    subCategories?: string[];  // เช่น 'ULV', 'EC' (uppercase)
  }>;
```

- [ ] **Step 2: ตรวจ type compile**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ใหม่จาก api.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): add optionFilters to ParameterValueField type"
```

---

## Task 3: Runtime helpers + unit tests (TDD)

**Files:**
- Create: `src/lib/petitionTestItems.test.ts`
- Modify: `src/lib/petitionTestItems.ts:1-60` (extract helpers + เพิ่ม `visibleEnumOptions`)

- [ ] **Step 1: เขียน failing tests ก่อน**

สร้างไฟล์ `src/lib/petitionTestItems.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getItemProductType,
  getItemSubCategory,
  visibleEnumOptions,
} from './petitionTestItems';
import type { ParameterValueField } from './api';
import type { PetitionItem } from '@/types/petition.types';

const makeItem = (overrides: Partial<PetitionItem> = {}): PetitionItem => ({
  seq: 1,
  sampleId: 'EW-001',
  sampleName: 'Imidacloprid 10% EW',
  commonName: 'EW',
  ...overrides,
} as PetitionItem);

const makeEnumField = (overrides: Partial<ParameterValueField> = {}): ParameterValueField => ({
  label: 'สภาพ',
  type: 'enum',
  options: ['ของเหลวใส', 'ของเหลวขุ่น', 'ผงละเอียด'],
  ...overrides,
});

describe('getItemProductType', () => {
  it('returns water for EW sample', () => {
    expect(getItemProductType(makeItem({ commonName: 'EW' }))).toBe('water');
  });

  it('returns powder for WP sample', () => {
    expect(getItemProductType(makeItem({ commonName: 'WP', sampleName: 'Foo 80% WP' }))).toBe('powder');
  });

  it('returns empty string when no classification found', () => {
    expect(getItemProductType(makeItem({ commonName: '', sampleName: 'unknown stuff' }))).toBe('');
  });
});

describe('getItemSubCategory', () => {
  it('extracts prefix before first dash from sampleId', () => {
    expect(getItemSubCategory(makeItem({ sampleId: 'ULV-001' }))).toBe('ULV');
  });

  it('returns uppercased sampleId when no dash', () => {
    expect(getItemSubCategory(makeItem({ sampleId: 'ec' }))).toBe('EC');
  });

  it('returns empty string when sampleId missing', () => {
    expect(getItemSubCategory(makeItem({ sampleId: undefined }))).toBe('');
  });
});

describe('visibleEnumOptions', () => {
  it('returns all options when field.optionFilters is undefined (backward-compatible)', () => {
    const field = makeEnumField();
    const item = makeItem();
    expect(visibleEnumOptions(field, item)).toEqual(['ของเหลวใส', 'ของเหลวขุ่น', 'ผงละเอียด']);
  });

  it('returns all options when optionFilters has no entry for an option', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { productTypes: ['water'] } },
    });
    const item = makeItem({ commonName: 'WP', sampleName: 'Foo WP' });
    // 'ของเหลวใส' has filter (water), item is powder → hide
    // others have no filter → show
    expect(visibleEnumOptions(field, item)).toEqual(['ของเหลวขุ่น', 'ผงละเอียด']);
  });

  it('shows option when productType matches', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { productTypes: ['water'] } },
    });
    const item = makeItem({ commonName: 'EW' });
    expect(visibleEnumOptions(field, item)).toContain('ของเหลวใส');
  });

  it('hides option when productType does not match', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { productTypes: ['water'] } },
    });
    const item = makeItem({ commonName: 'WP', sampleName: 'Foo WP' });
    expect(visibleEnumOptions(field, item)).not.toContain('ของเหลวใส');
  });

  it('uses OR within productTypes (any match)', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { productTypes: ['water', 'sand'] } },
    });
    expect(visibleEnumOptions(field, makeItem({ commonName: 'EW' }))).toContain('ของเหลวใส');
    expect(visibleEnumOptions(field, makeItem({ commonName: 'GR', sampleName: 'Foo GR' }))).toContain('ของเหลวใส');
    expect(visibleEnumOptions(field, makeItem({ commonName: 'WP', sampleName: 'Foo WP' }))).not.toContain('ของเหลวใส');
  });

  it('uses AND between productTypes and subCategories dimensions', () => {
    const field = makeEnumField({
      optionFilters: {
        'ของเหลวใส': { productTypes: ['water'], subCategories: ['ULV'] },
      },
    });
    // water + ULV → show
    expect(visibleEnumOptions(field, makeItem({ commonName: 'EW', sampleId: 'ULV-001' }))).toContain('ของเหลวใส');
    // water + non-ULV → hide
    expect(visibleEnumOptions(field, makeItem({ commonName: 'EW', sampleId: 'EW-001' }))).not.toContain('ของเหลวใส');
    // non-water + ULV → hide
    expect(visibleEnumOptions(field, makeItem({ commonName: 'WP', sampleName: 'Foo WP', sampleId: 'ULV-001' }))).not.toContain('ของเหลวใส');
  });

  it('treats empty productTypes/subCategories arrays as "no constraint on that dimension"', () => {
    const field = makeEnumField({
      optionFilters: {
        'ของเหลวใส': { productTypes: [], subCategories: ['ULV'] },
      },
    });
    expect(visibleEnumOptions(field, makeItem({ commonName: 'WP', sampleName: 'Foo WP', sampleId: 'ULV-001' }))).toContain('ของเหลวใส');
  });
});
```

- [ ] **Step 2: รัน test ดูว่า fail ตามคาด**

Run: `npx vitest run src/lib/petitionTestItems.test.ts`
Expected: FAIL ทุก test ด้วยข้อความประมาณ `does not provide an export named 'getItemProductType'`

- [ ] **Step 3: Refactor `petitionTestItems.ts` — extract helpers + เพิ่ม `visibleEnumOptions`**

แก้ `src/lib/petitionTestItems.ts` แทนที่ทั้งไฟล์ด้วย:

```ts
import type { ParameterItem, ParameterValueField } from '@/lib/api';
import type { PetitionItem, Petition } from '@/types/petition.types';
import { getClassification, getCommonName } from '@/lib/productClassification';

function extractItemNoPrefix(itemNo: string | undefined | null): string {
  const cleaned = String(itemNo ?? '').trim();
  if (!cleaned) return '';
  const dashIdx = cleaned.indexOf('-');
  return (dashIdx > 0 ? cleaned.slice(0, dashIdx) : cleaned).toUpperCase();
}

export function getItemProductType(item: PetitionItem): string {
  return (
    getClassification(item.sampleName)?.group ??
    getClassification(item.commonName)?.group ??
    ''
  );
}

export function getItemSubCategory(item: PetitionItem): string {
  return extractItemNoPrefix(item.sampleId);
}

// Returns true when the parameter's "ใช้กับ" criteria fit this petition item.
// applyAll → match unconditionally. Otherwise it's an OR across the four
// dimensions we can derive from a PetitionItem (itemName / commonName /
// productType / subCategory). Categories (RM/FG) aren't carried on the item
// so we can't enforce them from the petition side — use subCategories instead.
export function parameterAppliesToItem(
  param: ParameterItem,
  item: PetitionItem,
): boolean {
  if (param.applyAll) return true;

  const itemNames = param.itemNames ?? [];
  const commonNames = param.commonNames ?? [];
  const productTypes = param.productTypes ?? [];
  const subCategories = param.subCategories ?? [];

  if (
    itemNames.length === 0 &&
    commonNames.length === 0 &&
    productTypes.length === 0 &&
    subCategories.length === 0
  ) {
    return false;
  }

  const sampleName = item.sampleName?.trim() ?? '';
  if (sampleName && itemNames.some((n) => n.trim() === sampleName)) return true;

  const itemCommonName = (
    item.commonName?.trim() || getCommonName(item.sampleName)
  ).toUpperCase();
  if (
    itemCommonName &&
    commonNames.some((c) => c.toUpperCase() === itemCommonName)
  ) {
    return true;
  }

  const productType = getItemProductType(item);
  if (productType && productTypes.includes(productType)) return true;

  const subCat = getItemSubCategory(item);
  if (subCat && subCategories.includes(subCat)) return true;

  return false;
}

export function matchParametersForItem(
  item: PetitionItem,
  params: ParameterItem[],
): ParameterItem[] {
  const active = params.filter((p) => p.status !== 'inactive');

  if (!item.testItems) {
    return active.filter((p) => parameterAppliesToItem(p, item));
  }

  const names = item.testItems
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return active.filter(
    (p) =>
      names.includes((p.name ?? '').toLowerCase()) &&
      parameterAppliesToItem(p, item),
  );
}

export function parameterNamesForPetition(
  petition: Petition,
  params: ParameterItem[],
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of petition.items ?? []) {
    for (const p of matchParametersForItem(item, params)) {
      const name = p.name?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }
  return names;
}

// Filter enum options based on item's productType/subCategory.
// AND ระหว่างมิติ productTypes/subCategories, OR ภายในแต่ละ list.
// option ที่ไม่มี entry ใน optionFilters = แสดงเสมอ (backward-compatible).
export function visibleEnumOptions(
  field: ParameterValueField,
  item: PetitionItem,
): string[] {
  const options = field.options ?? [];
  const filters = field.optionFilters;
  if (!filters) return options;

  const itemProductType = getItemProductType(item);
  const itemSubCat = getItemSubCategory(item);

  return options.filter((opt) => {
    const f = filters[opt];
    if (!f) return true;
    const pts = f.productTypes ?? [];
    const scs = f.subCategories ?? [];
    const ptOK = pts.length === 0 || (!!itemProductType && pts.includes(itemProductType));
    const scOK = scs.length === 0 || (!!itemSubCat && scs.includes(itemSubCat));
    return ptOK && scOK;
  });
}
```

- [ ] **Step 4: รัน test ใหม่ ดูว่า pass**

Run: `npx vitest run src/lib/petitionTestItems.test.ts`
Expected: PASS ครบทุก test (7 + 3 + 3 = 13 assertions, 9 it-blocks)

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTestItems.ts src/lib/petitionTestItems.test.ts
git commit -m "feat(petitionTestItems): add visibleEnumOptions + extract classification helpers"
```

---

## Task 4: ParameterSettings UI — popover (set/clear filter)

**Files:**
- Modify: `src/pages/ParameterSettings.tsx` — ในส่วน enum options ของ `ValueFieldEditor` (รอบ ๆ `addOption`/`removeOption`, line ~727-761) และส่วน render รายการ option

- [ ] **Step 1: Import `Filter` icon และ extend `removeOption` handler ให้ cleanup `optionFilters`**

หา `removeOption` (`src/pages/ParameterSettings.tsx:738-745`) แทนที่ด้วย:

```ts
  const removeOption = (opt: string) => {
    const nextFilters = { ...(field.optionFilters ?? {}) };
    delete nextFilters[opt];
    onChange({
      ...field,
      options: (field.options ?? []).filter((o) => o !== opt),
      requireNoteOn: (field.requireNoteOn ?? []).filter((o) => o !== opt),
      expectedValues: (field.expectedValues ?? []).filter((o) => o !== opt),
      optionFilters: Object.keys(nextFilters).length > 0 ? nextFilters : undefined,
    });
  };
```

หา import block ที่บรรทัด ~3-23 และเพิ่ม `Filter` ใน lucide imports (alphabetical สลับกับ `Hash`):

```ts
  Filter,
```

- [ ] **Step 2: เพิ่ม handler `setOptionFilter` และ `clearOptionFilter`**

ใต้ `toggleExpected` (~line 755-761) เพิ่ม:

```ts
  const setOptionFilter = (
    opt: string,
    next: { productTypes?: string[]; subCategories?: string[] },
  ) => {
    const current = field.optionFilters ?? {};
    const hasAny = (next.productTypes?.length ?? 0) > 0 || (next.subCategories?.length ?? 0) > 0;
    let nextFilters: Record<string, { productTypes?: string[]; subCategories?: string[] }>;
    if (!hasAny) {
      nextFilters = { ...current };
      delete nextFilters[opt];
    } else {
      nextFilters = { ...current, [opt]: next };
    }
    onChange({
      ...field,
      optionFilters: Object.keys(nextFilters).length > 0 ? nextFilters : undefined,
    });
  };
```

- [ ] **Step 3: เพิ่ม Popover (ปุ่ม "เฉพาะ") + badge ในแต่ละ option row**

อ้างอิงไฟล์ `src/pages/ParameterSettings.tsx` ที่ **line 1092-1125** — block ที่ render แต่ละ option row (เริ่มที่ `<div key={opt} ...>` ลงท้ายที่ `</div>` ปิด row). แทนที่ทั้ง block ด้วย:

```tsx
                    return (
                      <div
                        key={opt}
                        className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1 text-xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{opt}</span>
                          {(() => {
                            const f = field.optionFilters?.[opt];
                            if (!f) return null;
                            const pts = f.productTypes ?? [];
                            const scs = f.subCategories ?? [];
                            if (pts.length === 0 && scs.length === 0) return null;
                            const ptLabel = pts.map((p) => productTypeLabels[p] ?? p).join(', ');
                            const scLabel = scs.join(', ');
                            const parts = [ptLabel, scLabel].filter(Boolean).join(' · ');
                            return (
                              <Badge variant="secondary" className="gap-1 text-[10px] bg-emerald-50 text-emerald-700">
                                <Filter className="h-2.5 w-2.5" />
                                {parts}
                              </Badge>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex cursor-pointer items-center gap-1 text-emerald-700">
                            <Checkbox
                              checked={isExpected}
                              onCheckedChange={() => toggleExpected(opt)}
                              className="h-3.5 w-3.5"
                            />
                            ปกติ
                          </label>
                          <label className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                            <Checkbox
                              checked={needsNote}
                              onCheckedChange={() => toggleRequireNote(opt)}
                              className="h-3.5 w-3.5"
                            />
                            ต้องการคำอธิบาย
                          </label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "rounded p-0.5 hover:bg-emerald-50",
                                  (field.optionFilters?.[opt]?.productTypes?.length ?? 0) +
                                    (field.optionFilters?.[opt]?.subCategories?.length ?? 0) > 0
                                    ? "text-emerald-600"
                                    : "text-grey-400",
                                )}
                                title="แสดงเฉพาะ item ที่..."
                              >
                                <Filter className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-3 space-y-3" align="end">
                              <div className="text-xs font-semibold text-grey-700">แสดงเฉพาะ item ที่...</div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-grey-600">ประเภทสินค้า</Label>
                                <div className="flex flex-wrap gap-3">
                                  {(['water', 'sand', 'powder'] as const).map((pt) => {
                                    const current = field.optionFilters?.[opt]?.productTypes ?? [];
                                    const checked = current.includes(pt);
                                    return (
                                      <label key={pt} className="flex items-center gap-1.5 text-sm">
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(v) => {
                                            const nextPT = v
                                              ? Array.from(new Set([...current, pt]))
                                              : current.filter((x) => x !== pt);
                                            setOptionFilter(opt, {
                                              productTypes: nextPT,
                                              subCategories: field.optionFilters?.[opt]?.subCategories ?? [],
                                            });
                                          }}
                                        />
                                        <span>{productTypeLabels[pt] ?? pt}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                              <SubCategoryChips
                                values={field.optionFilters?.[opt]?.subCategories ?? []}
                                onChange={(scs) =>
                                  setOptionFilter(opt, {
                                    productTypes: field.optionFilters?.[opt]?.productTypes ?? [],
                                    subCategories: scs,
                                  })
                                }
                              />
                              <div className="flex justify-end pt-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => setOptionFilter(opt, { productTypes: [], subCategories: [] })}
                                >
                                  เคลียร์
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <button
                            type="button"
                            onClick={() => removeOption(opt)}
                            className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                            title="ลบตัวเลือก"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
```

> `productTypeLabels`, `Popover`, `PopoverTrigger`, `PopoverContent`, `Badge`, `Label`, `cn` ต้อง imported อยู่แล้วในไฟล์นี้ (ตรวจ — ถ้าขาดให้เพิ่ม)

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn(
        "h-7 w-7",
        (field.optionFilters?.[opt]?.productTypes?.length ?? 0) +
          (field.optionFilters?.[opt]?.subCategories?.length ?? 0) > 0
          ? "text-emerald-600"
          : "text-grey-400",
      )}
      title="แสดงเฉพาะ item ที่..."
    >
      <Filter className="h-3.5 w-3.5" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-72 p-3 space-y-3" align="end">
    <div className="text-xs font-semibold text-grey-700">แสดงเฉพาะ item ที่...</div>

    <div className="space-y-1.5">
      <Label className="text-xs text-grey-600">ประเภทสินค้า</Label>
      <div className="flex flex-wrap gap-3">
        {(['water', 'sand', 'powder'] as const).map((pt) => {
          const current = field.optionFilters?.[opt]?.productTypes ?? [];
          const checked = current.includes(pt);
          return (
            <label key={pt} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => {
                  const nextPT = v
                    ? Array.from(new Set([...current, pt]))
                    : current.filter((x) => x !== pt);
                  setOptionFilter(opt, {
                    productTypes: nextPT,
                    subCategories: field.optionFilters?.[opt]?.subCategories ?? [],
                  });
                }}
              />
              <span>{productTypeLabels[pt] ?? pt}</span>
            </label>
          );
        })}
      </div>
    </div>

    <SubCategoryChips
      values={field.optionFilters?.[opt]?.subCategories ?? []}
      onChange={(scs) =>
        setOptionFilter(opt, {
          productTypes: field.optionFilters?.[opt]?.productTypes ?? [],
          subCategories: scs,
        })
      }
    />

    <div className="flex justify-end pt-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => setOptionFilter(opt, { productTypes: [], subCategories: [] })}
      >
        เคลียร์
      </Button>
    </div>
  </PopoverContent>
</Popover>
```

> `productTypeLabels` import มาจาก `@/lib/productClassification` (มี import อยู่แล้วในไฟล์)

- [ ] **Step 4: สร้าง `SubCategoryChips` component (ภายในไฟล์เดียวกัน, ใต้ `ValueFieldEditor` หรือก่อน)**

```tsx
function SubCategoryChips({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().toUpperCase();
    if (!v) return;
    if (values.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...values, v]);
    setDraft('');
  };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-grey-600">หมวดย่อย (subCategory)</Label>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="เช่น ULV"
          className="h-7 text-sm uppercase"
        />
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={add}>
          เพิ่ม
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 text-xs">
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                className="text-grey-500 hover:text-red-500"
                aria-label={`ลบ ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: ตรวจ type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameter-settings): add per-option filter popover (productType + subCategory)"
```

---

## Task 5: ตรวจ ParameterSettings UI ใน dev server (manual)

**Files:** (ไม่แก้)

- [ ] **Step 1: เปิด dev server**

Run: `npm run dev` (ถ้ายังไม่รัน — แต่ระวังกฎ memory: ห้าม `npm run build` เพราะ postbuild จะ rewrite index.html ของ dev)

- [ ] **Step 2: Visual smoke test**

เปิด `http://localhost:8000/LIS/parameter-settings` → สร้าง / แก้ parameter ที่มี enum field → ทดสอบ:
- คลิกปุ่ม Filter (icon) ใน option row → popover เปิด พบ checkbox "น้ำ/ทราย/ผง" + ช่อง subCategory
- ติ๊ก "น้ำ" → ปิด popover → badge `[Filter icon] น้ำ` ขึ้นข้างชื่อ option
- พิมพ์ "ULV" + Enter ใน chip input → chip ขึ้น และ badge อัปเดตเป็น `น้ำ · ULV`
- คลิก "เคลียร์" → badge หาย ปุ่ม Filter icon เปลี่ยนเป็นสีเทา
- ลบ option ที่มี filter ออก → ตรวจว่า save แล้ว GET parameter (Network tab) ไม่มี key ของ option นั้นใน `optionFilters`

ถ้า fail step ไหน — debug + แก้ก่อนไปต่อ

---

## Task 6: LabTestingDetailPage — apply filter ตอน render

**Files:**
- Modify: `src/pages/LabTestingDetailPage.tsx:88-238` (`TestFieldProps` + `TestField`)
- Modify: `src/pages/LabTestingDetailPage.tsx` — call sites ของ `<TestField>` (line ~753 และ ~818)

- [ ] **Step 1: เพิ่ม `item` prop ใน `TestFieldProps`**

แก้ interface ที่ line 88-98:

```ts
interface TestFieldProps {
  field: ParameterValueField;
  item: PetitionItem;  // <-- ใหม่
  value: unknown;
  noteValue: unknown;
  saveInfo?: FieldSaveInfo;
  noteSaveInfo?: FieldSaveInfo;
  onChange: (val: unknown) => void;
  onNoteChange: (val: unknown) => void;
  disabled?: boolean;
  readOnly?: boolean;
}
```

`PetitionItem` import มีอยู่แล้ว (ที่ line 29 — `type PetitionItem`) — ไม่ต้องเพิ่ม

- [ ] **Step 2: รับ `item` ใน function destructure + extend helper import**

แก้บรรทัด 100-110:

```ts
function TestField({
  field,
  item,
  value,
  noteValue,
  saveInfo,
  noteSaveInfo,
  onChange,
  onNoteChange,
  disabled = false,
  readOnly = false,
}: TestFieldProps) {
```

แก้ import ที่ line 25 จาก:
```ts
import { matchParametersForItem } from '@/lib/petitionTestItems';
```
เป็น:
```ts
import { matchParametersForItem, visibleEnumOptions } from '@/lib/petitionTestItems';
```

- [ ] **Step 3: ใช้ `visibleEnumOptions` ใน select**

หา block enum render (line ~151-172) แทน `field.options?.map(...)` ด้วย:

```tsx
        <Select
          value={strVal || '__none__'}
          onValueChange={(v) => !readOnly && onChange(v === '__none__' ? '' : v)}
          disabled={effectivelyDisabled}
        >
          <SelectTrigger
            className={cn(
              'h-8 text-sm',
              isAbnormal && 'border-red-400 ring-1 ring-red-200',
              readOnly && 'bg-grey-50 cursor-default',
            )}
          >
            <SelectValue placeholder="เลือกค่า..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— เลือก —</SelectItem>
            {(() => {
              const visible = visibleEnumOptions(field, item);
              const savedOutOfScope = strVal && !visible.includes(strVal);
              return (
                <>
                  {visible.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                  {savedOutOfScope && (
                    <SelectItem key="__saved__" value={strVal} disabled>
                      {strVal} (นอกเงื่อนไข — ค่าเดิม)
                    </SelectItem>
                  )}
                </>
              );
            })()}
          </SelectContent>
        </Select>
```

- [ ] **Step 4: ส่ง `item` ที่ call sites**

หา 2 จุดเรียก `<TestField>` (line ~753 และ ~818). ทั้ง 2 จุดอยู่ในวงรอบที่มี variable `item` (PetitionItem) อยู่แล้ว — เพิ่ม prop `item={item}`:

```tsx
<TestField
  field={field}
  item={item}        // <-- ใหม่
  value={phaseValues[k]?.[field.label] ?? ''}
  // ...
/>
```

ทำเหมือนกันทั้ง 2 จุด

- [ ] **Step 5: ตรวจ type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/pages/LabTestingDetailPage.tsx
git commit -m "feat(lab-testing): filter enum options per item classification"
```

---

## Task 7: QCTestingDetailPage — apply filter ตอน render

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx:72-95` (`TestFieldProps` + `TestField`)
- Modify: `src/pages/QCTestingDetailPage.tsx` — call site ของ `<TestField>` (line ~716)

- [ ] **Step 1: เพิ่ม `item` prop ใน `TestFieldProps`**

แก้ interface (line 72-81):

```ts
interface TestFieldProps {
  field: ParameterValueField;
  item: PetitionItem;  // <-- ใหม่
  value: unknown;
  noteValue: unknown;
  saveInfo?: FieldSaveInfo;
  noteSaveInfo?: FieldSaveInfo;
  onChange: (val: unknown) => void;
  onNoteChange: (val: unknown) => void;
  disabled?: boolean;
}
```

`PetitionItem` import มีอยู่แล้ว (ที่ line 19 — `type PetitionItem`) — ไม่ต้องเพิ่ม

แก้ import ที่ line 15 จาก:
```ts
import { matchParametersForItem } from '@/lib/petitionTestItems';
```
เป็น:
```ts
import { matchParametersForItem, visibleEnumOptions } from '@/lib/petitionTestItems';
```

- [ ] **Step 2: รับ `item` ใน function destructure**

แก้ line 83-92:

```ts
function TestField({
  field,
  item,
  value,
  noteValue,
  saveInfo,
  noteSaveInfo,
  onChange,
  onNoteChange,
  disabled = false,
}: TestFieldProps) {
```

- [ ] **Step 3: ใช้ `visibleEnumOptions` ใน select**

หา block enum render (line ~134-150) แทน `field.options?.map(...)` ด้วย:

```tsx
        <Select
          value={strVal || '__none__'}
          onValueChange={(v) => onChange(v === '__none__' ? '' : v)}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn(
              'h-8 text-sm',
              isAbnormal && 'border-red-400 ring-1 ring-red-200',
            )}
          >
            <SelectValue placeholder="เลือกค่า..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— เลือก —</SelectItem>
            {(() => {
              const visible = visibleEnumOptions(field, item);
              const savedOutOfScope = strVal && !visible.includes(strVal);
              return (
                <>
                  {visible.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                  {savedOutOfScope && (
                    <SelectItem key="__saved__" value={strVal} disabled>
                      {strVal} (นอกเงื่อนไข — ค่าเดิม)
                    </SelectItem>
                  )}
                </>
              );
            })()}
          </SelectContent>
        </Select>
```

> หมายเหตุ: เทียบ JSX กับ Lab page ให้แน่ใจว่าได้ class/prop ตรงกับของเดิมในไฟล์นี้ (QC page ไม่มี `readOnly`, ใช้ `disabled` อย่างเดียว)

- [ ] **Step 4: ส่ง `item` ที่ call site**

หาจุดเรียก `<TestField>` (line ~716) เพิ่ม prop `item={item}`:

```tsx
<TestField
  field={field}
  item={item}        // <-- ใหม่
  value={phaseValues[k]?.[field.label] ?? ''}
  // ...
/>
```

- [ ] **Step 5: ตรวจ type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-testing): filter enum options per item classification"
```

---

## Task 8: End-to-end manual verification

**Files:** (ไม่แก้)

- [ ] **Step 1: รัน dev server (ถ้ายังไม่รัน)**

Run: `npm run dev`

- [ ] **Step 2: รัน unit tests ครั้งสุดท้าย**

Run: `npm run test`
Expected: PASS ทุก suite (รวมถึง `petitionTestItems.test.ts` ที่เพิ่งเขียน + parameterValidation tests ที่มีอยู่แล้ว ไม่ regress)

- [ ] **Step 3: สร้าง / แก้ parameter "กายภาพ" เพื่อทดสอบ**

1. เปิด `http://localhost:8000/LIS/parameter-settings`
2. ค้น / สร้าง parameter ชื่อ "กายภาพ" (scope=qc, applyAll=true เพื่อให้เข้าทุก item)
3. เพิ่ม enum field ชื่อ "สภาพ" มี option:
   - `ของเหลวใส` → คลิก Filter → ติ๊ก "น้ำ" → ปิด popover (ตรวจว่า badge "น้ำ" ขึ้นใต้ชื่อ)
   - `ของเหลวขุ่น` → filter "น้ำ" เช่นกัน
   - `ผงละเอียด` → filter "ผง"
   - `ไม่ระบุ` → ไม่ตั้ง filter (เพื่อ control case)
4. Save parameter

- [ ] **Step 4: ทดสอบใน Lab Testing**

1. เปิด petition ที่มี item เป็น EW (water) — `/LIS/lab-testing/<id>`
2. ดูใน enum select ของ "สภาพ" ต้องเห็น: `ของเหลวใส`, `ของเหลวขุ่น`, `ไม่ระบุ` (ไม่มี `ผงละเอียด`)
3. เปิด petition ที่มี item เป็น WP (powder)
4. ต้องเห็น: `ผงละเอียด`, `ไม่ระบุ` (ไม่มี `ของเหลว*`)

- [ ] **Step 5: ทดสอบ saved-but-filtered (edge case)**

1. ที่ item EW → เลือก `ของเหลวใส` → save (เห็น "บันทึกแล้ว")
2. กลับไปแก้ parameter → ลบ option `ของเหลวใส` ออก หรือเปลี่ยน filter เป็น "ผง" → save
3. กลับมาที่ Lab Testing item EW เดิม → ตรวจว่า select แสดง "ของเหลวใส (นอกเงื่อนไข — ค่าเดิม)" และ disabled ไม่ให้เลือกซ้ำ

- [ ] **Step 6: ทดสอบ orphan key cleanup (server validation)**

1. เปิด Network tab → ดู PUT request ตอน save parameter ที่เพิ่งลบ option
2. ดู response → `optionFilters` ต้องไม่มี key ของ option ที่ลบไปแล้ว (cleanup ทำงาน)

- [ ] **Step 7: บันทึกผลทดสอบ**

ถ้าทุกอย่าง pass — ทักแจ้ง user; ถ้า fail — list สิ่งที่ fail พร้อม screenshot/console error และวน fix
