# หน้า "จัดการรายการสินค้า" (Master Item) — Redesign

วันที่: 2026-07-04
ไฟล์หลัก: `src/pages/MasterItems.tsx` (เฉพาะ default export `MasterItems` + detail dialog)

## เป้าหมาย

ออกแบบหน้ารายการสินค้าใหม่ให้เหมาะกับข้อมูล >1,000 รายการ: สะอาด เป็นระบบ ใช้งานง่าย
ไม่โชว์ข้อมูลยาวรวดเดียวทั้งหน้า เน้น UX สำหรับผู้ใช้ที่ต้อง **ค้นหา / แก้ไข / ตรวจสอบ**
สินค้าจำนวนมากเป็นประจำ สไตล์ Modern Admin Dashboard (ขาว/เทา/น้ำเงิน/เขียว)

## บริบทที่เกี่ยวข้อง (ของเดิม)

- ข้อมูล item มาจาก ERP webhook 2 แหล่ง merge กัน + override layer `MasterItemMeta`
  (route: `GET /master-items` merge, `PUT /master-item-meta/:itemNo` = upsert override)
- **แก้ไข / เพิ่ม / status** ทำผ่าน override layer ได้จริง (มี field `status: active|inactive`)
- item ของ ERP **ลบจริงไม่ได้** (sync กลับมา) — ตามที่ตกลง master item จะ**ไม่มีปุ่มปิดใช้งาน/ลบ**
- หน้าปัจจุบันมี: การ์ดสถิติ 3 ใบ, Export Excel/PDF, Sync Kg/Carton, จัดกลุ่ม,
  ตัวกรองกลุ่ม, คอลัมน์นับพารามิเตอร์, badge กลุ่ม, detail เป็น Dialog กลางจอ
- UI primitive พร้อม: `src/components/ui/sheet.tsx` (Drawer ขวา), `dropdown-menu.tsx` (เมนู ⋮)

## การตัดสินใจ (ยืนยันกับผู้ใช้)

1. **ลงโค้ดจริง** ใน `MasterItems.tsx` เลย (ไม่ทำ mockup ภาพก่อน)
2. **เก็บฟีเจอร์เดิม ย้ายที่**: ตาราง 6 คอลัมน์สะอาด; Export/Sync/จัดกลุ่ม → toolbar บน;
   พารามิเตอร์ + กลุ่ม → Detail Drawer
3. **เมนูจัดการ = ดูรายละเอียด + แก้ไข เท่านั้น** (ไม่มีปิดใช้งาน/ลบ)

## ดีไซน์

### โครง & หัวข้อ
- พื้นหลังเทาอ่อน; เนื้อหาในกล่องขาว `rounded-xl shadow-sm`
- หัวข้อ "รายการสินค้า" (ตัวหนา + ไอคอน) + บรรทัดรอง "ทั้งหมด X รายการ" (แทนการ์ดสถิติ)
- ขวาบน: ปุ่มหลัก "เพิ่มสินค้า" (น้ำเงิน) + "จัดกลุ่ม" (outline) + เมนู "⋯ เพิ่มเติม"
  (Export Excel / Export PDF / Sync Kg/Carton)

### แถบค้นหา/กรอง
- ช่องค้นหาใหญ่ — match เจาะจง **รหัส / ชื่อสินค้า (nameKeys) / ชื่อสามัญ (commonNameKeys)**
  (ไม่ใช่ค้นทั้ง JSON เหมือนเดิม)
- Select: หมวดหมู่ · สถานะ (ทั้งหมด/ใช้งาน/ปิดใช้งาน) · กลุ่ม (คงไว้) · จำนวนต่อหน้า **25/50/100**
- reset page เป็น 1 เมื่อเปลี่ยน search/filter (คงพฤติกรรมเดิม)

### ตารางหลัก (ตารางเดียว)
คอลัมน์ (6):
1. **รหัสสินค้า** — `text-primary font-semibold` คลิกได้ → เปิด Drawer
2. **รายละเอียดสินค้า** — ชื่อสินค้า (bold) + ชื่อสามัญ (`text-muted-foreground text-sm` ด้านล่าง);
   ถ้า inactive แสดง tag "ปิดใช้งาน" เล็ก
3. **ขนาดบรรจุ** — บรรทัดเดียว (`whitespace-nowrap`): `unitsPerCarton × measureSize measureUnit`
   เช่น "12 × 1 L"; fallback → raw packSize (`packSizeKeys`); ไม่มี → "-"
4. **จำนวนต่อลัง** — `unitsPerCarton` ชิดขวา `tabular-nums`
5. **น้ำหนักต่อลัง** — `kgPerCarton` (`weightKeys`) ชิดขวา `tabular-nums`
6. **จัดการ** — `DropdownMenu` ⋮ → ดูรายละเอียด (เปิด Drawer) · แก้ไข (เปิด dialog)

- หัวตาราง **sticky top** (scroll container สูงจำกัด); ทุกแถวสูงเท่ากัน (`h-14`), spacing โปร่ง
- คลิกแถว (นอกเมนู) = เปิด Drawer
- narrow → `overflow-x-auto` + `min-w-[720px]` เลื่อนแนวนอนได้; preview ไม่มี horizontal scroll ระดับ body
- สถานะ/พารามิเตอร์/กลุ่ม/extra fields ถอดจากตาราง → ไป Drawer

### Detail Drawer (`Sheet side="right"`, ~`w-[420px]`)
- หัว: รหัส (น้ำเงินใหญ่) + ชื่อสินค้า
- กลุ่มข้อมูล:
  - **หลัก**: ชื่อสินค้า, ชื่อสามัญ, ประเภท (classification), หมวดหมู่, หน่วย, สถานะ
  - **บรรจุ/น้ำหนัก**: ขนาดบรรจุ, จำนวนต่อลัง, น้ำหนักต่อลัง (kgPerCarton), Kg/Unit (grossKgPerUnit),
    `pack_level`, `pack_source`, `carton_unit`, `measure_size` (+ measureUnit)
  - **กลุ่มที่สังกัด**: group badges
  - **พารามิเตอร์ที่ตรงกับ item นี้**: list (ย้ายจากคอลัมน์ตาราง)
  - รายละเอียด (description) + ข้อมูลเพิ่มเติม (extraColumns)
- ท้าย: ปุ่ม "แก้ไข" → เปิด `MasterItemDialog`

### เพิ่ม/แก้ไข
- reuse `MasterItemDialog` เดิม (isEdit=false = เพิ่ม, เขียน override + best-effort webhook)

### สี
ขาว (กล่อง) · เทา (พื้น/ข้อความรอง) · น้ำเงิน (รหัส + ปุ่มหลัก) · เขียว (จุดสถานะ "ใช้งาน")

## ขอบเขต / ไม่แตะ

- แก้เฉพาะ component `MasterItems` (≈ บรรทัด 583–1139) + แทน `MasterItemDetailDialog`
  (2182–2328) ด้วย Sheet-based drawer; reuse `MasterItemDialog`
- **ไม่แตะ** backend, `SimpleMethodPage`, `MachinesPage`, data contract, snake-case aliases
  ที่ consumer อื่นอ่าน (PDO load planner ฯลฯ)

## Field mapping (ยืนยัน)

| คอลัมน์ UI | field |
|---|---|
| ขนาดบรรจุ | `unitsPerCarton` × `measureSize` `measureUnit` (fallback `packSizeKeys`) |
| จำนวนต่อลัง | `unitsPerCarton` |
| น้ำหนักต่อลัง | `kgPerCarton` (`weightKeys`) |
| Kg/Unit (drawer) | `grossKgPerUnit` |

## Non-goals

- ไม่ทำ virtualization (client-side pagination พอสำหรับ ~1,000 แถว/หน้า 25–100)
- ไม่เพิ่ม CRUD ลบจริงของ item ERP
