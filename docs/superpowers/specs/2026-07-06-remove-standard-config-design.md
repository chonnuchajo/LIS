# Remove StandardConfig feature (unused)

**Date:** 2026-07-06
**Branch:** develop
**Type:** Removal / cleanup

## Background

`StandardConfig` เป็นหน้า config (`/standard-config`) ที่ให้ตั้งค่าจำนวนครั้ง (`times`) ต่อ
instrument + scope + commonName สำหรับ standard. หลังจากถอด feature "ชั่ง Standard" ออกไป
(commit 15b57b6, 2026-07-04) ค่าเหล่านี้ไม่มี workflow ไหนอ่านไปใช้อีกแล้ว — ฝั่ง frontend
มีแค่ `StandardConfig.tsx` เท่านั้นที่เรียก `api.getStandardConfigs()`; petition / lab-testing /
stock / standard requisition ใหม่ ไม่แตะเลย จึงเป็น dead feature ที่ควรลบทิ้งทั้งชุด

## Decision

ลบ StandardConfig **ทั้ง feature** (โค้ด FE + BE + route + nav + API + tests + seed data) และ
**drop collection `standardconfigs` ใน DB** เพื่อไม่ให้ `seed:export` (ที่ดึงทุก collection แบบ
dynamic) สร้างไฟล์ seed กลับมาเอง เป้าหมาย = ไม่เหลือของลอย

## Scope

### ลบไฟล์ (7)

- `src/pages/StandardConfig.tsx`
- `src/pages/__tests__/StandardConfig.test.tsx`
- `src/lib/standardConfig.ts`
- `src/lib/standardConfig.test.ts`
- `server/models/StandardConfig.js`
- `server/routes/standardConfigs.js`
- `server/seed-data/standardconfigs.json`

### แก้ไข (6 จุด)

- `src/App.tsx` — ลบ `const StandardConfig = lazy(...)` (~64) และ `<Route path="/standard-config">` (~143)
- `src/lib/navItems.ts` — ลบ nav entry `{ ... path: "/standard-config" }` (~52) — `FlaskConical`
  ยังใช้ที่ entry อื่น ไม่ต้องแตะ import
- `src/lib/api.ts` — ลบ `getStandardConfigs` / `createStandardConfig` / `updateStandardConfig` /
  `deleteStandardConfig` (~710-722) และ `import type { StandardConfigDoc }` (~11)
- `server/index.js` — ลบ `mountApi('/standard-configs', require('./routes/standardConfigs'))` (~46)
- `server/routes/methods.js` — ลบ `require('../models/StandardConfig')` (~5) และ `inStd` check
  (~109-110); ให้ guard เหลือแค่ `inSimple` (ยังบล็อกลบ Method ที่ถูก simple-method อ้างอยู่)
- `server/seed-data/_manifest.json` — ลบ entry `standardconfigs`

### DB

- Backup ก่อน: dump `standardconfigs` collection ลงไฟล์ (กันเหนียว) แล้ว **drop collection**
- ทำผ่าน one-off script (รูปแบบเดียวกับ `server/scripts/*`) หรือ MongoDB โดยตรง

### ไม่แตะ

- `assets/StandardConfig-*.js` — build artifact เก่า (dev/prod split gotcha: ห้าม hand-edit
  ไฟล์ใน root/assets — จะหายเองตอน `npm run build` จริงรอบถัดไป)

## Verification

1. `npx tsc -p tsconfig.app.json --noEmit` — 0 error ใหม่ (repo มี ~12 latent error เดิม, ต้องไม่เพิ่ม)
2. `npm run test` — suite ที่เหลือเขียว (หลังลบ 3 ไฟล์เทสต์ StandardConfig)
3. `npm run lint` — ไม่มี unused import ค้าง
4. เปิดแอป: nav ไม่มี "Standard Config", route `/standard-config` โหลดไม่ได้แล้ว, หน้าอื่น
   (โดยเฉพาะ Machines/Simple Method ที่ methods.js delete-guard เกี่ยว) ทำงานปกติ — ลอง delete
   Method ที่ไม่ถูกใช้ = ลบได้, ที่ถูก simple-method ใช้ = ยังบล็อก 409
5. `npm run seed:export` แล้วเช็คว่า `standardconfigs.json` **ไม่ถูกสร้างกลับมา** (ยืนยัน drop สำเร็จ)

## Risks

- **methods.js guard:** ระวังอย่าเผลอลบ `inSimple` check ไปด้วย — ต้องคงไว้
- **prod DB drop:** เป็น destructive op — ต้อง backup dump ก่อน; รันบนเครื่อง user/prod เอง
- **auto-sync resurrection:** ถ้าไม่ drop collection จริง seed file จะกลับมา — verification ข้อ 5 คือด่านกัน
