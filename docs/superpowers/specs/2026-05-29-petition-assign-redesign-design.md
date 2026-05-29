# Petition Assign Page Redesign

วันที่: 2026-05-29
ไฟล์ที่แก้: `src/pages/PetitionAssignPage.tsx`

## เป้าหมาย

ปรับหน้า `/LIS/petitions/assign` ให้ตรงกับสเก็ตช์ของผู้ใช้ — แสดงชื่อสาร, เลขตัวอย่าง,
และกล่องเลือกเครื่องแบบ 1 กล่อง/เครื่อง เรียงแนวนอนต่อสาร

## โครงสร้างตาราง (1 แถว = 1 คำร้อง — คงเดิม)

| คอลัมน์ | เนื้อหา |
|---------|---------|
| เลขที่คำร้อง | `petitionNo` (คลิกได้) + บรรทัดเล็ก "ผู้ยื่น: ชื่อ · แผนก" |
| ชื่อสาร | `commonName` ของแต่ละ substance group — หลายสารซ้อนเรียงกัน |
| ตัวอย่าง | `seq` ของ item ในกลุ่ม join ด้วย `+` เช่น `1+2` — ซ้อนตรงกับชื่อสาร |
| สถานะ | badge สถานะ (+ Phase 2 badge ถ้ามี) — คงเดิม |
| เจ้าหน้าที่ | dropdown เลือกพนักงาน — คงเดิม |
| เครื่อง | ต่อสาร: กล่องเลือกเครื่องเรียงแนวนอน 1 กล่อง/instrument |
| บันทึก | ปุ่ม Assign — คงเดิม |

คอลัมน์ ชื่อสาร / ตัวอย่าง / เครื่อง iterate `groupsByPetition` ในลำดับเดียวกัน
จัด vertical rhythm ให้ตรงกัน (border-b + min-height คงที่) เพื่อให้แต่ละสารอยู่บรรทัดเดียวกันข้ามคอลัมน์

## กล่องเลือกเครื่อง (เปลี่ยนหลัก)

- จำนวนกล่องต่อสาร = จำนวน instrument ที่ simple method กำหนด (GC/HPLC)
- 1 กล่อง = 1 instrument, label "เครื่องที่ N" + badge instrument (GC/HPLC)
- **single-select**: แต่ละกล่องเลือกได้ 1 เครื่อง (เปลี่ยนจาก multi-select checkbox เดิม)
- เลือกซ้ำ = ยกเลิก; เลือกใหม่ = แทนที่เครื่องเดิมของ instrument นั้น
- เรียงแนวนอนคั่นด้วย `+` (ตามสเก็ตช์)
- กรองเครื่องตาม `machineInstrument()` (ชื่อขึ้นต้น GC/HPLC)
- สารที่ไม่มี method ใน simple method → แสดงกล่องเตือน + บล็อกปุ่ม Assign (คงพฤติกรรมเดิม)

## State

คง `machinesByPetition[petitionId][groupKey] = string[]` (machine ids)
เปลี่ยน toggle เป็น `setMachineForGroupInstrument()`:
- ลบเครื่องเดิมที่เป็น instrument เดียวกันออกก่อน แล้วค่อยเพิ่มตัวใหม่ (single-select per instrument)
- save logic เดิม (`getSelectedMachineIdsForGroup` → array → `assignedMachines`) ไม่ต้องแก้

## ไม่แตะ

- backend / API / schema
- logic Phase 2, tabs, search, KPI cards
- การบล็อก Assign เมื่อสารไม่มี simple method

## Addendum (แก้บั๊ก per-substance instrument)

พบว่า simple-method instruments เก็บเป็น **array ตามตำแหน่งสาร** (commonName split "+" →
`parseSubstances`) ไม่ใช่ set รวม โค้ดเดิม union เป็น Set + sort `['GC','HPLC']` ทำให้
GC โผล่ "เครื่องที่ 1" เสมอ และยุบกล่องถ้า 2 สารใช้เครื่องเดียวกัน

แก้เป็น **per-substance slot จริง**:
- `parseSubstances()` ใน assign page (เหมือน MasterItems) → 1 สาร = 1 slot = 1 กล่อง
- `commonNameToSlots`: positional `(Instrument|'')[]` merge slot-by-slot (first non-blank wins)
- query `/simple-methods` ไม่ filter ทิ้งค่าว่าง — map ค่าผิดเป็น `''` รักษา index
- state `machinesByPetition[pid][groupKey]` = array index ตาม slot (เครื่องต่อสาร)
- slot ที่ instrument = null → กล่องเตือน + บล็อก Assign

ผล: `PROPANIL 36% + ANILOFOS 18%` → เครื่องที่ 1 [HPLC] (PROPANIL) + เครื่องที่ 2 [GC] (ANILOFOS)
ดู memory `project_simple_method_positional`
