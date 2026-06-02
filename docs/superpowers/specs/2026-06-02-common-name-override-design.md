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

### ข้อจำกัดสำคัญ: % map กับสาร เดาจาก string ไม่ได้
ไม่มีกฎ syntactic ตายตัว — ยืนยันจากที่ user ให้มา:

| string | positional reading | ค่าจริง (user) | ตรงกัน? |
|---|---|---|---|
| `TRIFLOXYSTROBIN + TEBUCONAZOLE 25% + 50%` | TRIFLOX=25, TEBU=50 | TEBU=50, TRIFLOX=25 | ✅ |
| `DIURON + HEXAZINONE 46.8% + 13.2%` | DIURON=46.8, HEXA=13.2 | **DIURON=13.2, HEXA=46.8** | ❌ กลับด้าน |

→ canonical ทุกตัว **ต้องให้ domain expert ยืนยัน** ไม่ auto-derive

## Goal / Non-goals

**Goal:** ชั้น normalize `common_name` ฝั่ง LIS แบบ map ทั้ง string `raw → canonical` แก้ทั้งปัญหา % ผิด และ dedup ในตัวเดียว โดยไม่แตะ ERP, reversible, มี admin UI ให้ domain expert ดูแลเอง

**Non-goals (YAGNI):**
- ไม่เขียนกลับ ERP / n8n (best-effort sync เดิมก็ปล่อยไว้)
- ไม่ parse % เป็น field แยกต่อสาร — เก็บเป็น canonical string ทั้งก้อน
- ไม่ทำ auto-suggest canonical จาก heuristic (เสี่ยงผิดเหมือนตาราง DIURON)

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

## Appendix A — Candidate mappings (⚠️ รอ user ยืนยัน, ห้าม commit ก่อนยืนยัน)
`?` = positional reading, **ต้องเช็คว่า % ตรงสูตรจริงมั้ย โดยเฉพาะที่ flag ⚠️**

| raw (จาก ERP) | canonical ที่เสนอ | หมายเหตุ |
|---|---|---|
| `BIFENTHRIN + IMIDACLOPRID 5% + 25% W/V SC` | `BIFENTHRIN 5% + IMIDACLOPRID 25% W/V SC` | twin #9 ยืนยัน positional |
| `DIFENOCONAZOLE + AZOXYSTROBIN 12.5%+20% W/V SC` | `AZOXYSTROBIN 20% + DIFENOCONAZOLE 12.5% W/V SC` | twin #7; รวม #7 → canonical เดียว |
| `DIFENOCONAZOLE + PROPICONAZOLE 15% + 15% W/V EC` | `DIFENOCONAZOLE 15% + PROPICONAZOLE 15% W/V EC` | 15/15 ไม่ ambiguous; รวม #25 |
| `DIURON + HEXAZINONE 46.8% + 13.2% WG` | `DIURON 13.2% + HEXAZINONE 46.8% WG` | ⚠️ user: % กลับด้าน; รวม #27, #28 ด้วย |
| `DIURON 46.8%+HEXAZINONE 13.2% WG` | `DIURON 13.2% + HEXAZINONE 46.8% WG` | ⚠️ #27 ก็ผิดตาม user |
| `DIURON+HEXAZINONE 46.8% +13.2% WG` | `DIURON 13.2% + HEXAZINONE 46.8% WG` | ⚠️ #28 |
| `TRIFLOXYSTROBIN + TEBUCONAZOLE 25% + 50% WG` | `TEBUCONAZOLE 50% + TRIFLOXYSTROBIN 25% WG` | twin #44 ยืนยัน |
| `CYMOXANIL + MANCOZEB 8% + 64% WP` | `CYMOXANIL 8% + MANCOZEB 64% WP` | ⚠️ positional, ไม่มี twin |
| `MESOTRIONE + ATRAZINE 8%+80.8% WG` | `MESOTRIONE 8% + ATRAZINE 80.8% WG` | ⚠️ positional |
| `QUINCLORAC + BENSULFURON-METHYL 34% + 2% WP` | `QUINCLORAC 34% + BENSULFURON-METHYL 2% WP` | ⚠️ positional |
| `TRICYCLAZOLE + MANCOZEB 18% + 62% WP` | `TRICYCLAZOLE 18% + MANCOZEB 62% WP` | ⚠️ positional |
| `THIAMETHOXAM + LAMBDA-CYHALOTHRIN 14.1% + 10.6% W/` | `THIAMETHOXAM 14.1% + LAMBDA-CYHALOTHRIN 10.6% ZC` | twin #46/#47; ⚠️ unit (ZC?) + รวม variant |
| `2,4-D-TRIISOPROPANOLAMINE SALT+PICLORAM 45.2%+11.6` | `2,4-D-TRIISOPROPANOLAMINE SALT 45.2% + PICLORAM 11.6% SL?` | ⚠️ positional + % ปลายขาด + unit ไม่แน่ |

> หมายเหตุ duplicate เว้นวรรคล้วน (เช่น `BUTACHLOR 35% + PROPANIL 35%  W/V EC` double-space) จะถูก group key (collapse whitespace) ยุบให้เองโดยไม่ต้องตั้ง override
