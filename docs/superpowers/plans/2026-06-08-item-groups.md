# Item Groups (กลุ่ม Item จัดเอง) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ใช้สร้าง "กลุ่ม item จัดเอง" (rule จาก commonname/trade name + เพิ่ม/ตัด item รายตัว) ในหน้า Master Item แล้วนำกลุ่มไปเป็นเงื่อนไข "ใช้กับ" ของ Parameter และ optionFilters ของช่อง enum โดยอ้างแบบ live (group ID).

**Architecture:** collection ใหม่ `ItemGroup` (soft-delete) + route `/item-groups`. Parameter เพิ่ม field `itemGroups: string[]` (param-level + ในแต่ละ optionFilter). การจับคู่ resolve membership จาก catalog ของ master items เป็น `Map<itemNo, groupId[]>` (เพราะ PetitionItem ไม่มี trade name) แล้วส่ง `itemGroupIds` เข้า matcher ทุก call site. UI: ปุ่ม "จัดกลุ่ม" ในหน้า Master Item เปิด dialog จัดการ + picker ใน ParameterSettings.

**Tech Stack:** Express 4 + Mongoose 8 (soft-delete plugin), React 18 + TS + TanStack Query, Vitest. แนว pattern ตามไฟล์เดิม (`commonNameOverrides.js`, `MultiSelectPopover`, `softDeletePlugin`).

**สำคัญ — gotchas ของ repo:**
- type-check จริงต้องใช้ `npx tsc -p tsconfig.app.json --noEmit` (root `tsc --noEmit` เป็น no-op)
- test: `npm run test` (Vitest, run once)
- commit เฉพาะไฟล์ตัวเองด้วย explicit pathspec (รีโปนี้มี committer อื่นแทรกบางครั้ง)
- **ห้าม** `npm run build` ระหว่าง dev
- route ต้อง `mountApi()` ใน `server/index.js` (mount คู่ `/api` + `/LIS/api`)
- api wrapper: `api.get<T>(path)` คืน `{ data: { data: T } }` — route คืน array ตรงๆ ได้ (เหมือน `commonNameOverrides.js`)

---

## File Structure

**สร้างใหม่:**
- `server/models/ItemGroup.js` — Mongoose model
- `server/routes/itemGroups.js` — CRUD route
- `src/lib/itemGroups.ts` — `resolveItemGroups` + `buildItemGroupIndex` (pure)
- `src/lib/itemGroups.test.ts` — unit tests
- `src/lib/masterItemFields.ts` — readers สำหรับ itemNo/commonname/trade name จาก raw master item
- `src/hooks/useItemGroupMembership.ts` — hook คืน `Map<itemNo, groupId[]>`
- `src/components/lis/ItemGroupManagerDialog.tsx` — dialog จัดการกลุ่ม

**แก้ไข:**
- `server/index.js` — `mountApi('/item-groups', ...)`
- `server/models/Parameter.js` — เพิ่ม `itemGroups` (param-level + optionFilters sub-schema)
- `src/lib/api.ts` — type `ItemGroupItem`, `ParameterItem.itemGroups`, optionFilters `.itemGroups`
- `src/lib/petitionTestItems.ts` — เพิ่ม arg `itemGroupIds` ใน 3 ฟังก์ชัน
- `src/lib/petitionTestItems.test.ts` — เพิ่ม test
- `src/lib/qcProgress.ts` — `computePetitionProgress` รับ membership
- call sites: `LabTestingPage.tsx`, `LabTestingDetailPage.tsx`, `QCTestingDetailPage.tsx`, `PetitionListPage.tsx`, `components/petition/PetitionView.tsx`
- `src/pages/MasterItems.tsx` — `getParametersFor` + trade name + detail dialog chips + ปุ่ม "จัดกลุ่ม"
- `src/pages/ParameterSettings.tsx` — picker "กลุ่ม Item" (param-level + optionFilters)

---

## Phase A — Backend

### Task A1: ItemGroup model

**Files:**
- Create: `server/models/ItemGroup.js`

- [ ] **Step 1: เขียน model** (ตาม pattern `server/models/CommonNameOverride.js`)

```js
const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const ItemGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  commonNames: { type: [String], default: [] },
  tradeNames: { type: [String], default: [] },
  includeItemNos: { type: [String], default: [] },
  excludeItemNos: { type: [String], default: [] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

// unique ชื่อกลุ่มในกลุ่มที่ยังไม่ถูกลบ (compound กับ deletedAt — soft-delete pattern)
ItemGroupSchema.index({ name: 1, deletedAt: 1 }, { unique: true });

ItemGroupSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('ItemGroup', ItemGroupSchema);
```

- [ ] **Step 2: ยืนยัน soft-delete plugin มี `softDelete`/`softDeleteMany`**

Run: `node -e "const m=require('./server/models/ItemGroup'); console.log(typeof m.softDeleteMany, typeof m.prototype.softDelete)"`
Expected: พิมพ์ `function function` (ถ้า MongoDB ไม่ออนไลน์ก็ไม่เป็นไร — แค่ต้อง require ผ่านไม่ error). ถ้า error เรื่อง connection ให้ข้าม โดยดูแค่ว่า require ตัว module ไม่ throw syntax error.

- [ ] **Step 3: Commit**

```bash
git add server/models/ItemGroup.js
git commit -m "feat(item-groups): add ItemGroup model"
```

---

### Task A2: itemGroups route + mount

**Files:**
- Create: `server/routes/itemGroups.js`
- Modify: `server/index.js` (เพิ่ม mountApi หลังบรรทัด `mountApi('/common-name-overrides', ...)`)

- [ ] **Step 1: เขียน route** (pattern ตาม `server/routes/commonNameOverrides.js` + `parameters.js`)

```js
const express = require('express');
const ItemGroup = require('../models/ItemGroup');

const router = express.Router();

function toStrArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((s) => String(s).trim()).filter(Boolean);
}

function toDTO(doc) {
  return {
    _id: String(doc._id),
    name: doc.name,
    description: doc.description || '',
    commonNames: doc.commonNames || [],
    tradeNames: doc.tradeNames || [],
    includeItemNos: doc.includeItemNos || [],
    excludeItemNos: doc.excludeItemNos || [],
    status: doc.status || 'active',
    sortOrder: doc.sortOrder || 0,
  };
}

function sanitize(body) {
  return {
    name: String((body && body.name) || '').trim(),
    description: String((body && body.description) || '').trim(),
    commonNames: toStrArray(body && body.commonNames),
    tradeNames: toStrArray(body && body.tradeNames),
    includeItemNos: toStrArray(body && body.includeItemNos),
    excludeItemNos: toStrArray(body && body.excludeItemNos),
    status: (body && body.status) === 'inactive' ? 'inactive' : 'active',
    sortOrder: Number((body && body.sortOrder) || 0),
  };
}

router.get('/', async (_req, res) => {
  try {
    const docs = await ItemGroup.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json(docs.map(toDTO));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (!data.name) return res.status(400).json({ message: 'name required' });
    const doc = await ItemGroup.create(data);
    res.status(201).json(toDTO(doc.toObject()));
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'ชื่อกลุ่มนี้มีอยู่แล้ว' });
    }
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (!data.name) return res.status(400).json({ message: 'name required' });
    const doc = await ItemGroup.findByIdAndUpdate(req.params.id, data, {
      new: true, runValidators: true,
    }).lean();
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(toDTO(doc));
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'ชื่อกลุ่มนี้มีอยู่แล้ว' });
    }
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await ItemGroup.softDeleteMany({ _id: req.params.id }, actor);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: mount route** ใน `server/index.js` — เพิ่มบรรทัดถัดจาก `mountApi('/common-name-overrides', require('./routes/commonNameOverrides'));`

```js
mountApi('/item-groups', require('./routes/itemGroups'));
```

- [ ] **Step 3: ยืนยัน server boot ไม่พัง** (ถ้า Mongo รันอยู่)

Run: `cd server && node -e "require('./routes/itemGroups'); console.log('ok')"`
Expected: พิมพ์ `ok` (require ผ่าน ไม่มี syntax error)

- [ ] **Step 4: Commit**

```bash
git add server/routes/itemGroups.js server/index.js
git commit -m "feat(item-groups): add /item-groups CRUD route"
```

---

### Task A3: Parameter model — เพิ่ม itemGroups

**Files:**
- Modify: `server/models/Parameter.js`

- [ ] **Step 1: เพิ่ม `itemGroups` ใน `ValueFieldSchema.optionFilters` sub-schema**

ในนิยาม `optionFilters` (รอบ `new mongoose.Schema({ itemNames, commonNames, productTypes, categories, subCategories })`) เพิ่มบรรทัด:

```js
      itemGroups: { type: [String], default: [] },
```

ให้ block เป็น:

```js
  optionFilters: {
    type: Map,
    of: new mongoose.Schema({
      itemNames: { type: [String], default: [] },
      commonNames: { type: [String], default: [] },
      productTypes: { type: [String], default: [] },
      categories: { type: [String], default: [] },
      subCategories: { type: [String], default: [] },
      itemGroups: { type: [String], default: [] },
    }, { _id: false }),
    default: undefined,
  },
```

- [ ] **Step 2: เพิ่ม `itemGroups` ใน `ParameterSchema` (param-level)**

ถัดจาก `subCategories: { type: [String], default: [] },` เพิ่ม:

```js
  itemGroups: { type: [String], default: [] },
```

- [ ] **Step 3: ยืนยัน require ผ่าน**

Run: `node -e "require('./server/models/Parameter'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add server/models/Parameter.js
git commit -m "feat(item-groups): add itemGroups field to Parameter (param-level + optionFilters)"
```

---

## Phase B — Shared lib + types

### Task B1: api.ts types

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: เพิ่ม `itemGroups` ใน optionFilters type** (ใน `ParameterValueField`, block `optionFilters?: Record<string, {...}>`)

ถัดจาก `subCategories?: string[];` ภายใน object นั้น เพิ่ม:

```ts
    itemGroups?: string[];     // group ID ที่ option นี้จำกัดให้แสดง
```

- [ ] **Step 2: เพิ่ม `itemGroups` ใน `ParameterItem`** — ถัดจาก `subCategories?: string[];`

```ts
  itemGroups?: string[];
```

- [ ] **Step 3: เพิ่ม type `ItemGroupItem`** ใกล้ๆ `ParameterItem` (หลัง `export type ParameterItem = {...}`)

```ts
export type ItemGroupItem = {
  _id: string;
  name: string;
  description?: string;
  commonNames: string[];
  tradeNames: string[];
  includeItemNos: string[];
  excludeItemNos: string[];
  status: "active" | "inactive";
  sortOrder?: number;
};
```

- [ ] **Step 4: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก `api.ts` (อาจมี latent error ~12 ตัวเดิมของ repo — ตรวจว่าไม่มีตัวใหม่ที่ชี้ `api.ts`)

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(item-groups): add ItemGroupItem type + Parameter.itemGroups types"
```

---

### Task B2: src/lib/itemGroups.ts + tests (TDD)

**Files:**
- Create: `src/lib/itemGroups.test.ts`
- Create: `src/lib/itemGroups.ts`

- [ ] **Step 1: เขียน failing test**

`src/lib/itemGroups.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveItemGroups, buildItemGroupIndex } from './itemGroups';
import type { ItemGroupItem } from './api';

const g = (over: Partial<ItemGroupItem>): ItemGroupItem => ({
  _id: 'g1', name: 'G', description: '',
  commonNames: [], tradeNames: [], includeItemNos: [], excludeItemNos: [],
  status: 'active', sortOrder: 0, ...over,
});

describe('resolveItemGroups', () => {
  it('matches by commonName (case-insensitive)', () => {
    const groups = [g({ _id: 'a', commonNames: ['EW'] })];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'ew', tradeName: '' }, groups);
    expect(ids).toEqual(['a']);
  });

  it('matches by tradeName when commonName does not match', () => {
    const groups = [g({ _id: 'b', tradeNames: ['SUPERKILL'] })];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'WP', tradeName: 'SuperKill' }, groups);
    expect(ids).toEqual(['b']);
  });

  it('includeItemNos adds an item that rule would not match', () => {
    const groups = [g({ _id: 'c', commonNames: ['EW'], includeItemNos: ['X-9'] })];
    const ids = resolveItemGroups({ itemNo: 'X-9', commonName: 'WP', tradeName: '' }, groups);
    expect(ids).toEqual(['c']);
  });

  it('excludeItemNos wins over rule + include', () => {
    const groups = [g({ _id: 'd', commonNames: ['EW'], includeItemNos: ['X-1'], excludeItemNos: ['X-1'] })];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'EW', tradeName: '' }, groups);
    expect(ids).toEqual([]);
  });

  it('ignores inactive groups', () => {
    const groups = [g({ _id: 'e', commonNames: ['EW'], status: 'inactive' })];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'EW', tradeName: '' }, groups);
    expect(ids).toEqual([]);
  });

  it('returns every matching group id', () => {
    const groups = [
      g({ _id: 'a', commonNames: ['EW'] }),
      g({ _id: 'b', tradeNames: ['T1'] }),
    ];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'EW', tradeName: 'T1' }, groups);
    expect(ids.sort()).toEqual(['a', 'b']);
  });
});

describe('buildItemGroupIndex', () => {
  it('maps itemNo -> group ids over the catalog', () => {
    const groups = [g({ _id: 'a', commonNames: ['EW'] })];
    const items = [
      { itemNo: 'X-1', commonName: 'EW', tradeName: '' },
      { itemNo: 'X-2', commonName: 'WP', tradeName: '' },
    ];
    const idx = buildItemGroupIndex(items, groups);
    expect(idx.get('X-1')).toEqual(['a']);
    expect(idx.get('X-2')).toEqual([]);
  });
});
```

- [ ] **Step 2: run — verify fail**

Run: `npm run test -- src/lib/itemGroups.test.ts`
Expected: FAIL (`Cannot find module './itemGroups'`)

- [ ] **Step 3: เขียน implementation**

`src/lib/itemGroups.ts`:

```ts
import type { ItemGroupItem } from './api';

function norm(v: string | undefined | null): string {
  return String(v ?? '').trim().toUpperCase();
}

// itemNo ของ master item อาจมีช่องว่าง — เทียบแบบ trim ตรงตัว (ไม่ uppercase
// เพราะ itemNo เป็นรหัสที่ case มีความหมาย แต่ trim กันพลาด)
function normItemNo(v: string | undefined | null): string {
  return String(v ?? '').trim();
}

// item หนึ่งตัว → คืน group ID ที่สังกัด (เฉพาะ group ที่ status === 'active').
// กติกา: exclude ชนะทุกอย่าง > include > rule(commonName OR tradeName).
export function resolveItemGroups(
  args: { itemNo: string; commonName: string; tradeName: string },
  groups: ItemGroupItem[],
): string[] {
  const itemNo = normItemNo(args.itemNo);
  const cn = norm(args.commonName);
  const tn = norm(args.tradeName);
  const out: string[] = [];
  for (const grp of groups) {
    if (grp.status !== 'active') continue;
    const excluded = (grp.excludeItemNos ?? []).some((x) => normItemNo(x) === itemNo);
    if (itemNo && excluded) continue;
    const included = itemNo && (grp.includeItemNos ?? []).some((x) => normItemNo(x) === itemNo);
    const byCommon = cn && (grp.commonNames ?? []).some((c) => norm(c) === cn);
    const byTrade = tn && (grp.tradeNames ?? []).some((t) => norm(t) === tn);
    if (included || byCommon || byTrade) out.push(grp._id);
  }
  return out;
}

// สร้าง index จาก catalog ของ master items → Map<itemNo, groupId[]>.
// ใช้ทั้งฝั่งหน้า Master Item และฝั่ง testing เพื่อให้ membership ตรงกัน.
export function buildItemGroupIndex(
  items: Array<{ itemNo: string; commonName: string; tradeName: string }>,
  groups: ItemGroupItem[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const it of items) {
    const key = normItemNo(it.itemNo);
    if (!key) continue;
    map.set(key, resolveItemGroups(it, groups));
  }
  return map;
}
```

- [ ] **Step 4: run — verify pass**

Run: `npm run test -- src/lib/itemGroups.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/itemGroups.ts src/lib/itemGroups.test.ts
git commit -m "feat(item-groups): add resolveItemGroups + buildItemGroupIndex with tests"
```

---

### Task B3: src/lib/masterItemFields.ts (readers)

**Files:**
- Create: `src/lib/masterItemFields.ts`

หมายเหตุ: `MasterItems.tsx` มี key arrays ของตัวเองอยู่แล้ว (`codeKeys`, `commonNameKeys`). ที่นี่ทำสำเนา canonical สำหรับ hook + เพิ่ม `tradeNameKeys` (trade name ที่ปัจจุบันถูกซ่อน). ค่า key เหล่านี้ต้องตรงกับใน `MasterItems.tsx`.

- [ ] **Step 1: เขียน module**

```ts
// Readers สำหรับ raw master item (จาก ERP/n8n webhook — โครงสร้าง key ไม่นิ่ง).
// key list ต้องสอดคล้องกับ MasterItems.tsx (codeKeys / commonNameKeys).
export const itemNoKeys = ['item_no', 'itemCode', 'item_code', 'code', 'Code', 'ITEM_CODE'];
export const commonNameKeys = ['common_name', 'commonname', 'commonName', 'item_name2', 'itemType'];
export const tradeNameKeys = ['trade_name', 'tradename', 'tradeName'];

type RawItem = Record<string, unknown>;

export function firstValue(item: RawItem, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return '';
}

export function getItemNo(item: RawItem): string {
  return firstValue(item, itemNoKeys).trim();
}

export function getRawCommonName(item: RawItem): string {
  return firstValue(item, commonNameKeys).trim();
}

export function getTradeName(item: RawItem): string {
  return firstValue(item, tradeNameKeys).trim();
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/lib/masterItemFields.ts
git commit -m "feat(item-groups): add masterItemFields readers (incl. tradeName)"
```

---

## Phase C — Matchers

### Task C1: petitionTestItems.ts — เพิ่ม itemGroupIds (TDD)

**Files:**
- Modify: `src/lib/petitionTestItems.ts`
- Modify: `src/lib/petitionTestItems.test.ts`

- [ ] **Step 1: เขียน failing test** — เพิ่มท้าย `petitionTestItems.test.ts`

```ts
describe('item-group matching', () => {
  it('matchParametersForItem matches a group-only param when itemGroupIds include it', () => {
    const param = makeParam({ applyAll: false, itemGroups: ['gA'], scope: 'qc' });
    const item = makeItem({ commonName: 'ZZ', sampleName: 'No match' });
    // ไม่ส่ง itemGroupIds → ไม่ match
    expect(matchParametersForItem(item, [param])).toHaveLength(0);
    // ส่ง itemGroupIds ที่ตรง → match
    expect(matchParametersForItem(item, [param], ['gA'])).toHaveLength(1);
  });

  it('visibleEnumOptions shows an option gated by itemGroups when membership matches', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { itemGroups: ['gA'] } },
    });
    const item = makeItem({ commonName: 'ZZ', sampleName: 'No match' });
    expect(visibleEnumOptions(field, item)).not.toContain('ของเหลวใส');
    expect(visibleEnumOptions(field, item, ['gA'])).toContain('ของเหลวใส');
  });
});
```

- [ ] **Step 2: run — verify fail**

Run: `npm run test -- src/lib/petitionTestItems.test.ts`
Expected: FAIL (argument ตัวที่ 3 ยังไม่มี / option ยังไม่ถูกแสดง)

- [ ] **Step 3: แก้ `parameterAppliesToItem`** — เพิ่ม param ตัวที่ 3 + เงื่อนไข group

```ts
export function parameterAppliesToItem(
  param: ParameterItem,
  item: PetitionItem,
  itemGroupIds: string[] = [],
): boolean {
  if (param.applyAll) return true;

  const itemNames = param.itemNames ?? [];
  const commonNames = param.commonNames ?? [];
  const productTypes = param.productTypes ?? [];
  const subCategories = param.subCategories ?? [];
  const itemGroups = param.itemGroups ?? [];

  if (
    itemNames.length === 0 &&
    commonNames.length === 0 &&
    productTypes.length === 0 &&
    subCategories.length === 0 &&
    itemGroups.length === 0
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

  if (itemGroups.length > 0 && itemGroups.some((g) => itemGroupIds.includes(g))) return true;

  return false;
}
```

- [ ] **Step 4: แก้ `matchParametersForItem`** — รับ + ส่งต่อ itemGroupIds

```ts
export function matchParametersForItem(
  item: PetitionItem,
  params: ParameterItem[],
  itemGroupIds: string[] = [],
): ParameterItem[] {
  const itemIsLab = item.batchNo ? isLabBatch(item.batchNo) : false;
  const active = params.filter(
    (p) =>
      p.status !== 'inactive' &&
      ((p.scope ?? 'qc') !== 'lab' || itemIsLab),
  );

  if (!item.testItems) {
    return active.filter((p) => parameterAppliesToItem(p, item, itemGroupIds));
  }

  const names = item.testItems
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return active.filter(
    (p) =>
      names.includes((p.name ?? '').toLowerCase()) &&
      parameterAppliesToItem(p, item, itemGroupIds),
  );
}
```

- [ ] **Step 5: แก้ `visibleEnumOptions`** — รับ itemGroupIds + เช็คใน filter

ปรับ signature และ logic ภายใน `options.filter`:

```ts
export function visibleEnumOptions(
  field: ParameterValueField,
  item: PetitionItem,
  itemGroupIds: string[] = [],
): string[] {
  const options = field.options ?? [];
  const filters = field.optionFilters;
  if (!filters) return options;

  const sampleName = item.sampleName?.trim() ?? '';
  const itemCommonName = (
    item.commonName?.trim() || getCommonName(item.sampleName)
  ).toUpperCase();
  const itemProductType = getItemProductType(item);
  const itemSubCat = getItemSubCategory(item);

  return options.filter((opt) => {
    const f = filters[opt];
    if (!f) return true;
    const itemNames = f.itemNames ?? [];
    const commonNames = f.commonNames ?? [];
    const productTypes = f.productTypes ?? [];
    const subCategories = f.subCategories ?? [];
    const itemGroups = f.itemGroups ?? [];
    if (
      itemNames.length === 0 &&
      commonNames.length === 0 &&
      productTypes.length === 0 &&
      subCategories.length === 0 &&
      itemGroups.length === 0
    ) {
      return true;
    }
    if (sampleName && itemNames.some((n) => n.trim() === sampleName)) return true;
    if (
      itemCommonName &&
      commonNames.some((c) => c.toUpperCase() === itemCommonName)
    ) {
      return true;
    }
    if (itemProductType && productTypes.includes(itemProductType)) return true;
    if (itemSubCat && subCategories.includes(itemSubCat)) return true;
    if (itemGroups.length > 0 && itemGroups.some((gid) => itemGroupIds.includes(gid))) return true;
    return false;
  });
}
```

- [ ] **Step 6: run — verify pass (ทั้งไฟล์ ต้องไม่มี regression)**

Run: `npm run test -- src/lib/petitionTestItems.test.ts`
Expected: PASS ทุก test (เดิม + 2 ใหม่)

- [ ] **Step 7: Commit**

```bash
git add src/lib/petitionTestItems.ts src/lib/petitionTestItems.test.ts
git commit -m "feat(item-groups): thread itemGroupIds through parameter matchers"
```

---

### Task C2: qcProgress.ts — รับ membership

**Files:**
- Modify: `src/lib/qcProgress.ts`

- [ ] **Step 1: แก้ `computePetitionProgress`** ให้รับ `membership` (optional) แล้วส่งเข้า matcher

เพิ่ม param ท้าย signature และใช้ใน loop:

```ts
export function computePetitionProgress(
  petition: Petition,
  parameters: ParameterItem[],
  entries: QCProgressEntry[] | undefined,
  membership?: Map<string, string[]>,
): PetitionProgress {
  // ...เดิม...
  for (const item of petition.items ?? []) {
    const ids = membership?.get(String(item.sampleId ?? '').trim()) ?? [];
    const matched = matchParametersForItem(item, parameters, ids);
    // ...เดิม...
  }
  // ...เดิม...
}
```

- [ ] **Step 2: type-check + test (ของเดิมต้องไม่พัง — membership optional)**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Run: `npm run test -- src/lib/qcProgress`
Expected: ไม่มี error ใหม่; test ผ่าน (ถ้ามีไฟล์ test)

- [ ] **Step 3: Commit**

```bash
git add src/lib/qcProgress.ts
git commit -m "feat(item-groups): accept membership in computePetitionProgress"
```

---

## Phase D — Wire call sites

### Task D1: useItemGroupMembership hook

**Files:**
- Create: `src/hooks/useItemGroupMembership.ts`

- [ ] **Step 1: เขียน hook**

โหลด master-items + item-groups (React Query — keys ที่ใช้ซ้ำของเดิม `["master-items"]`, ใหม่ `["item-groups"]`), build index ด้วย `buildItemGroupIndex`. ใช้ commonname **ดิบ** (ไม่ผ่าน override) เพื่อความง่ายและสอดคล้องกับ matcher ฝั่ง testing ที่เทียบ commonName ตรงๆ.

```ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ItemGroupItem } from '@/lib/api';
import { buildItemGroupIndex } from '@/lib/itemGroups';
import { getItemNo, getRawCommonName, getTradeName } from '@/lib/masterItemFields';

type RawItem = Record<string, unknown>;

function normalizeItems(payload: unknown): RawItem[] {
  if (Array.isArray(payload)) return payload as RawItem[];
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const found = [p.data, p.items, p.result, p.rows].find(Array.isArray);
    if (Array.isArray(found)) return found as RawItem[];
  }
  return [];
}

// คืน Map<itemNo, groupId[]> สำหรับส่งเข้า parameter matcher.
export function useItemGroupMembership(): Map<string, string[]> {
  const { data: items = [] } = useQuery({
    queryKey: ['master-items'],
    queryFn: async () => {
      const res = await api.get<unknown>('/master-items');
      return normalizeItems(res.data.data);
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['item-groups'],
    queryFn: async () => {
      const res = await api.get<ItemGroupItem[]>('/item-groups');
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  return useMemo(() => {
    const catalog = items.map((it) => ({
      itemNo: getItemNo(it),
      commonName: getRawCommonName(it),
      tradeName: getTradeName(it),
    }));
    return buildItemGroupIndex(catalog, groups);
  }, [items, groups]);
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useItemGroupMembership.ts
git commit -m "feat(item-groups): add useItemGroupMembership hook"
```

---

### Task D2: wire LabTestingDetailPage + QCTestingDetailPage

**Files:**
- Modify: `src/pages/LabTestingDetailPage.tsx`
- Modify: `src/pages/QCTestingDetailPage.tsx`

หลักการ: เรียก `const membership = useItemGroupMembership();` ในตัว component แล้วทุกครั้งที่เรียก `matchParametersForItem(item, params)` / `visibleEnumOptions(field, item)` ให้เพิ่ม arg `membership.get(String(item.sampleId ?? '').trim()) ?? []`.

- [ ] **Step 1: LabTestingDetailPage — import + เรียก hook**

เพิ่ม import:
```ts
import { useItemGroupMembership } from '@/hooks/useItemGroupMembership';
```
ในตัว component (ใกล้ๆ ที่ดึง `allParameters`) เพิ่ม:
```ts
  const groupMembership = useItemGroupMembership();
  const idsFor = (it: { sampleId?: string }) =>
    groupMembership.get(String(it?.sampleId ?? '').trim()) ?? [];
```

- [ ] **Step 2: LabTestingDetailPage — ส่ง ids เข้าทุก call**

แทนที่ทุกจุด (บรรทัดอ้างอิง ~174, 453, 459, 497, 527, 649, 659, 702):
- `matchParametersForItem(item, allParameters)` → `matchParametersForItem(item, allParameters, idsFor(item))`
- `matchParametersForItem(it, allParameters)` → `matchParametersForItem(it, allParameters, idsFor(it))`
- `visibleEnumOptions(field, item)` → `visibleEnumOptions(field, item, idsFor(item))`

(ใช้ Grep หาให้ครบทุกจุดในไฟล์: `matchParametersForItem(` และ `visibleEnumOptions(`)

- [ ] **Step 3: QCTestingDetailPage — ทำแบบเดียวกัน** (import hook, `groupMembership`, `idsFor`, แล้วแก้ทุก call ~157, 515, 549, 575, 779)

- [ ] **Step 4: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 5: Commit**

```bash
git add src/pages/LabTestingDetailPage.tsx src/pages/QCTestingDetailPage.tsx
git commit -m "feat(item-groups): wire group membership into Lab/QC testing detail pages"
```

---

### Task D3: wire list/overview call sites

**Files:**
- Modify: `src/pages/LabTestingPage.tsx`
- Modify: `src/pages/PetitionListPage.tsx`
- Modify: `src/components/petition/PetitionView.tsx`

- [ ] **Step 1: LabTestingPage** — import hook, เรียก `const membership = useItemGroupMembership();` แล้วจุดที่ใช้ (บรรทัด ~37 ใน predicate):
  - `matchParametersForItem(it, params)` → `matchParametersForItem(it, params, membership.get(String(it.sampleId ?? '').trim()) ?? [])`
  - หมายเหตุ: ถ้า predicate เป็น top-level const นอก component ให้ย้าย/ห่อให้เข้าถึง `membership` ได้ (เช่นย้าย filter เข้าไปใน component body ที่เรียก hook ได้)

- [ ] **Step 2: PetitionListPage** — เช่นเดียวกัน (บรรทัด ~54): ส่ง ids จาก `membership.get(String(item.sampleId ?? '').trim()) ?? []`

- [ ] **Step 3: PetitionView** — เช่นเดียวกัน (บรรทัด ~99) ภายใน component ที่ map items

- [ ] **Step 4: type-check + test รวม**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Run: `npm run test`
Expected: ไม่มี error ใหม่; test ทั้งหมดผ่าน

- [ ] **Step 5: Commit**

```bash
git add src/pages/LabTestingPage.tsx src/pages/PetitionListPage.tsx src/components/petition/PetitionView.tsx
git commit -m "feat(item-groups): wire group membership into testing/petition list views"
```

---

## Phase E — Master Item UI

### Task E1: getParametersFor + trade name + detail dialog chips

**Files:**
- Modify: `src/pages/MasterItems.tsx`

- [ ] **Step 1: import group helpers + trade name reader** (ด้านบนไฟล์)

```ts
import { resolveItemGroups } from "@/lib/itemGroups";
import type { ItemGroupItem } from "@/lib/api";
import { tradeNameKeys } from "@/lib/masterItemFields";
```

- [ ] **Step 2: เพิ่ม reader trade name** ใกล้ `getItemNameForParam` / `getItemCategory`

```ts
function getItemTradeName(item: MasterItem): string {
  return String(firstValue(item, tradeNameKeys)).trim();
}
```

- [ ] **Step 3: ปรับ `getParametersFor` ให้รับ `groups` + เพิ่มเงื่อนไข group**

```ts
function getParametersFor(
  item: MasterItem,
  parameters: ParameterItem[],
  groups: ItemGroupItem[] = [],
): ParameterItem[] {
  if (parameters.length === 0) return [];
  const itemName = getItemNameForParam(item);
  const productType = getProductTypeGroup(item);
  const category = getItemCategory(item);
  const commonName = getCommonName(firstValue(item, commonNameKeys))
    || getCommonName(firstValue(item, nameKeys));
  const groupIds = resolveItemGroups(
    {
      itemNo: String(firstValue(item, codeKeys)).trim(),
      commonName: String(firstValue(item, commonNameKeys)).trim(),
      tradeName: getItemTradeName(item),
    },
    groups,
  );

  return parameters.filter((parameter) => {
    if ((parameter.status ?? "active") !== "active") return false;
    if (parameter.applyAll) return true;
    if (itemName && parameter.itemNames?.includes(itemName)) return true;
    if (productType && parameter.productTypes?.includes(productType)) return true;
    if (category && parameter.categories?.includes(category)) return true;
    if (commonName && parameter.commonNames?.includes(commonName)) return true;
    if (groupIds.length > 0 && (parameter.itemGroups ?? []).some((g) => groupIds.includes(g))) return true;
    return false;
  });
}

function countParametersFor(item: MasterItem, parameters: ParameterItem[], groups: ItemGroupItem[] = []): number {
  return getParametersFor(item, parameters, groups).length;
}
```

- [ ] **Step 4: โหลด groups ในหน้า + ส่งต่อ** — ใน `MasterItems()` component เพิ่ม query

```ts
  const { data: itemGroups = [] } = useQuery({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const res = await api.get<ItemGroupItem[]>("/item-groups");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });
```

แล้วแก้ทุกจุดที่เรียก `getParametersFor(item, parameters)` / `countParametersFor(...)` ในไฟล์ ให้ส่ง `itemGroups` เป็น arg ที่ 3 (Grep หา `getParametersFor(` และ `countParametersFor(` ในไฟล์ — รวม `getParametersFor(editing.item, parameters)` และ `getParametersFor(viewing.item, parameters)`).

- [ ] **Step 5: detail dialog — โชว์ chip กลุ่ม** ใน `MasterItemDetailDialog` (บรรทัด ~1818). เพิ่ม prop `groups` แล้วคำนวณ + render

แก้ signature ของ `MasterItemDetailDialog` ให้รับ `groups: ItemGroupItem[]` และที่เรียก (`<MasterItemDetailDialog ... groups={itemGroups} />`). ภายใน dialog เพิ่ม:

```tsx
  const memberGroups = groups.filter((grp) =>
    resolveItemGroups(
      {
        itemNo: String(firstValue(item, codeKeys)).trim(),
        commonName: String(firstValue(item, commonNameKeys)).trim(),
        tradeName: getItemTradeName(item),
      },
      [grp],
    ).length > 0,
  );
```

แล้ววางบล็อกแสดงผล (ใกล้ส่วนแสดง parameter ของ dialog):

```tsx
  {memberGroups.length > 0 && (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">กลุ่มที่สังกัด</div>
      <div className="flex flex-wrap gap-1">
        {memberGroups.map((grp) => (
          <Badge key={grp._id} variant="secondary">{grp.name}</Badge>
        ))}
      </div>
    </div>
  )}
```

- [ ] **Step 6: type-check + test**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Run: `npm run test`
Expected: ไม่มี error ใหม่; test ผ่าน

- [ ] **Step 7: Commit**

```bash
git add src/pages/MasterItems.tsx
git commit -m "feat(item-groups): match params by group + show group chips in item detail"
```

---

### Task E2: ItemGroupManagerDialog + ปุ่ม "จัดกลุ่ม"

**Files:**
- Create: `src/components/lis/ItemGroupManagerDialog.tsx`
- Modify: `src/pages/MasterItems.tsx` (ปุ่มเปิด dialog ใน PageHeader actions)

- [ ] **Step 1: เขียน `ItemGroupManagerDialog.tsx`**

dialog 2 ฝั่ง: ซ้าย=รายชื่อกลุ่ม (+ จำนวนสมาชิก resolve ได้) + ปุ่มกลุ่มใหม่/ลบ; ขวา=ฟอร์มแก้กลุ่มที่เลือก (ชื่อ/คำอธิบาย/status, multi-select commonname + trade name, ช่องเพิ่ม/ตัด itemNo, preview). โหลด distinct commonname/tradeName/itemNo จาก master items.

```tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api, type ItemGroupItem } from "@/lib/api";
import { resolveItemGroups } from "@/lib/itemGroups";
import { getItemNo, getRawCommonName, getTradeName } from "@/lib/masterItemFields";

type RawItem = Record<string, unknown>;
type Draft = {
  _id?: string;
  name: string;
  description: string;
  commonNames: string[];
  tradeNames: string[];
  includeItemNos: string[];
  excludeItemNos: string[];
  status: "active" | "inactive";
};

const emptyDraft: Draft = {
  name: "", description: "", commonNames: [], tradeNames: [],
  includeItemNos: [], excludeItemNos: [], status: "active",
};

// chip multi-select แบบง่าย: เลือกจาก options + ลบทีละตัว
function ChipMultiSelect({
  label, values, options, onChange, placeholder,
}: {
  label: string; values: string[]; options: string[];
  onChange: (next: string[]) => void; placeholder: string;
}) {
  const available = options.filter((o) => !values.includes(o));
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {values.length === 0 && <span className="text-xs text-muted-foreground">— ยังไม่เลือก —</span>}
      </div>
      <Select value="" onValueChange={(v) => v && onChange([...values, v])}>
        <SelectTrigger className="h-8"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {available.length === 0
            ? <div className="px-2 py-1.5 text-xs text-muted-foreground">ครบแล้ว</div>
            : available.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ItemGroupManagerDialog({
  open, onOpenChange, items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: RawItem[];
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const { data: groups = [] } = useQuery({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const res = await api.get<ItemGroupItem[]>("/item-groups");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  // distinct options จาก catalog
  const catalog = useMemo(
    () => items.map((it) => ({
      itemNo: getItemNo(it),
      commonName: getRawCommonName(it),
      tradeName: getTradeName(it),
    })),
    [items],
  );
  const commonNameOptions = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.commonName).filter(Boolean))).sort(),
    [catalog],
  );
  const tradeNameOptions = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.tradeName).filter(Boolean))).sort(),
    [catalog],
  );
  const itemNoOptions = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.itemNo).filter(Boolean))).sort(),
    [catalog],
  );

  // preview: itemNo ที่เข้ากลุ่มตาม draft
  const previewMembers = useMemo(() => {
    const draftGroup: ItemGroupItem = {
      _id: draft._id ?? "__draft__", name: draft.name || "draft",
      description: draft.description, commonNames: draft.commonNames,
      tradeNames: draft.tradeNames, includeItemNos: draft.includeItemNos,
      excludeItemNos: draft.excludeItemNos, status: "active", sortOrder: 0,
    };
    return catalog.filter((c) => resolveItemGroups(c, [draftGroup]).length > 0);
  }, [catalog, draft]);

  const memberCountFor = (grp: ItemGroupItem) =>
    catalog.filter((c) => resolveItemGroups(c, [grp]).length > 0).length;

  const selectGroup = (grp: ItemGroupItem) => {
    setSelectedId(grp._id);
    setDraft({
      _id: grp._id, name: grp.name, description: grp.description ?? "",
      commonNames: grp.commonNames ?? [], tradeNames: grp.tradeNames ?? [],
      includeItemNos: grp.includeItemNos ?? [], excludeItemNos: grp.excludeItemNos ?? [],
      status: grp.status ?? "active",
    });
  };

  const newGroup = () => { setSelectedId(null); setDraft(emptyDraft); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name.trim(), description: draft.description,
        commonNames: draft.commonNames, tradeNames: draft.tradeNames,
        includeItemNos: draft.includeItemNos, excludeItemNos: draft.excludeItemNos,
        status: draft.status,
      };
      if (draft._id) return api.put(`/item-groups/${draft._id}`, body);
      return api.post("/item-groups", body);
    },
    onSuccess: () => {
      toast.success("บันทึกกลุ่มแล้ว");
      queryClient.invalidateQueries({ queryKey: ["item-groups"] });
      newGroup();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/item-groups/${id}`),
    onSuccess: () => {
      toast.success("ลบกลุ่มแล้ว");
      queryClient.invalidateQueries({ queryKey: ["item-groups"] });
      newGroup();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>จัดกลุ่ม Item</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
          {/* ซ้าย: รายชื่อกลุ่ม */}
          <div className="space-y-2 border-r pr-3">
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={newGroup}>
              <Plus className="h-4 w-4" /> กลุ่มใหม่
            </Button>
            <div className="max-h-[50vh] space-y-1 overflow-auto">
              {groups.map((grp) => (
                <button
                  key={grp._id}
                  type="button"
                  onClick={() => selectGroup(grp)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    selectedId === grp._id ? "bg-accent" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{grp.name}</span>
                  <Badge variant="outline" className="ml-1">{memberCountFor(grp)}</Badge>
                </button>
              ))}
              {groups.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">ยังไม่มีกลุ่ม</div>
              )}
            </div>
          </div>

          {/* ขวา: ฟอร์ม */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">ชื่อกลุ่ม</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">สถานะ</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="inactive">inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">คำอธิบาย</Label>
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ChipMultiSelect label="commonname" placeholder="เลือก commonname"
                values={draft.commonNames} options={commonNameOptions}
                onChange={(v) => setDraft({ ...draft, commonNames: v })} />
              <ChipMultiSelect label="trade name" placeholder="เลือก trade name"
                values={draft.tradeNames} options={tradeNameOptions}
                onChange={(v) => setDraft({ ...draft, tradeNames: v })} />
              <ChipMultiSelect label="เพิ่ม item (itemNo)" placeholder="เลือก item"
                values={draft.includeItemNos} options={itemNoOptions}
                onChange={(v) => setDraft({ ...draft, includeItemNos: v })} />
              <ChipMultiSelect label="ตัด item ออก (itemNo)" placeholder="เลือก item"
                values={draft.excludeItemNos} options={itemNoOptions}
                onChange={(v) => setDraft({ ...draft, excludeItemNos: v })} />
            </div>

            <div className="rounded border bg-muted/30 p-2">
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>สมาชิกที่เข้ากลุ่มจริง (live)</span>
                <Badge variant="secondary">{previewMembers.length}</Badge>
              </div>
              <div className="max-h-28 overflow-auto text-xs">
                {previewMembers.slice(0, 100).map((m) => (
                  <span key={m.itemNo} className="mr-1 inline-block">{m.itemNo}</span>
                ))}
                {previewMembers.length === 0 && <span className="text-muted-foreground">— ยังไม่มี —</span>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              {draft._id ? (
                <Button variant="ghost" className="gap-1 text-destructive"
                  onClick={() => draft._id && deleteMutation.mutate(draft._id)}>
                  <Trash2 className="h-4 w-4" /> ลบกลุ่ม
                </Button>
              ) : <span />}
              <Button disabled={!draft.name.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: เพิ่มปุ่ม "จัดกลุ่ม" ในหน้า Master Item**

ใน `MasterItems.tsx`:
- import: `import ItemGroupManagerDialog from "@/components/lis/ItemGroupManagerDialog";`
- state: `const [groupDialogOpen, setGroupDialogOpen] = useState(false);`
- ใน `PageHeader` เพิ่ม actions (ถ้า PageHeader รองรับ prop actions/children — ตรวจ pattern ในไฟล์; ถ้าไม่ ให้วางปุ่มไว้เหนือ Card แรกในแถวเดียวกับ filters) ปุ่ม:

```tsx
  <Button variant="outline" className="gap-1" onClick={() => setGroupDialogOpen(true)}>
    <Database className="h-4 w-4" /> จัดกลุ่ม
  </Button>
```

- วาง dialog ก่อน `</AppLayout>`:

```tsx
  <ItemGroupManagerDialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen} items={items} />
```

- [ ] **Step 3: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 4: ตรวจด้วยตา (manual)** — รัน frontend + backend, เปิดหน้า Master Item, กด "จัดกลุ่ม", สร้างกลุ่มชื่อทดสอบ เลือก commonname 1 ตัว ดู preview ขึ้นจำนวนสมาชิก, กดบันทึก, รีเฟรช เห็นกลุ่มในรายการ

Run (สอง terminal): `npm run dev` และ `cd server && npm run dev`

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/ItemGroupManagerDialog.tsx src/pages/MasterItems.tsx
git commit -m "feat(item-groups): add group manager dialog + button on Master Item page"
```

---

## Phase F — ParameterSettings pickers

### Task F1: param-level "กลุ่ม Item" picker

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: โหลดรายการกลุ่ม + เตรียม options** ในหน้า ParameterSettings (ใกล้ที่โหลด parameters/master items)

```ts
import { api, type ItemGroupItem } from "@/lib/api"; // ถ้ายังไม่ได้ import type นี้
// ...
  const { data: itemGroups = [] } = useQuery({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const res = await api.get<ItemGroupItem[]>("/item-groups");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });
  const groupOptions = useMemo(
    () => itemGroups.filter((g) => g.status === "active").map((g) => g.name),
    [itemGroups],
  );
  const groupIdByName = useMemo(() => {
    const m = new Map<string, string>();
    itemGroups.forEach((g) => m.set(g.name, g._id));
    return m;
  }, [itemGroups]);
  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    itemGroups.forEach((g) => m.set(g._id, g.name));
    return m;
  }, [itemGroups]);
```

หมายเหตุ: `MultiSelectPopover` ทำงานกับค่า string array. เราเก็บ `param.itemGroups` เป็น **id** แต่ให้ผู้ใช้เลือกด้วย **ชื่อ** → แปลง id↔name ตอน get/set.

- [ ] **Step 2: เพิ่ม picker ในฟอร์ม** (ถัดจาก MultiSelectPopover ของ commonNames ที่บรรทัด ~1948) — ส่ง props จากที่ render ฟอร์ม (ต้องส่ง `groupOptions`, `groupIdByName`, `groupNameById` ลงไปถ้าฟอร์มเป็น sub-component; ถ้า inline ในไฟล์เดียวกันก็ใช้ตรงๆ)

```tsx
              <MultiSelectPopover
                label="กลุ่ม Item"
                placeholder="เลือกกลุ่มที่จัดเอง"
                values={(form.itemGroups ?? []).map((id) => groupNameById.get(id) ?? id)}
                onChange={(names) =>
                  set("itemGroups", names.map((n) => groupIdByName.get(n) ?? n))
                }
                options={groupOptions}
                disabled={form.applyAll}
                emptyText="ยังไม่มีกลุ่ม (สร้างที่หน้า Master Item)"
              />
```

- [ ] **Step 3: ให้ `form`/default มี `itemGroups`** — ที่ default form object (บรรทัด ~230, ที่มี `applyAll: false, commonNames: [], ...`) เพิ่ม `itemGroups: [],` และตรวจว่า payload ตอน save ส่ง `itemGroups` ไปด้วย (ถ้ามีการ pick fields เฉพาะ — Grep หา `commonNames:` ใน builder ของ payload แล้วเพิ่ม `itemGroups` คู่กัน)

- [ ] **Step 4: แสดงในสรุป "ใช้กับ"** (badge) — ที่ฟังก์ชันสร้าง summary (บรรทัด ~2469-2484 ที่ push commonNames/itemNames) เพิ่ม group:

```tsx
  if ((item.itemGroups?.length ?? 0) > 0) {
    rows.push({
      label: "กลุ่ม",
      values: (item.itemGroups ?? []).map((id) => groupNameById.get(id) ?? id),
    });
  }
```

(ปรับให้เข้ากับโครงสร้าง summary จริงในไฟล์ — รูปแบบ `{ label, values }` ตามที่ของเดิมใช้)

- [ ] **Step 5: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 6: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(item-groups): add group picker to Parameter applicability"
```

---

### Task F2: optionFilters "กลุ่ม Item" picker

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: เพิ่ม `itemGroups` ใน `OptionFilter` type** (ที่ประกาศ type นี้ในไฟล์ — Grep `type OptionFilter`)

```ts
  itemGroups?: string[];
```

- [ ] **Step 2: ส่ง group options เข้า `OptionFilterDialog`** — เพิ่ม props `groupOptions`, `groupIdByName`, `groupNameById` ใน signature ของ `OptionFilterDialog` (บรรทัด ~760) และที่จุดเรียกใช้ component นี้ (Grep `<OptionFilterDialog`)

- [ ] **Step 3: เพิ่ม MultiSelectPopover ในdialog** (ถัดจาก subCategories block บรรทัด ~881)

```tsx
          <MultiSelectPopover
            label="กลุ่ม Item"
            placeholder="เลือกกลุ่มที่จัดเอง"
            values={(filter?.itemGroups ?? []).map((id) => groupNameById.get(id) ?? id)}
            onChange={(names) => onSetFilter({ itemGroups: names.map((n) => groupIdByName.get(n) ?? n) })}
            options={groupOptions}
            emptyText="ยังไม่มีกลุ่ม"
          />
```

- [ ] **Step 4: รวม `itemGroups` ใน `hasAny` + `setOptionFilter` non-empty cleanup**

- ที่ `hasAny` (บรรทัด ~782): บวก `(filter?.itemGroups?.length ?? 0)`
- ที่ `setOptionFilter` (บรรทัด ~954, การ build `nonEmpty`): เพิ่ม
  ```ts
  if ((merged.itemGroups?.length ?? 0) > 0) nonEmpty.itemGroups = merged.itemGroups;
  ```

- [ ] **Step 5: type-check + test รวม**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Run: `npm run test`
Expected: ไม่มี error ใหม่; test ผ่านทั้งหมด

- [ ] **Step 6: ตรวจด้วยตา (manual end-to-end)**
  1. สร้างกลุ่มในหน้า Master Item (commonname 1 ตัว)
  2. ParameterSettings → สร้าง/แก้ parameter → "ใช้กับ" เลือกกลุ่มนั้น → save
  3. หน้า Master Item: item ที่ commonname ตรงกลุ่ม ต้องนับ parameter เพิ่มขึ้น (badge พารามิเตอร์)
  4. เปิด QC/Lab testing ของ item นั้น เห็น parameter โผล่
  5. แก้สมาชิกกลุ่ม (เพิ่ม commonname) → item ใหม่ match ทันทีโดยไม่ต้องแก้ parameter

- [ ] **Step 7: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(item-groups): support group filter in enum optionFilters"
```

---

## Final verification

- [ ] **Run ทั้งหมด:** `npm run test` (ทุก test ผ่าน), `npx tsc -p tsconfig.app.json --noEmit` (ไม่มี error ใหม่นอกเหนือ ~12 latent เดิม), `npm run lint`
- [ ] **Seed export (ของใหม่เข้า backup):** `cd server && npm run seed:export` แล้ว commit `server/seed-data/` ที่เปลี่ยน (collection `itemgroups` + parameters ที่มี itemGroups)
- [ ] **อัปเดต CLAUDE.md** เพิ่ม `ItemGroup` ในรายการ Models และ `item-groups` ในรายการ Routes

---

## Self-Review notes (เช็คแล้ว)

- **Spec coverage:** model+route (A1-A2) ✓ · Parameter.itemGroups param-level+optionFilters (A3) ✓ · resolveItemGroups/buildItemGroupIndex (B2) ✓ · matcher 3 ฟังก์ชัน (C1) ✓ · call sites ~6 ไฟล์ (C2,D1-D3) ✓ · getParametersFor + detail chips + trade name (E1) ✓ · manager dialog (E2) ✓ · ParameterSettings param-level + optionFilters (F1-F2) ✓
- **Membership keyed by itemNo** (เพราะ PetitionItem ไม่มี trade name) — resolve ทั้งระบบผ่าน `buildItemGroupIndex` จาก catalog เดียวกัน ตรงตาม spec ข้อ 3
- **commonname override (cnMap):** hook ใช้ commonname **ดิบ** เพื่อให้ตรงกับ matcher ฝั่ง testing ที่เทียบ `item.commonName` ดิบ — สอดคล้องกัน (ผู้ใช้เลือก commonname จาก dropdown ที่เป็นค่าดิบของ catalog เช่นกัน). ถ้าภายหลังต้องการให้ตรง override layer ค่อยปรับจุดเดียวใน hook + dialog options.
- **id↔name ใน ParameterSettings:** เก็บ id แต่โชว์ชื่อ ผ่าน map สองทาง — กันชื่อกลุ่มซ้ำด้วย unique index ฝั่ง DB อยู่แล้ว
