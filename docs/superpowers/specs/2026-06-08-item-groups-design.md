# Item Groups (กลุ่ม Item จัดเอง) — Design

**Date:** 2026-06-08
**Status:** Approved design → ready for implementation plan

## Problem

ปัจจุบัน Parameter ตรวจสอบจับคู่กับ item ได้ 5 มิติ: `applyAll`, `itemNames`,
`commonNames`, `productTypes`, `categories`/`subCategories` ทั้งหมดอ้างค่าที่มาจาก ERP
โดยตรง ผู้ใช้ไม่มีทาง "จัดกลุ่ม item เอง" ตามเกณฑ์ผสม (เช่น รวมหลาย commonname + บาง
trade name ไว้ด้วยกัน แล้วบวก/ลบ item รายตัว) เพื่อนำกลุ่มนั้นไปเป็นเงื่อนไขของ Parameter

`trade_name` มีในข้อมูล master item อยู่แล้ว แต่ถูกซ่อน (`hiddenTableKeys`) ยังไม่ถูกใช้

## Goal

ให้ผู้ใช้สร้าง **กลุ่ม item ที่จัดเอง** ในหน้า Master Item โดยนิยามสมาชิกแบบ **ผสม**
(rule จาก commonname/trade name + เพิ่ม/ตัด item รายตัว) แล้วนำกลุ่มไปใช้เป็นเงื่อนไข
"ใช้กับ" ของ Parameter รวมถึง `optionFilters` ของช่อง enum โดยอ้างแบบ **live (group ID)**
— แก้สมาชิกกลุ่มทีหลังแล้ว Parameter ที่อ้างกลุ่มนั้นอัพเดตตามทันที

## Non-goals

- ไม่ทำ nested group (กลุ่มซ้อนกลุ่ม)
- ไม่แตะ matcher ของ simple-method / การ assign petition (กลุ่มใช้กับ Parameter เท่านั้น)
- ไม่เพิ่ม column "กลุ่ม" ในตาราง Master Item (โชว์เฉพาะใน detail dialog)

---

## 1. Data model — `ItemGroup` (collection ใหม่)

`server/models/ItemGroup.js`

```js
{
  name: String,             // required, trim; ชื่อกลุ่มที่ผู้ใช้ตั้ง
  description: String,       // default ''
  commonNames: [String],    // rule: item ที่ commonname (resolved) ตรง → เข้ากลุ่ม
  tradeNames:  [String],    // rule: item ที่ trade name ตรง → เข้ากลุ่ม
  includeItemNos: [String], // เพิ่ม item รายตัว (itemNo) นอกเหนือ rule
  excludeItemNos: [String], // ตัด item รายตัวออก — ชนะ rule + include
  status: 'active' | 'inactive',  // default 'active'
  sortOrder: Number,        // default 0
}
```

- ใช้ `softDeletePlugin` เหมือน model อื่นทุกตัว
- index: `{ name: 1, deletedAt: 1 }` unique (กันชื่อซ้ำในกลุ่มที่ยังไม่ถูกลบ)
- เก็บ **itemNo** (ไม่ใช่ _id ของ master item) เพราะ master item มาจาก ERP webhook
  ไม่มี Mongo _id ที่เสถียร — itemNo คือ key ที่ใช้ทั่วทั้งระบบ (`codeKeys`)
- ค่า `commonNames` เก็บเป็น commonname ที่ผ่าน override-resolve แล้ว (ตรงกับที่หน้าจอ
  แสดง) เพื่อให้ membership ตรงกับสายตาผู้ใช้

### กติกาสมาชิก (membership rule)

```
itemInGroup(item, group):
  itemNo = codeKeys(item)
  if excludeItemNos.includes(itemNo): return false      // ตัดออก ชนะทุกอย่าง
  if includeItemNos.includes(itemNo): return true        // เพิ่มรายตัว
  cn = resolved commonname ของ item (ผ่าน cnMap override)
  tn = trade name ของ item
  return group.commonNames.includes(cn) || group.tradeNames.includes(tn)
```

## 2. Backend

- route ใหม่ `server/routes/item-groups.js`: `GET /` (list, ไม่รวมที่ลบ),
  `POST /`, `PUT /:id`, `DELETE /:id` (soft delete)
- mount ใน `server/index.js` ผ่าน `mountApi()` → ได้ทั้ง `/api/item-groups`
  และ `/LIS/api/item-groups`
- model ถูกหยิบโดย `loadAllModels()` + `ensureCollections()` อัตโนมัติ และ
  `seed:export` dump ให้เองเพราะใช้ `listCollections()` แบบ dynamic
- **`Parameter` model**: เพิ่ม field เดียว `itemGroups: { type: [String], default: [] }`
  (เก็บ array ของ group ID). ไม่ต้องแก้ pre-validate
- **`ValueFieldSchema.optionFilters`** (sub-schema ของช่อง enum): เพิ่ม
  `itemGroups: { type: [String], default: [] }` ในแต่ละ option filter

## 3. การจับคู่ parameter ↔ item (live ตาม group ID)

หัวใจ: matcher ต้องไม่ลาก catalog ของกลุ่มทั้งก้อนเข้าไป — ให้ caller คำนวณว่า item
สังกัดกลุ่มไหนบ้างมาให้ก่อน

เพิ่ม helper กลางใน `src/lib/itemGroups.ts`:

```ts
export type ItemGroup = { _id, name, commonNames, tradeNames,
                          includeItemNos, excludeItemNos, status }

// คืน group ID ทั้งหมดที่ item นี้สังกัด (เฉพาะ status active)
export function resolveItemGroups(
  args: { itemNo: string; commonName: string; tradeName: string },
  groups: ItemGroup[],
): string[]
```

จุดแก้ 2 ที่:

1. **`src/lib/petitionTestItems.ts` → `parameterAppliesToItem`**
   - เพิ่ม optional field `itemGroupIds?: string[]` ใน item descriptor ที่ส่งเข้า
   - เพิ่มเงื่อนไข OR: `(param.itemGroups ?? []).some(g => itemGroupIds.includes(g))`
   - ปรับ guard "ไม่มีเงื่อนไขเลย → ไม่ match" ให้นับ `itemGroups` ด้วย
   - caller (testing/petition flow) คำนวณ `itemGroupIds` ด้วย `resolveItemGroups`
     แล้วแนบเข้า descriptor; ต้อง query กลุ่มเพิ่ม (React Query key `["item-groups"]`)

2. **`src/pages/MasterItems.tsx` → `getParametersFor`**
   - รับ `groups` เพิ่ม, คำนวณ `itemGroupIds` ของ item, เพิ่มเงื่อนไข OR เดียวกัน
   - `tradeName` อ่านผ่าน `tradeNameKeys` ใหม่ (`['trade_name','tradename','tradeName']`)

3. **`optionFilters`** (กรอง option ของช่อง enum ตามชนิด item): จุดที่ evaluate
   optionFilters ปัจจุบัน ให้เพิ่มการเช็ค `filter.itemGroups` แบบเดียวกัน
   (ค้นหาจุด evaluate ตอนทำ plan — ใช้ที่เดียวกับ commonNames/productTypes ของ filter)

มี unit test สำหรับ `resolveItemGroups` (include/exclude ชนะ rule, commonname OR
tradename, เฉพาะ active) และ test เพิ่มใน `petitionTestItems.test.ts` ว่า param ที่อ้าง
group match item ที่อยู่ในกลุ่ม

## 4. UI

### 4.1 หน้า Master Item — จัดการกลุ่ม

- เพิ่มปุ่ม **"จัดกลุ่ม"** บน header ของหน้า Master Item → เปิด `ItemGroupManagerDialog`
- dialog แบบ 2 ฝั่ง:
  - **ซ้าย**: รายชื่อกลุ่ม + badge จำนวนสมาชิกที่ resolve ได้จริง, ปุ่ม "＋ กลุ่มใหม่",
    ปุ่มลบ
  - **ขวา (editor ของกลุ่มที่เลือก)**:
    - ชื่อกลุ่ม, คำอธิบาย, status
    - **commonname** multi-select (ตัวเลือกดึงจาก distinct commonname ของ master items)
    - **trade name** multi-select (ดึงจาก distinct trade name — surface ค่าที่เคยซ่อน)
    - **เพิ่ม item รายตัว** (ค้นหา itemNo/ชื่อ → includeItemNos)
    - **ตัด item ออก** (excludeItemNos)
    - **Preview**: รายชื่อ item ที่เข้ากลุ่มจริงแบบ live (คำนวณ client-side จากกติกา
      สมาชิก) + จำนวนรวม
- บันทึกผ่าน `POST/PUT /item-groups`, invalidate `["item-groups"]`

### 4.2 หน้า Master Item — detail dialog

- ใน `MasterItemDetailDialog` เพิ่มแถวโชว์ **chip กลุ่มที่ item นี้สังกัด** (คำนวณจาก
  `resolveItemGroups`) — ไม่เพิ่ม column ในตาราง

### 4.3 หน้า ParameterSettings

- ในส่วนเงื่อนไข "ใช้กับ" (ที่มี commonNames/itemNames/productTypes/categories อยู่)
  เพิ่ม picker **"กลุ่ม Item"** (multi-select จากรายการกลุ่ม active) → เก็บลง
  `param.itemGroups`
- ในตัวแก้ `optionFilters` ของช่อง enum เพิ่ม picker "กลุ่ม Item" เดียวกัน →
  เก็บลง `filter.itemGroups`
- สรุปเงื่อนไข (badge "ใช้กับ ...") เพิ่มการแสดงชื่อกลุ่มที่เลือก

## Data flow สรุป

```
ItemGroup (Mongo) ──GET /item-groups──> React Query ["item-groups"]
                                              │
        ┌─────────────────────────────────────┼───────────────────────────┐
        ▼                                      ▼                           ▼
ItemGroupManagerDialog            MasterItems.getParametersFor      petition/testing flow
(สร้าง/แก้/preview)                resolveItemGroups(item,groups)   resolveItemGroups → descriptor
                                   → param.itemGroups OR-match      → parameterAppliesToItem
```

## ความเสี่ยง / จุดต้องระวัง

- **itemNo เป็น key**: ถ้า ERP เปลี่ยน itemNo สมาชิกที่ pin รายตัวอาจหลุด — ยอมรับได้
  (เหมือนทุก feature ที่อ้าง itemNo)
- **commonname override**: membership ต้องใช้ commonname ที่ผ่าน `cnMap` ให้ตรงกับที่
  หน้าจอแสดง ไม่งั้นผู้ใช้เลือกกลุ่มแล้วงง
- **จุด evaluate optionFilters**: ต้องหาให้เจอตอนทำ plan ว่าปัจจุบัน evaluate ที่ไหน
  (หน้ากรอกผล QC) แล้วเสียบ itemGroups ที่จุดเดียวกัน
- **2 matcher ต้องตรงกัน**: logic OR ของ group ต้องเหมือนกันทั้ง page และ testing flow
  — รวม logic ไว้ใน `resolveItemGroups` ที่เดียว
