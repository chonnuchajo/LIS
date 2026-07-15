# สลับ Petition Timeline ให้เป็น "รายการคำร้อง" หลัก

วันที่: 2026-07-15
สถานะ: อนุมัติ design แล้ว รอเขียน implementation plan

## เป้าหมาย

หน้า Petition Timeline (list ที่คลิกแถวแล้วไปดู timeline detail) กลายเป็น "รายการคำร้อง"
หลักของระบบ ส่วนหน้า list เดิม (คลิกแถวไป classic detail) ถูกย้ายไป path ใหม่และซ่อนจาก sidebar

ผลลัพธ์ที่ต้องการ (ตามคำสั่งผู้ใช้):
1. ซ่อน nav item "รายการคำร้อง" เดิม (ที่ชี้ `/petitions`)
2. เปลี่ยน route `/petitions` → `/petitions-old` (ทั้ง tree)
3. เปลี่ยน route `/petition-timeline` → `/petition`
4. เปลี่ยน label nav "Timeline คำร้อง" → "รายการคำร้อง"

## บริบทสำคัญ (ที่ค้นเจอ)

- `PetitionTimelinePage` = `PetitionListPage` ตัวเดียวกัน ต่างแค่ `title` และ prop
  `petitionDetailPath` (ชี้แถวไป `/petition-timeline/:id` แทน `/petitions/:id`) — ดังนั้นการ
  "สลับเป็น list หลัก" คือเปลี่ยน route + label + ปลายทางลิงก์ ไม่ต้องรื้อ component
- **ห้ามแตะ backend API endpoint** ที่ชื่อ `/petitions/*`:
  `src/lib/api.ts`, `src/hooks/usePetition.ts` (`apiFetch('/petitions')`),
  `server/index.js` (`mountApi('/petitions', ...)`), `server/routes/petitions.js`,
  `server/routes/dev.js`. พวกนี้เป็น REST endpoint ไม่ใช่ route หน้าเว็บ
- Access control เป็น path-based เก็บใน DB (`User.permissions[]`, `AccessGroup.paths[]`)
  และมี default groups ฝังใน `server/routes/accessControl.js` + `server/seed-access-control.js`

## การตัดสินใจ (จากผู้ใช้)

1. **ขอบเขต rename**: ทั้ง tree — `/petitions/*` → `/petitions-old/*`
2. **ลิงก์ไป list**: ปุ่มย้อนกลับ/ดูทั้งหมด/drilldown/redirect หลังบันทึก → `/petition`
3. **Access control**: อัปเดตทั้งโค้ด + เขียน migration DB
4. **คลิกแถวคำร้องในแดชบอร์ด**: เปิด timeline detail (`/petition/:id`) เพื่อให้ทั้งระบบ
   ใช้ประสบการณ์ timeline เป็นหลักสอดคล้องกัน

## รายละเอียด

### 1. Route map (`src/App.tsx`)

| เดิม | ใหม่ | หน้า |
|------|------|------|
| `/petition-timeline` | `/petition` | PetitionTimelinePage |
| `/petition-timeline/:id` | `/petition/:id` | PetitionTimelineDetailPage |
| `/petitions` | `/petitions-old` | PetitionListPage |
| `/petitions/assign` | `/petitions-old/assign` | PetitionAssignPage |
| `/petitions/new` | `/petitions-old/new` | PetitionNewPage |
| `/petitions/production/new` | `/petitions-old/production/new` | ProductionIntegrationPetitionNewPage |
| `/petitions/ProductionIntegrationPetitionNewPage` | `/petitions-old/ProductionIntegrationPetitionNewPage` | เดิม |
| `/petitions/:id` | `/petitions-old/:id` | PetitionDetailPage |
| `/petitions/:id/edit` | `/petitions-old/:id/edit` | PetitionEditPage |

หมายเหตุ:
- `/record-results` และ `/record-results/:id` (PetitionDetailPage mode="result") ไม่กระทบ
- ต้องคง **ลำดับ route**: `/petitions-old/assign`, `/petitions-old/new`,
  `/petitions-old/production/new` ประกาศก่อน `/petitions-old/:id` (กัน param route กลืน)
- `/petition` เป็น path ใหม่ที่ไม่ชนกับอะไร (`/petition` ≠ `/petitions-old`)

### 2. Navigation (`src/lib/navItems.ts` + `src/pages/PetitionTimelinePage.tsx`)

- **ลบ** `{ icon: FileText, label: "รายการคำร้อง", path: "/petitions" }` ออกจาก `NAV_ITEMS`
- **เปลี่ยน** `{ icon: Clock, label: "Timeline คำร้อง", path: "/petition-timeline" }`
  → `{ icon: Clock, label: "รายการคำร้อง", path: "/petition" }`
  (พิจารณาเปลี่ยน icon เป็น FileText เพื่อสื่อ "รายการ" — optional)
- "Assign คำร้อง": path `/petitions/assign` → `/petitions-old/assign` (ยังอยู่ใน nav)
- `PAGE_ITEMS`: sub-routes ตามตารางข้อ 1 + เพิ่ม `/petitions-old` เป็น page ที่รู้จัก
- `PetitionTimelinePage.tsx`:
  - `title="Timeline คำร้อง"` → `title="รายการคำร้อง"`
  - `petitionDetailPath={(p) => \`/petition-timeline/${p._id}\`}`
    → `` `/petition/${p._id}` ``
- (Optional) `PetitionListPage` ที่ `/petitions-old` ตั้ง title ให้ต่าง เช่น "รายการคำร้อง (เดิม)"
  เพื่อไม่ให้สับสนถ้าเปิดตรง — ไม่บังคับเพราะซ่อนจาก nav แล้ว

### 3. ลิงก์ภายใน (navigate / Link / props) — แยก 2 กลุ่ม

**กลุ่ม A → `/petition`** (ลิงก์ที่ไปหน้า list):
- `src/pages/PetitionDetailPage.tsx:226` `navigate('/petitions', { replace })` (หลังลบ)
- `src/pages/PetitionDetailPage.tsx:300` onBack branch `'/petitions'`
- `src/components/lis/WaitingSamplesCard.tsx:31,80` `'/petitions?status=sampleSent'`
- `src/pages/petitions/ProductionPetitionNewPage.tsx:612,621,645,817` `navigate('/petitions')`
- `src/pages/RoleDashboard.tsx:102-106` drilldown map ค่า `"/petitions"`
- `src/pages/RoleDashboard.tsx:397` `actionPathPrefix` fallback `"/petitions"`
- `src/lib/dashboardProfiles.ts:46,56,57,58,65` `drilldownPath: "/petitions"`
- `src/lib/execSummary.ts:71` `highlightPath` → `"/petition?highlight=..."` / `"/petition"`
- `src/components/lis/PetitionDashboardTable.tsx:48,49` default `actionPathPrefix` +
  `viewAllPath` = `"/petitions"` → `"/petition"` (คลิกแถว → `/petition/:id` timeline detail)

**กลุ่ม B → `/petitions-old/*`** (ลิงก์ที่ไป detail/new/edit/assign classic):
- `src/pages/PetitionEditPage.tsx:277,308` `` `/petitions/${id}` ``
- `src/pages/PetitionDetailPage.tsx:289` `` `/petitions/new?revisionOf=${data._id}` ``
- `src/pages/PetitionDetailPage.tsx:350,449` `` `/petitions/${data._id}/edit` ``
- `src/pages/PetitionDetailPage.tsx:440` `'/petitions/assign'`
- `src/pages/PetitionListPage.tsx:407` `'/petitions/new'`
- `src/pages/QCTestingDetailPage.tsx:1060` `` `/petitions/${implicitPredecessorNo}` ``
- `src/pages/PetitionAssignPage.tsx:732,750` `` `/petitions/${id}` ``
- `src/pages/PetitionAuditLogPage.tsx:218` `` `/petitions/${entry.petitionId}` ``
- `src/pages/AdminData.tsx:296` `` `/petitions/${entry.petitionId}` ``
- `src/pages/petitions/ProductionPetitionNewPage.tsx:803` `` `/petitions/${created._id}` ``

**ห้ามแตะ** (API): `src/lib/api.ts` ทุกบรรทัด, `src/hooks/usePetition.ts:252`

> ตรวจระหว่าง implement: หน้า list (`PetitionListPage`) อ่าน `?highlight=` และ `?status=`
> จาก searchParams โดยไม่ผูกกับ route — ยืนยันว่า `/petition?highlight=` และ
> `/petition?status=` ทำงาน (มี `PetitionListPage.highlight.test.tsx` ครอบอยู่)

### 4. Access Control

**Frontend `src/lib/accessControl.ts` — `IMPLIED_CHILD_PATHS`:**
รวม `/petition` เป็น "ประตูเดียว" ที่ปลดล็อกงานคำร้องทั้งหมด (mirror พฤติกรรมเดิมของ `/petitions`)

```
"/petition": [
  "/petition/:id",
  "/petitions-old",
  "/petitions-old/new",
  "/petitions-old/production/new",
  "/petitions-old/ProductionIntegrationPetitionNewPage",
  "/petitions-old/:id",
  "/petitions-old/:id/edit",
],
```
- ลบ key เดิม `"/petitions"` และ `"/petition-timeline"`
- `/petitions-old/assign` **ไม่อยู่** ใน implied (คุมแยกเหมือน `/petitions/assign` เดิม)

**Backend default groups** ให้ตรงกับ scheme ใหม่ (เพื่อ fresh seed / legacy backfill):
- `server/routes/accessControl.js` DEFAULT_GROUPS:
  - group `samples` (บรรทัด ~26): `/petitions`→`/petition`, `/petition-timeline`→`/petition`,
    `/petition-timeline/:id`→`/petition/:id`, `/petitions/new`→`/petitions-old/new`,
    `/petitions/production/new`→`/petitions-old/production/new`,
    `/petitions/ProductionIntegrationPetitionNewPage`→`/petitions-old/ProductionIntegrationPetitionNewPage`,
    `/petitions/:id`→`/petitions-old/:id`, `/petitions/:id/edit`→`/petitions-old/:id/edit`
    (คง `/physical-inspection`)
  - group `qc` (บรรทัด ~29): `/petitions/assign`→`/petitions-old/assign`,
    `/petitions/:id`→`/petitions-old/:id`
  - backfill (บรรทัด ~153-156): `/petition-timeline`→`/petition`,
    `/petition-timeline/:id`→`/petition/:id`, anchor fallback `/petitions`→`/petition`
- `server/seed-access-control.js`:
  - บรรทัด 23,31: `/petitions/assign`→`/petitions-old/assign`
  - บรรทัด 33 (Viewer): `/petitions`→`/petition` (viewer ควรเห็น list หลักที่มองเห็น)

**Migration DB** (`server/scripts/rename-petition-paths.js` แบบ dry-run ก่อน `--commit`):
ไล่ทุก entry ใน `User.permissions[]` + `AccessGroup.paths[]` ด้วยกฎ per-entry:
- exact `/petitions` → `/petition`
- exact `/petition-timeline` → `/petition`
- prefix `/petition-timeline/` → `/petition/` (เช่น `/petition-timeline/:id` → `/petition/:id`)
- prefix `/petitions/` → `/petitions-old/` (เช่น `/petitions/assign` → `/petitions-old/assign`)
- dedupe หลังแปลง

กฎไม่ชนกัน เพราะ `/petition-timeline` ไม่ขึ้นต้นด้วย `/petitions` (มี s)
รันบน prod แบบ dry-run ดูผลก่อน แล้วค่อย `--commit`; หลัง commit ให้รัน `npm run seed:export`
เพื่อให้ `seed-data/` ตรงกับ DB (auto-sync จะทำให้อัตโนมัติในรอบถัดไปอยู่แล้ว)

### 5. Tests (TDD — แก้/เพิ่มพร้อมโค้ด)

Frontend:
- `src/lib/navItems.test.ts:11` — คาดว่า NAV_ITEMS มี `/petition-timeline` → เปลี่ยนเป็น
  `/petition`; เพิ่ม assert ว่าไม่มี `/petitions` (bare) ใน NAV_ITEMS แล้ว
- `src/lib/accessControl.test.ts` — เคส `/petition-timeline`→`/petition-timeline/:id`
  เปลี่ยนเป็น `/petition`→`/petition/:id`; เคส `/petitions` grant ปรับตาม implied ใหม่
- `src/pages/PetitionTimelinePage.test.tsx` — คาด `/petition-timeline/petition-1`
  → `/petition/petition-1`
- `src/pages/PetitionTimelineDetailPage.test.tsx` — routes `/petition-timeline/:id`
  → `/petition/:id`
- `src/pages/PetitionListPage.actions.test.tsx`, `PetitionListPage.highlight.test.tsx` —
  initialEntries/petitionDetailPath ที่อ้าง `/petitions` หรือ `/petition-timeline`
- `src/lib/accessNav.test.ts`, `src/lib/accessDerive.test.ts` — fixture ที่อ้าง nav จริง
  (บาง fixture เป็น path สมมติ ใช้ทดสอบกลไก ไม่ต้องแก้)
- `src/components/dashboard/ActionTable.test.tsx` — ถ้า assert default prefix ให้ปรับ

Backend:
- `server/lib/accessGroups.test.js` — fixture `/petition-timeline`, `/petitions` ปรับตาม scheme
- เพิ่ม unit test ให้ตัวแปลง path ของ migration (pure function) ถ้าแยกออกมาได้

## ลำดับความเสี่ยง / ข้อควรระวัง

- แยก **frontend route string** ออกจาก **backend API string** ให้ชัด — เผลอแก้ `api.ts`
  จะทำให้เรียก API พัง
- Migration ต้อง dry-run บน prod ก่อน commit เสมอ (ดู `reference_concurrent_committer_hazard`)
- ตรวจว่า `PetitionListPage` รับ `?highlight=`/`?status=` ได้ทั้งที่ `/petition` และ
  `/petitions-old`
- เช็คว่าไม่มี hardcoded `/petitions` ในฝั่ง server ที่ gen ลิงก์ไปหน้าเว็บ (LINE/print/QR) —
  จากการค้น ไม่พบ (server ใช้ `/petitions` เป็น API mount เท่านั้น)

## Out of scope

- ไม่รื้อ UI/logic ภายใน PetitionListPage / PetitionTimelineDetailPage
- ไม่แตะ backend REST API `/petitions/*`
- ไม่ทำ redirect `/petitions` → `/petition` (ผู้ใช้เลือก rename ตรงๆ) — path เดิมจะ 404
  ซึ่งยอมรับได้เพราะเป็นลิงก์ภายในที่ repoint หมดแล้ว
