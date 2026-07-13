# Executive Dashboard (Administrator) — Design

**Date:** 2026-07-13
**Status:** Approved, ready for planning
**Audience of the feature:** หัวหน้า Lab และ หัวหน้า QC (ผู้ถือ role `admin`)

## Problem

`admin` dashboard profile ปัจจุบันเป็นมุมมอง "ผู้ดูแลระบบ" — KPI เป็นจำนวนผู้ใช้ / จำนวน role / Daily Check ค้าง, กราฟเป็นโดนัทสัดส่วนสถานะ, ปิดท้ายด้วย audit log ดิบ ไม่มีข้อมูลไหนที่หัวหน้า Lab/QC ใช้ตัดสินใจได้ว่า **วันนี้ต้องไปดันงานไหน ใครโหลดเกิน คุณภาพกำลังแย่ลงไหม**

นอกจากนี้ระบบมีข้อมูลเวลามาตรฐาน (`StandardTime` → `assignedMachines[].estimatedMinutes` ถูกเขียนตอน assign) แต่ไม่เคยถูกนำมาใช้ที่ไหนเลย จึงยังไม่มีนิยาม "งานเกินเวลา" ในระบบ

## Goal

ทำ `admin` dashboard ใหม่เป็น **หน้าผู้บริหาร** ที่ตอบ 5 คำถามของหัวหน้าภายในไม่กี่วินาที:

1. งานไหนติด / เกินเวลา
2. งานไหนรอมือหัวหน้าเอง
3. คุณภาพเป็นยังไง (ผลผิดปกติ / งานตีกลับ)
4. ภาระงานของทีมกระจายตัวยังไง
5. ของในสต๊อกกำลังจะขาดอะไร

Non-goals: ไม่แตะ dashboard profile อื่น (`lab-head`, `qc-head`, `qc-staff`, …), ไม่ทำหน้าตั้งค่า SLA, ไม่ทำปฏิทินวันหยุด/เวลาทำการ

## Architecture

**Server-side aggregate, single endpoint.**

```
GET /LIS/api/petitions/exec-summary?days=30      (days ∈ 7 | 30 | 90, default 30)
```

คืน object เดียว หน้าเว็บโหลดครั้งเดียวจบ แบ่ง 2 ก้อน:

- **`live`** — สถานะ ณ ปัจจุบัน ไม่ขึ้นกับ `days` (งานเกินเวลา, เสี่ยงเลท, คอขวดต่อด่าน, งานรอหัวหน้า)
- **`stats`** — สถิติในช่วง `days` (turnaround ต่อด่าน, throughput, คุณภาพ, ภาระงานต่อคน)

**สต๊อกไม่อยู่ใน endpoint นี้** — บล็อกสต๊อกใช้ `LabInventorySummaryCard` + `labInventorySummaryData()` ที่มีอยู่แล้วและมีเทสต์แล้วฝั่งหน้าเว็บ (ป้อนจาก `useDashboardData`) การย้ายสูตรสต๊อกไปไว้ที่ server จะสร้างโค้ดสำเนาที่สองโดยไม่ได้อะไรเพิ่ม

**การคำนวณอยู่ใน pure JS** (`server/lib/execSummary.js`) ไม่ใช่ aggregation pipeline ยาว ๆ — Mongo ทำแค่กรองช่วงวันและ project field ที่ใช้ เหตุผล: นิยาม "ด่าน / เกินเวลา / เสร็จ" ซับซ้อนและต้อง unit-test ให้แน่น ซึ่ง repo ใช้แพทเทิร์นนี้อยู่แล้ว (`abnormal.js`, `lineNotify.js`, `auditEvents.js` — pure lib + Jest test คู่กัน)

**Cache:** ค่าเฉลี่ยต่อ parameter (QC baseline) คำนวณจากงานที่ปิดแล้วย้อนหลัง 180 วัน แล้ว cache in-memory 10 นาที (แพทเทิร์นเดียวกับ `/master-items/slim`) ส่วน response ทั้งก้อน cache 60 วินาที ต่อค่า `days`

**ฝั่งหน้าเว็บ:** `admin` profile ใน registry ระบุ layout ใหม่ → `RoleDashboard` แตกไปเรนเดอร์ `<ExecDashboard/>` profile อื่นเดินเส้นทางเดิมทุกอย่าง

**ผลพลอยได้:** LINE bot (`งานค้าง`) และหน้า Report ดึงตัวเลขชุดเดียวกันได้จาก endpoint นี้ ไม่ต้องคำนวณซ้ำคนละสูตร

## Metric definitions

### ด่าน (stage)

ระบบเป็น dual-track (Lab / QC) จึงนับแยกราง:

| ด่าน | เริ่มจับ | หยุดจับ |
|---|---|---|
| รอรับตัวอย่าง | `sampleSentAt` | `labReceivedAt` / `qcReceivedAt` |
| รอ assign (Lab เท่านั้น) | `labReceivedAt` | `assignedTo.assignedAt` |
| กำลังทดสอบ | `labReceivedAt` (Lab) / `qcReceivedAt` (QC) | `labCompletedAt` / `qcCompletedAt` |
| รอออกผล Lab | `labCompletedAt` | `labApprovedAt` |
| รอ Final Result | ทดสอบครบทุกรางที่ใบนั้นมี | `approvedAt` |

ด่าน "รอ assign" ใช้ `assignedTo.assignedAt` ที่ระบบเขียนไว้แล้วตอน assign (ไม่ต้อง join `PetitionAuditLog`)

**ใบที่มีรางเดียว:** ไม่ใช่ทุกใบมีทั้ง Lab และ QC (lab-batch ถึงจะมีทั้งสอง) ใบที่มีเฉพาะราง QC ถือว่า "ทดสอบครบ" เมื่อ `qcCompletedAt` มีค่า — ไม่ต้องรอ `labApprovedAt` ที่จะไม่มีวันมา การตัดสินว่าใบมีรางไหนบ้าง ใช้ตรรกะเดียวกับที่หน้า Lab/QC ใช้อยู่ (`isLabBatch` / การมีอยู่ของ lab items) ห้ามเดาจาก timestamp ว่างเปล่า

### เวลาที่ผ่านไป (elapsed)

**เวลาจริง 24 ชม.** (wall clock) — ไม่หักวันหยุด/นอกเวลาทำการ ยอมรับว่างานที่ค้างข้ามคืนหรือสุดสัปดาห์จะดู "เกิน" มากกว่าความจริง ซึ่งยังเป็นข้อเท็จจริงที่หัวหน้าควรเห็น แลกกับการไม่ต้องมีหน้าตั้งค่าเวลาทำการ/วันหยุด

### Baseline และ "เกินเวลา"

- **Lab:** `baseline = Σ estimatedMinutes` ของทุก entry ใน `assignedMachines` (สมมติว่านักวิเคราะห์คนเดียวทำเรียงกัน ไม่ใช่ขนาน) · จับเวลาตั้งแต่ `labReceivedAt`
- **QC:** `baseline = max(avgMinutes ของแต่ละ parameter ที่ใบนั้นต้องทดสอบ)` — parameter ที่ช้าที่สุดเป็นตัวกำหนด เพราะทุก parameter ต้องเสร็จใบถึงปิดได้ · จับเวลาตั้งแต่ `qcReceivedAt`
  - `avgMinutes` ของ parameter = ค่าเฉลี่ยของ (`qcCompletedAt` − `qcReceivedAt`) จากใบที่ปิดแล้วซึ่ง **มี `QCTestResult` ของ parameter นั้น** ย้อนหลัง 180 วัน
  - parameter ที่มีประวัติ **น้อยกว่า 3 ใบ** → ถือว่าไม่มี baseline (กันค่าเพี้ยนจาก sample เดียว)
  - **ใบที่ยังทำอยู่ยังไม่มี `QCTestResult` ครบ** จึงยังไม่รู้ parameter set ที่แท้จริง — server จึง **เดา parameter set จากประวัติ**: parameter ที่เคยถูกบันทึกในใบที่ปิดแล้วซึ่งมี `commonName` เดียวกับ item ในใบนี้ (union ข้าม item ทุกตัวในใบ)
  - **เหตุผลที่ไม่พอร์ต `matchParametersForItem` มาไว้ที่ server:** ตรรกะจับคู่ parameter อยู่ฝั่งหน้าเว็บ (`src/lib/petitionTestItems.ts`) และต้องใช้ Parameter list + item-group membership ประกอบ การก๊อบมาไว้อีกชุดจะสร้างโค้ดสองสำเนาที่ต้อง sync มือ ซึ่งเป็นปัญหาที่เคยเกิดกับ `isEnumAbnormal` มาแล้ว การเดาจากประวัติทำให้ server พึ่งพาแค่ข้อมูลที่ตัวเองมี (`QCTestResult.parameterId` + `items[].commonName`)
  - item ที่ไม่มี `commonName` หรือไม่มีประวัติเลย → ใบนั้นไม่มี QC baseline (ไปเข้าเงื่อนไข "ยังไม่มีเกณฑ์เวลา")
- **เกินเวลา (overdue):** `elapsed > baseline`
- **เสี่ยงเลท (at-risk):** `0.8 × baseline ≤ elapsed ≤ baseline`
- **ไม่มี baseline** (ยังไม่ assign / parameter ไม่มีประวัติพอ) → **ไม่นับเป็น overdue** แต่ถ้าค้างเกิน 24 ชม. จะโผล่ในลิสต์ "งานที่ต้องจัดการ" พร้อมเหตุผล `ยังไม่ assign` / `ยังไม่มีเกณฑ์เวลา`

### งานรอมือหัวหน้า

`รอออกผล Lab` (`labCompletedAt` มี แต่ `labApprovedAt` ยังว่าง) + `รอ Final Result` (ทดสอบครบสองรางแล้ว แต่ `approvedAt` ยังว่าง)

### คุณภาพ

- **abnormal rate** = ใบที่มีผลผิดปกติ ÷ ใบที่ปิดในช่วง (ใช้ตรรกะเดียวกับ `server/lib/abnormal.js` ที่มีอยู่)
- **rework rate** = ใบที่ถูกตีกลับ (มี `revisionOf` หรือเคยผ่านสถานะ `rejected`) ÷ ใบทั้งหมดในช่วง
- แยกได้ว่าถูกตีกลับจากด่านไหน (หัวหน้า Lab / หัวหน้า QC) จาก audit log

### ภาระงานทีม

ต่อคน: จำนวนงานที่ถืออยู่ตอนนี้ / จำนวนที่ปิดไปในช่วง / turnaround เฉลี่ยของคนนั้น
Lab ใช้ `assignedTo` · QC ใช้ผู้บันทึกผล (ตรรกะเดียวกับ `/qc-results/testers`)

### Throughput

จำนวนงานเข้า (`createdAt`) เทียบงานปิด (`completedAt`) รายวันในช่วง — เส้น "เข้า" อยู่เหนือ "ปิด" ต่อเนื่อง = backlog กำลังโต

## Page layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Executive Dashboard              ภาพรวม Lab + QC   [7 วัน|30|90 ▾]  │
├─────────────────────────────────────────────────────────────────────┤
│ ① แถบ ALERT (live)                                                   │
│  งานด่วน │ เกินเวลา │ เสี่ยงเลท │ รอมือหัวหน้า │ ผลผิดปกติ │ สต๊อก     │
├──────────────────────────────────┬──────────────────────────────────┤
│ ② งานที่ต้องจัดการ                │ ③ คอขวดตอนนี้                    │
│   เรียงเกินเวลามากสุดก่อน          │   จำนวนงานค้างต่อด่าน (แท่งนอน)  │
├──────────────────────────────────┴──────────────────────────────────┤
│ ④ Turnaround ต่อด่าน (เฉลี่ย+p90) │ ⑤ งานเข้า vs งานปิด รายวัน       │
├──────────────────────────────────┬──────────────────────────────────┤
│ ⑥ คุณภาพ (ผิดปกติ % · ตีกลับ %)   │ ⑦ ภาระงานทีม  [Lab | QC]        │
├──────────────────────────────────┴──────────────────────────────────┤
│ ⑧ สต๊อก — ใกล้หมด / หมดสต็อก / ใกล้หมดอายุ (reuse การ์ดเดิม) [ไป Stock] │
└─────────────────────────────────────────────────────────────────────┘
```

ลำดับ: บนสุด = สิ่งที่ต้อง **ลงมือ** วันนี้ (①②③) · กลาง = **ระบบสุขภาพดีไหม** (④⑤) · ล่าง = **บริหารคน/ของ** (⑥⑦⑧) หัวหน้าที่รีบดูแค่ครึ่งบนก็ทำงานต่อได้

**คอลัมน์ของ ② งานที่ต้องจัดการ:** เลขคำขอ · แผนก · ด่านที่ติด · ผู้รับผิดชอบ · เกินเวลาเท่าไร (หรือเหตุผลที่ไม่มีเกณฑ์) · ปุ่มไปต่อ

**ตัวเลือกช่วงเวลา** มีผลเฉพาะบล็อก ④⑤⑥⑦ · ①②③⑧ เป็น live เสมอ

### ตัดออกจากของเดิม

- KPI `usersTotal` / `usersActive` / `rolesTotal` — ไม่ใช่ข้อมูลตัดสินใจของหัวหน้า (ข้อมูลนี้ยังดูได้ที่หน้า Access Control)
- Audit timeline ดิบ — ผู้บริหารไม่อ่าน log ทีละบรรทัด ถูกแทนด้วย ②
- Donut "สัดส่วนสถานะ" — บอกว่างานกระจายตัวยังไง แต่ไม่บอกว่าต้องทำอะไร ถูกแทนด้วย ③ (คอขวด)

## Drill-down

ทุกการ์ดและทุกแถวคลิกได้ → ไปหน้า `/petitions?highlight=<id1,id2,…>`

- `/petitions` เมื่อพบ `highlight` จะ **ปักหมุดใบที่ไฮไลท์ไว้บนสุด** เป็นกลุ่มพื้นเหลือง แล้วตามด้วยลิสต์เต็มที่ paginate ตามปกติด้านล่าง (ลิสต์ไม่ถูกกรอง)
- ดึงใบที่ไฮไลท์ด้วย filter ใหม่ `GET /petitions?ids=<id1,id2,…>`
- มี chip "ไฮไลท์ N รายการจากแดชบอร์ด · ล้าง" — กดล้างแล้วกลับเป็นลิสต์ปกติ
- ใบที่ไฮไลท์ซึ่งบังเอิญอยู่ในหน้าปัจจุบันด้วย ได้พื้นเหลืองเช่นกัน

เหตุผลที่ต้องปักหมุด: `/petitions` เป็น server-paginated ถ้าไฮไลท์เฉย ๆ แถวที่คลิกมาอาจอยู่หน้า 3 แล้วหัวหน้าไม่เห็นอะไรเลย

## File structure

| ไฟล์ | หน้าที่ |
|---|---|
| `server/lib/execSummary.js` + `.test.js` | pure — overdue / at-risk / bottleneck / turnaround / quality / workload / throughput จาก array ที่รับเข้ามา |
| `server/lib/qcParamBaseline.js` + `.test.js` | pure — ค่าเฉลี่ยต่อ parameter จากใบที่ปิดแล้ว (+ กฎ min 3 ใบ) |
| `server/routes/petitions.js` | route `GET /petitions/exec-summary?days=` (+ cache), filter `?ids=` |
| `src/lib/execSummary.ts` | type ของ response + ตัวจัดรูปแบบเวลา (เช่น `6 ชม. 20 น.`) |
| `src/hooks/useExecSummary.ts` | React Query + state ของช่วงเวลา |
| `src/components/dashboard/exec/` | `AlertStrip`, `ActionQueue`, `BottleneckBars`, `TurnaroundChart`, `ThroughputChart`, `QualityPanel`, `TeamWorkloadPanel`, `StockStrip`, `ExecDashboard` |
| `src/lib/dashboardProfiles.ts` | `admin` profile ชี้ไป layout `exec` |
| `src/pages/RoleDashboard.tsx` | `admin` → `<ExecDashboard/>` (profile อื่นไม่แตะ) |
| `src/pages/PetitionListPage.tsx` | รองรับ `?highlight=` |

## Error handling

- endpoint ล้มเหลว → แต่ละบล็อกแสดง skeleton แล้วขึ้นข้อความ "โหลดข้อมูลไม่สำเร็จ · ลองใหม่" ไม่ทำให้ทั้งหน้าพัง
- `days` ที่ไม่ใช่ 7/30/90 → server ปัดเป็น 30 (ไม่ error)
- petition ที่ข้อมูลเวลาไม่ครบ (เช่น `labReceivedAt` หาย) → ข้ามจากการคำนวณ turnaround ของด่านนั้น ไม่ทำให้ค่าเฉลี่ยเพี้ยนเป็น NaN
- ไม่มีงานเลยในช่วง → กราฟแสดง empty state ("ไม่มีข้อมูลในช่วงนี้") ไม่ใช่กราฟเปล่า
- `highlight` ที่มี id ไม่มีจริง → ข้าม ไม่ error

## Testing

**Jest (server, pure):** เกินพอดี (elapsed = baseline → ไม่ overdue) · เกินนิดเดียว · ยังไม่ assign เกิน 24 ชม. · parameter มีประวัติ < 3 ใบ → ไม่มี baseline · petition ที่ timestamp ขาด · turnaround p90 · rework ที่ตีกลับสองรอบ

**Vitest (frontend):** AlertStrip แสดงตัวเลขจาก response ถูก · ActionQueue เรียงเกินมากสุดก่อน · ลิงก์ drill-down มี `highlight` ครบทุก id · `PetitionListPage` ปักหมุดใบที่ไฮไลท์ไว้บนสุดและใส่พื้นเหลือง · period switcher เปลี่ยนเฉพาะบล็อกสถิติ

## Dependencies

- ช่อง **"งานด่วน"** ในแถบ ALERT อ่านจาก `petition.priority === 1` ซึ่งมาจากงาน dashboard-urgent-priority (`docs/superpowers/plans/2026-07-13-dashboard-urgent-priority.md`) ที่กำลังทำอยู่ใน worktree เดียวกัน ถ้างานนั้นยังไม่ลง ให้ตัดช่องนี้ออกจากแถบ ALERT ก่อน แล้วค่อยเติมทีหลัง — ไม่ต้อง implement `priority` ซ้ำ

## Open risks

- **QC baseline เป็นค่าประมาณ** — ได้จากประวัติ ไม่ใช่มาตรฐานที่ตั้งไว้ ถ้าที่ผ่านมาทีมช้าอยู่แล้ว baseline ก็จะช้าตาม UI ต้องกำกับให้ชัดว่าเป็น "ค่าเฉลี่ยย้อนหลัง" ไม่ใช่ "เป้าหมาย" · ถ้าอนาคตอยากได้เป้าหมายจริง ค่อยเพิ่มตาราง SLA ทีหลัง (endpoint รองรับได้โดยไม่ต้องรื้อ)
- **Lab baseline = ผลรวม** สมมติว่าทำเรียงกัน ถ้าจริง ๆ รันหลายเครื่องขนานกัน ตัวเลขจะหลวมเกินไป (งานเกินจริงแต่ไม่ถูกจับ) — ถ้าเจอปัญหานี้ค่อยสลับเป็น `max`, เปลี่ยนที่เดียวใน `execSummary.js`
- **เวลาจริง 24 ชม.** ทำให้งานที่ส่งเย็นวันศุกร์ดูเกินเวลาเสมอในเช้าวันจันทร์
