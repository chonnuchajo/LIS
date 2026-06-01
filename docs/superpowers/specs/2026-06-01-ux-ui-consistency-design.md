# UX/UI Consistency Pass — Design Spec

วันที่: 2026-06-01
สถานะ: รอผู้ใช้รีวิว

## เป้าหมาย

ทำให้ทุกหน้าของ LIS "ใช้ง่าย" และหน้าตาสม่ำเสมอ โดย**ไม่เปลี่ยน flow / logic / เส้นทาง (route) / การเรียก API เดิม** — เปลี่ยนเฉพาะชั้นการแสดงผล (presentation) เท่านั้น

จาก feedback ผู้ใช้ จัดลำดับ 3 ปัญหาหลัก:
1. **ฟอร์ม/ตารางใช้ยาก**
2. **หน้าตาไม่สม่ำเสมอ** (แต่ละหน้าวาง layout/สไตล์ปุ่มไม่เหมือนกัน)
3. **หาเมนูไม่เจอ** (เมนู flat 21 รายการเรียงยาว)

## หลักการ / ข้อจำกัด

- **ห้ามแตะ flow**: ไม่เปลี่ยนลำดับขั้นตอน, ปุ่ม submit เดิมทำงานเดิม, route เดิม, payload เดิม
- ทำ **ทีละหน้า** ตามลำดับความสำคัญ + เทสต์ก่อนไปต่อ (ย้อนกลับได้)
- ใช้ของเดิมที่มี: shadcn/ui (`src/components/ui/`), `AppLayout`, Tailwind tokens (`lis.*`)
- ภาษา UI ส่วนใหญ่เป็นไทย — คงไว้

## แนวทางที่เลือก: A — สร้างคอมโพเนนต์กลางก่อน แล้วย้ายทีละหน้า

สร้างชุดคอมโพเนนต์/มาตรฐานกลางชุดเล็ก แล้วทยอย refactor แต่ละหน้าให้มาใช้ของกลาง ทุกหน้าจึงได้มาตรฐานเดียวกันอัตโนมัติ ความเสี่ยงต่ำเพราะไม่แตะ logic

## องค์ประกอบที่จะสร้าง (ของกลาง)

ทั้งหมดอยู่ใต้ `src/components/lis/` (โดเมน) หรือ `src/components/ui/` (primitive) ตามความเหมาะสม

### 1. Navigation — เมนูจัดกลุ่ม + ค้นหา (`AppSidebar.tsx`)
- จัดกลุ่ม `NAV_ITEMS` เป็นหมวด (เพิ่ม field `group` ใน `navItems.ts`):
  - **ภาพรวม**: หน้าแรก, Lab Dashboard, QC Dashboard
  - **งานคำร้อง**: รายการคำร้อง, Assign คำร้อง
  - **การทดสอบ**: ทดสอบ QC, ทดสอบ Lab, ผลวิเคราะห์, อนุมัติผล QC, การบันทึก Standard, Daily Check
  - **คลัง & รายงาน**: Stock Management, รายงานสรุป
  - **ตั้งค่า & ข้อมูลหลัก**: Master Item, Simple Method, Standard Config, รายการเครื่อง, Admin Data, พารามิเตอร์ตรวจสอบ, Access Control, ตั้งค่าระบบ
- หัวข้อหมวดพับ/กางได้ (จำสถานะใน localStorage)
- **ช่องค้นหาเมนู** ด้านบน: พิมพ์แล้ว filter รายการเมนูแบบ realtime (เทียบกับ label/path)
- คงการกรองสิทธิ์ด้วย `useCanAccessPath` เหมือนเดิม

### 2. `PageHeader` — หัวหน้ามาตรฐาน
Props: `title`, `description?`, `actions?` (ReactNode สำหรับปุ่มหลักมุมขวา), `breadcrumbs?`
- เส้นคั่นล่าง, title/description ขนาดมาตรฐาน, ปุ่มหลักชิดขวา

### 3. `PageToolbar` — แถบค้นหา/ฟิลเตอร์
Props: `search?` (ค่า+onChange+placeholder), `filters?` (ReactNode), `right?`
- วางตำแหน่งเดิมทุกหน้า

### 4. `DataTable` wrapper — ตารางพร้อมสถานะ
- หัวตาราง sticky, แถวสลับสี (zebra), hover, คลิกทั้งแถวได้ (ถ้ามี onRowClick)
- รับ state: `isLoading` → skeleton rows, `isError` → ข้อความ error + ปุ่มลองใหม่, ว่าง → empty state (ข้อความ + ปุ่ม action ถ้ามี)
- ใช้ `Table` ของ shadcn เดิมข้างใน

### 5. `FormShell` + `StickyActionBar`
- `FormSection` (หัวข้อกลุ่ม + ฟิลด์), layout ป้ายกำกับ + `*` ช่องบังคับ
- `StickyActionBar`: แถบปุ่มบันทึก/ยกเลิกติดล่าง, รองรับ `isSaving` (disable + "กำลังบันทึก..."), กันกดซ้ำ
- inline validation: แสดง error ใต้ field ที่ผิด (ใช้รูปแบบเดียวทุกฟอร์ม)

### 6. มาตรฐาน primitive
- **ปุ่ม**: ลำดับชัด — primary (เขียว lis), secondary/outline, destructive (แดง) ใช้ `Button` variant เดิมแต่กำหนดแนวทางการใช้
- **Badge สถานะ**: รวม mapping สี (ใช้ `PETITION_STATUS_CONFIG` ที่มีอยู่เป็นต้นแบบ) ให้ทุกหน้าใช้ helper เดียว
- **Loading/Empty/Error**: คอมโพเนนต์ `EmptyState`, `ErrorState`, `TableSkeleton` ใช้ซ้ำ
- ระยะห่าง/ตัวอักษร: กำหนด spacing scale มาตรฐานบน PageHeader/Toolbar/section

## ลำดับการย้ายหน้า (priority)

1. **โครงสร้างกลาง** (nav + components ทั้งหมดข้างบน) — ทำก่อน
2. **คำร้อง**: PetitionListPage, PetitionNewPage, PetitionEditPage, PetitionDetailPage, PetitionAssignPage
3. **การทดสอบ**: LabTestingPage/DetailPage, QCTestingPage/DetailPage, QCApproval, RecordResults
4. **Stock**: Stock, StockDeduction
5. **ที่เหลือ**: DailyCheck, Report, Dashboards, Home, Master/Simple/Standard/Parameter/Machines/AdminData/AccessControl/Settings

แต่ละหน้า: refactor เปลือก → `npx tsc --noEmit` → เทสต์ flow (manual + playwright ถ้ามี) → ไปหน้าถัดไป

## การทดสอบ

- `npx tsc --noEmit` หลังทุกหน้า
- `npm run test` (vitest) — logic helpers ต้องไม่พัง
- Playwright smoke ของ flow หลัก (สร้างคำร้อง, assign, บันทึกผล) — ยืนยันว่ากดแล้วทำงานเหมือนเดิม
- ตรวจ responsive (mobile drawer ยังทำงาน)

## นอกขอบเขต (YAGNI)

- ไม่เปลี่ยน data model / API
- ไม่เพิ่มฟีเจอร์ใหม่ (เช่น command palette เต็มรูปแบบ — ใช้แค่ search เมนูธรรมดา)
- ไม่ทำ dark mode ใหม่ / ธีมสี (ใช้ token เดิม)
- ไม่ refactor logic ที่ไม่เกี่ยวกับการแสดงผล
