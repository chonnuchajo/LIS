# Common Name Override Layer — Design

**Date:** 2026-06-02
**Status:** Draft (pending user review)
**Author:** prompiriya-ICP + Claude

## Problem

`common_name` (active-ingredient string) สำหรับ master item มาจาก **production ERP** ผ่าน n8n webhook (`/webhook/API/Item-production`) — LIS อ่านสดอย่างเดียว ไม่ได้เก็บถาวร และ override ฝั่ง `MasterItemMeta` **ไม่มี field `common_name`** จึงแก้ค่านี้ไม่ได้

บางรายการเขียนผิดรูปแบบ ทำให้เกิด 2 อาการ:

1. **Malformed "ชื่อสารก่อน แล้วยก % ไปต่อท้าย"** (split เป็น 3 ท่อนด้วย `+`) → `parseSubstances` (positional, split `+`) merge ผิด เช่น
   `DIURON + HEXAZINONE 46.8% + 13.2% WG` → `["DIURON + HEXAZINONE 46.8%", "13.2% WG"]`
   ทำให้ชื่อสาร + การ assign เครื่อง (GC/HPLC) ผิดตำแหน่ง
2. **Duplicate variant ของผลิตภัณฑ์เดียวกัน** (สลับที่/เว้นวรรค/ฟอร์แมตต่าง) → เกิดหลาย row ใน Simple Method สำหรับผลิตภัณฑ์เดียว การ assign กระจัดกระจาย

### Scope (จากข้อมูลจริง 2026-06-02)
- 2,319 master rows → **742 distinct common_name** → **49 ตัวมี `+`** (35 ตัว 2 ท่อน, 14 ตัว 3 ท่อน)
- กลุ่มที่ต้อง override ~13–15 ตัว (ดู Appendix A)

### ข้อจำกัดสำคัญ: ปัญหาอยู่ที่ "รูปแบบ string" ไม่ใช่ "ลำดับ %"
**อัปเดต 2026-06-04:** user ยืนยันว่า **positional reading ถูกเสมอ** — % เรียงตรงตามลำดับสารที่เขียน ไม่มีเคสกลับด้าน (ข้อมูลเดิมที่ว่า DIURON กลับด้าน = บอกผิด)

| string | positional reading | ค่าจริง (user) | ตรงกัน? |
|---|---|---|---|
| `TRIFLOXYSTROBIN + TEBUCONAZOLE 25% + 50%` | TRIFLOX=25, TEBU=50 | TEBU=50, TRIFLOX=25 | ✅ |
| `DIURON + HEXAZINONE 46.8% + 13.2%` | DIURON=46.8, HEXA=13.2 | DIURON=46.8, HEXA=13.2 | ✅ |

→ เพราะ positional ถูกเสมอ canonical ของเคส malformed จึง **derive แบบ mechanical ได้** (interleave ชื่อสาร + % ตามตำแหน่ง) แต่ override layer **ยังจำเป็น** เพราะ:
1. **malformed 3-ท่อน** (`A + B x% + y%`) → `parseSubstances` split `+` ได้ 3 ท่อนผิด → ต้อง reformat เป็น `A x% + B y%` ให้ parse 2 สารถูกตำแหน่ง
2. **dedup variant** ซ้ำ (สลับที่/เว้นวรรค/ฟอร์แมตต่าง) → ยุบเป็น canonical เดียว

## Goal / Non-goals

**Goal:** ชั้น normalize `common_name` ฝั่ง LIS แบบ map ทั้ง string `raw → canonical` แก้ทั้งปัญหา % ผิด และ dedup ในตัวเดียว โดยไม่แตะ ERP, reversible, มี admin UI ให้ domain expert ดูแลเอง

**Non-goals (YAGNI):**
- ไม่เขียนกลับ ERP / n8n (best-effort sync เดิมก็ปล่อยไว้)
- ไม่ parse % เป็น field แยกต่อสาร — เก็บเป็น canonical string ทั้งก้อน
- ไม่ทำ auto-suggest canonical จาก heuristic — *(หมายเหตุ 2026-06-04: เหตุผลเดิม "DIURON กลับด้าน" ตกไปแล้ว; positional ถูกเสมอ ⇒ จริง ๆ auto-derive เคส malformed ได้ ถ้า user อยากได้ทีหลัง แต่ default ยังเป็นกรอกมือผ่าน UI ตามที่ build ไว้)*

## Design

### 1. Model — `CommonNameOverride` (`server/models/CommonNameOverride.js`)
```js
{
  raw:       String,  // required; เทียบกับค่าจาก ERP (เก็บค่าดิบไว้โชว์)
  rawKey:    String,  // required, unique, index; = normalizeKey(raw)
  canonical: String,  // required; ชื่อมาตรฐานที่ต้องการให้ LIS ใช้
  note:      String,  // optional เหตุผล/อ้างอิงสูตร
  // timestamps
}
```
- `normalizeKey(s)` = `s.trim().toLowerCase().replace(/\s+/g, " ")` (กัน whitespace/เคสเพี้ยน)
- unique บน `rawKey` → upsert ได้

### 2. Route — `server/routes/commonNameOverrides.js`
CRUD ตาม pattern `simpleMethodExclusions.js`:
- `GET /` → list (`_id, raw, canonical, note`)
- `POST /` → upsert by `rawKey` (`{ raw, canonical, note }`); validate raw & canonical ไม่ว่าง
- `DELETE /:id`

Mount ใน `server/index.js`:
```js
mountApi('/common-name-overrides', require('./routes/commonNameOverrides'));
```
(model ถูก auto-load ผ่าน `loadAllModels()` + `ensureCollections()` อยู่แล้ว → collection ใหม่เข้าระบบ `seed:export` อัตโนมัติ)

### 3. Client helper — `src/lib/commonNameOverride.ts`
```ts
export function normalizeKey(s: string): string
export function buildOverrideMap(rows): Map<string, string>      // rawKey → canonical
export function normalizeCommonName(raw: string, map): string    // คืน canonical ถ้ามี, ไม่งั้นคืน raw เดิม
```
+ co-located `commonNameOverride.test.ts` (Vitest): key normalize, hit/miss, whitespace/case

API methods ใน `src/lib/api.ts`: `getCommonNameOverrides`, `upsertCommonNameOverride`, `deleteCommonNameOverride` (ตาม pattern เดิม)

### 4. จุด apply (client-side — master-items เป็น proxy)
- **`SimpleMethodPage`**: เพิ่ม query `useQuery(["common-name-overrides"])` → override map ส่งเข้า `buildSimpleMethodRows(items, overrides, cnMap)`
- **`buildSimpleMethodRows`**: ที่บรรทัดดึง `commonName` (≈355) ใช้ `normalizeCommonName(raw, cnMap)` ก่อน `parseSubstances` + ก่อนคำนวณ group key
  - group key เปลี่ยนเป็น `normalizeKey(canonicalCommonName)` → dedup variant อัตโนมัติ (รวม whitespace-only dup ด้วย)
  - instruments ยังคีย์ด้วย `itemNo` เหมือนเดิม → ไม่ชน; itemNos ของ variant ที่ยุบมารวม row เดียว
  - count สารคงเดิม (malformed 3-ท่อน → canonical 2-สาร parse ได้ 2 เท่ากัน) → instruments array ไม่ length-mismatch
- **`useExternalLookups` / `normalizeLotOptions`**: fetch override map ใน `useLotOptions` แล้ว map `commonName` → canonical ก่อนคืน option → petition ใหม่ snapshot ชื่อ canonical

### 5. Admin UI — inline ใน Simple Method tab
- เพิ่ม action ต่อ row: **"✎ ชื่อมาตรฐาน"** → dialog กรอก `canonical` (+ note) สำหรับ `raw` ของ row นั้น → POST upsert → invalidate `["common-name-overrides"]` + `["master-items"]`
- เพิ่ม badge เล็กบน row ที่มี override อยู่ (โชว์ raw เดิม hover ได้) + ปุ่มลบ override
- (option) panel รวม override ทั้งหมดแบบเดียวกับ exclusions panel

## Testing
- **Unit (Vitest):** `commonNameOverride.test.ts` — normalizeKey, map hit/miss, whitespace/case; + เคสใน `substances.test.ts` ยืนยัน canonical 2-สาร parse ได้ถูก
- **Integration:** `buildSimpleMethodRows` กับ override map — malformed → 2 สารถูกตำแหน่ง, variant ยุบเป็น 1 row, itemNos รวมครบ
- **Manual:** ตั้ง override ผ่าน UI → row อัปเดต, ลบ override → กลับเป็นเดิม
- `npx tsc --noEmit` + `npm run test`

## Rollout
1. สร้าง model + route + helper + tests
2. ต่อ UI (apply point + admin)
3. user ยืนยัน canonical รายตัว (Appendix A) แล้วกรอกผ่าน UI (หรือ seed script one-off ถ้าจะ batch)
4. `npm run seed:export` + commit (override อยู่ใน seed-data, กู้คืนได้)

## Appendix A — Candidate mappings
**อัปเดต 2026-06-04:** เพราะ positional ถูกเสมอ (ดู §ข้อจำกัดสำคัญ) canonical ทุกแถวด้านล่าง = interleave ชื่อสาร+% ตามตำแหน่งที่เขียน → mechanical, ไม่ ambiguous อีกต่อไป ⚠️ ที่เคย flag เรื่อง % สลับ **ยกเลิกได้ทั้งหมด** เหลือแค่เช็ค unit (เช่น ZC/SL) กับ % ปลายที่ string ขาด

**สถานะ:** ✅ ครบทุกแถวแล้ว (positional ตรง, user ยืนยันส่วนที่ string โดนตัด) — กรอกลง DB แล้ว **19 overrides** ผ่าน `server/scripts/seed-common-name-overrides.js`. **ลำดับสารคงตามที่เขียนใน raw ทุกตัว ไม่สลับ** (user 2026-06-04); ทุก variant ของผลิตภัณฑ์เดียวกันยัง dedup เป็น row เดียวเพราะ override ชี้ canonical เดียวกัน

| สถานะ | raw (จาก ERP) | canonical | หมายเหตุ |
|---|---|---|---|
| ✅ | `BIFENTHRIN + IMIDACLOPRID 5% + 25% W/V SC` | `BIFENTHRIN 5% + IMIDACLOPRID 25% W/V SC` | |
| ✅ | `DIFENOCONAZOLE + AZOXYSTROBIN 12.5%+20% W/V SC` | `DIFENOCONAZOLE 12.5% + AZOXYSTROBIN 20% W/V SC` | คงลำดับเดิม; variant `AZOXYSTROBIN 20%+DIFENOCONAZOLE 12.50% SC` ก็ override → canonical นี้ |
| ✅ | `DIFENOCONAZOLE + PROPICONAZOLE 15% + 15% W/V EC` | `DIFENOCONAZOLE 15% + PROPICONAZOLE 15% W/V EC` | รวม #25 |
| ✅ | `DIURON + HEXAZINONE 46.8% + 13.2% WG` | `DIURON 46.8% + HEXAZINONE 13.2% WG` | รวม #27, #28 |
| ✅ | `DIURON 46.8%+HEXAZINONE 13.2% WG` | `DIURON 46.8% + HEXAZINONE 13.2% WG` | = ตัวบน |
| ✅ | `DIURON+HEXAZINONE 46.8% +13.2% WG` | `DIURON 46.8% + HEXAZINONE 13.2% WG` | = ตัวบน |
| ✅ | `TRIFLOXYSTROBIN + TEBUCONAZOLE 25% + 50% WG` | `TRIFLOXYSTROBIN 25% + TEBUCONAZOLE 50% WG` | คงลำดับเดิม; variant `TEBUCONAZOLE 50% + TRIFLOXYSTROBIN 25% WG` ก็ override → canonical นี้ |
| ✅ | `CYMOXANIL + MANCOZEB 8% + 64% WP` | `CYMOXANIL 8% + MANCOZEB 64% WP` | |
| ✅ | `MESOTRIONE + ATRAZINE 8%+80.8% WG` | `MESOTRIONE 8% + ATRAZINE 80.8% WG` | |
| ✅ | `QUINCLORAC + BENSULFURON-METHYL 34% + 2% WP` | `QUINCLORAC 34% + BENSULFURON-METHYL 2% WP` | |
| ✅ | `TRICYCLAZOLE + MANCOZEB 18% + 62% WP` | `TRICYCLAZOLE 18% + MANCOZEB 62% WP` | |
| ✅ | `THIAMETHOXAM + LAMBDA-CYHALOTHRIN 14.1% + 10.6% W/` | `THIAMETHOXAM 14.1% + LAMBDA-CYHALOTHRIN 10.6% ZC` | user ยืนยัน unit = **ZC**; รวม #46/#47 |
| ✅ | `2,4-D-TRIISOPROPANOLAMINE SALT+PICLORAM 45.2%+11.6` | `2,4-D-TRIISOPROPANOLAMINE SALT 45.2% + PICLORAM 11.6%` | user 2026-06-04: PICLORAM = 11.6%, string จบที่ % **ไม่มี unit code** ต่อท้าย |

**กฎ unit (user 2026-06-04):**
- string ที่เต็มอยู่แล้ว (เช่น `W/V SC`, `W/V EC`) → **เก็บไว้ตามเดิม ไม่ตัด W/V**
- เฉพาะ string ที่โดนตัด/เหลือเศษ (เช่น `W/`) → formulation จริงเป็นโค้ด **2 ตัวอักษร** (SC/SL/EW/EC/WP/WG/ZC…) ให้เก็บเฉพาะโค้ด 2 ตัวนั้น

> หมายเหตุ duplicate เว้นวรรคล้วน (เช่น `BUTACHLOR 35% + PROPANIL 35%  W/V EC` double-space) จะถูก group key (collapse whitespace) ยุบให้เองโดยไม่ต้องตั้ง override
