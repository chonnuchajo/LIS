# Lab Analyze Dashboard Worklist Design

## Goal

ปรับ dashboard ของ role `lab-analyze` ให้เน้นงานที่นักวิเคราะห์ต้องทำจริงในหน้าเดียว โดยไม่กระทบ dashboard role อื่น

## Scope

- ใช้เฉพาะ profile `lab-analyze`
- ไม่แก้ production build flow และไม่รันคำสั่ง build
- ใช้ข้อมูลคำขอจาก dashboard dataset เดิม
- ไม่เปลี่ยน flow หน้า `/lab-testing` หรือหน้าอนุมัติอื่น

## User-Facing Changes

1. เปลี่ยนหัวตารางจาก `ต้องดำเนินการ` เป็น `งานที่กำลังดำเนินการ`
2. ตารางแสดงงานตาม KPI ที่เลือกในหน้า dashboard:
   - `งานของฉัน`: คำขอล่าสุดที่ถูก assign ให้ user ปัจจุบันและยังไม่ส่งผล Lab
   - `กำลังดำเนินการ`: งานของ user ปัจจุบันที่รับไปแล้วและยังไม่ส่งผล Lab
   - `เสร็จวันนี้`: งานของ user ปัจจุบันที่ส่งผล Lab ในวันปัจจุบัน
3. ตารางแสดง 4 คำขอต่อหน้า และมีปุ่มลูกศรเพื่อไปหน้าก่อนหน้า/หน้าถัดไป
4. เอา KPI `งานตีกลับ` ออกจาก `lab-analyze`
5. ลบส่วน `สถานะงานของฉัน` และ `กิจกรรมล่าสุด` ออกจาก `lab-analyze`
6. ฝั่งขวาของตารางเปลี่ยนจาก pie chart เป็น bar แนวนอนแสดงจำนวนงานของ user ปัจจุบันที่ถูก assign ตามวันในสัปดาห์
7. chart แสดงวันจันทร์ถึงเสาร์เป็นค่า default และแสดงวันอาทิตย์เฉพาะเมื่อมีงานที่ถูก assign ในวันอาทิตย์

## Data Rules

- งานที่ถือว่าเป็น `งานของฉัน` ต้อง match user ปัจจุบันด้วย `assignedTo.employeeId` หรือ fallback เป็น `assignedTo.name`
- งานที่ `กำลังดำเนินการ` ใช้ status `inProgress`, มีข้อมูลรับงานฝั่ง Lab, และยังไม่มี `labCompletedAt`
- งานที่ `เสร็จวันนี้` ใช้คำขอที่มี `labCompletedAt` อยู่ในวันปัจจุบัน
- สถานะในตารางของ `lab-analyze` ต้องใช้สถานะ track Lab เช่น `Lab กำลังตรวจ` หรือ `Lab ตรวจครบ · รออนุมัติ` ไม่ใช้ label รวม `QC กำลังตรวจ`
- การเรียงรายการ:
  - `งานของฉัน`: เรียงจาก assigned ล่าสุดก่อน โดยใช้ `assignedTo.assignedAt`, fallback `receivedAt`, `sampleSentAt`, `createdAt`
  - `กำลังดำเนินการ`: เรียงจาก assigned/รับงานล่าสุดก่อน
  - `เสร็จวันนี้`: เรียงจากเวลาเสร็จล่าสุดก่อน
- assignment chart ใช้ `assignedTo.assignedAt` เป็นหลัก และ fallback เป็น `receivedAt`, `sampleSentAt`, `createdAt` เพื่อรองรับข้อมูลเก่า

## Implementation Shape

- เพิ่ม helper ใน `src/lib/dashboardMetrics.ts` สำหรับ:
  - filter/sort รายการ lab worklist ตาม tab
  - paginate รายการ 4 รายการต่อหน้า
  - สร้างข้อมูล assignment-by-weekday สำหรับ horizontal bar chart
- เพิ่ม test ใน `src/lib/dashboardMetrics.test.ts` สำหรับ filter, sort, pagination, และ Sunday visibility rule
- ปรับ `src/lib/dashboardProfiles.ts` ให้ `lab-analyze.kpis` ไม่รวม `returnedTotal` และไม่ใช้ analytics/activity ที่ถูกลบ
- ปรับ `src/pages/RoleDashboard.tsx` ให้ branch เฉพาะ `lab-analyze`:
  - click KPI เปลี่ยน worklist filter แทนการ navigate
  - ซ่อน analytics section แบบด้านล่างและ `ActivityTimeline`
  - แสดง assignment horizontal bar ด้านขวา
- ปรับ `src/hooks/useDashboardData.ts` ให้ KPI `งานของฉัน` นับด้วยกฎ assignee เดียวกับ worklist
- ปรับ `src/components/dashboard/ActionTable.tsx` แบบ backward-compatible ให้รองรับ title, rows override, pagination, และ action path สำหรับ lab dashboard โดยไม่ทำให้ role อื่นเปลี่ยนพฤติกรรม

## Testing

- Unit tests: `npm run test -- src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts`
- Typecheck: `npx tsc --noEmit`
- ไม่รัน build ตาม AGENTS.md

## Out of Scope

- ไม่เปลี่ยน API server
- ไม่เปลี่ยน seed data
- ไม่เปลี่ยน dashboard ของ admin, qc, lab-head, lab-config, lab-inventory, viewer
- ไม่เปลี่ยนสิทธิ์การเข้าถึงหรือ routing ของหน้าอื่น
