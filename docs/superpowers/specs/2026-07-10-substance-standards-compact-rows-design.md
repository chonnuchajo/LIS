# Design: เกณฑ์ต่อสารแบบแถวกะทัดรัด + ค้นหาในลิสต์ (SubstanceStandardsDialog)

วันที่: 2026-07-10
สถานะ: อนุมัติดีไซน์แล้ว (รอ review spec)

## ปัญหา / เป้าหมาย

Dialog **"ตั้งเงื่อนไขรายสาร"** (`SubstanceStandardsDialog`) ฝั่งขวา "เกณฑ์ต่อสาร (N)"
render ทุกสารเป็น **การ์ดหลายบรรทัด** (หัวการ์ด + แถวเงื่อนไข + ข้อความสรุปสีเขียว +
checkbox หัวหน้า QC) พร้อมกันทุกตัว เมื่อสารเยอะ (เช่น เพิ่มมาทั้งกลุ่ม 100+ ตัว)
ลิสต์ยาวมาก เลื่อนหาตัวที่จะแก้ลำบาก และ Radix `Select` ต่อการ์ดทำให้หนัก

ผู้ใช้ต้องการ: **สารละ 1 แถวกะทัดรัด แก้ inline ในแถวได้เลย** + **ช่องค้นหาเฉพาะของ
ลิสต์ฝั่งขวา** เพื่อหาตัวที่จะแก้ได้เร็ว

## แนวทางที่เลือก

restyle ในไฟล์เดิม (ไม่แยก component ใหม่) — แถวรายสารเป็น flex row เดียว, เปลี่ยน
dropdown เงื่อนไขเป็น `NativeSelect` (เบากว่าเมื่อมี 100+ แถว และใช้อยู่แล้วใน dialog นี้
ที่ตัวกรองหมวดหมู่), เพิ่ม state ค้นหาแยกสำหรับลิสต์ฝั่งขวา

## ขอบเขต

แก้ 2 ไฟล์: `src/components/lis/SubstanceStandardsDialog.tsx` +
`src/components/lis/SubstanceStandardsDialog.test.tsx`

**ไม่แตะ:** ฝั่งซ้าย (picker commonName/กลุ่ม/trade name), `SubstanceStandard` schema,
backend, logic ตรวจ abnormal, `ParameterSettings.tsx`, ปุ่มบันทึก/ยกเลิก

## รายละเอียด

### 1. แถวรายสาร (แทนการ์ดเดิม)

สารละ 1 แถว (`flex flex-wrap items-center gap-2` — จอแคบให้ wrap ลงบรรทัด ไม่ล้นแนวนอน):

- **ชื่อสาร** — `truncate` + `title` เห็นชื่อเต็มตอน hover (ความกว้างขั้นต่ำคงที่พอให้
  คอลัมน์ตรงแนวกัน)
- **เงื่อนไข** — `NativeSelect` h-8 (แทน Radix `Select`) options เดิมจาก
  `OPERATOR_OPTIONS` (ตัด `none` เหมือนเดิม)
- **ช่องค่า** — `Input type="number"` h-8 เดิม; ช่องที่ 2 โผล่เมื่อ operator เป็น
  `between`/`tolerance` (logic เดิมทุกอย่าง รวม placeholder)
- **checkbox "หน.QC"** — ป้ายสั้น + `title="ให้หัวหน้า QC พิจารณาเท่านั้น"`
  (ผูก `headOnly` เดิม)
- **ปุ่มคัดลอก ⧉ + ลบ 🗑** — icon button เดิม (`cloneAt` / `removeAt`)
- **ตัดข้อความสรุปสีเขียว** (`describeSubstanceStandard`) ออกจากแถว — ค่าเห็นตรงๆ
  ในแถวอยู่แล้ว; **หน่วย** ย้ายไปแสดงครั้งเดียวที่หัวลิสต์

### 2. หัวลิสต์ + ช่องค้นหาฝั่งขวา

- หัวลิสต์: `เกณฑ์ต่อสาร (120) · หน่วย: %` (แสดงส่วนหน่วยเฉพาะเมื่อ `field.unit` ไม่ว่าง)
- ช่องค้นหาเล็ก (h-9 ไอคอนแว่น — โครงเดียวกับช่องค้นหาฝั่งซ้าย) อยู่เหนือลิสต์
- state ใหม่ `listSearch` แยกจาก `search` ของฝั่งซ้าย; reset เป็น `""` ตอน dialog เปิด
  (ใน `useEffect(open)` เดิม)
- กรองตามชื่อสาร: `standardKey(std.substance).includes(standardKey(q))`
- ขณะกรอง หัวลิสต์แสดง `แสดง 5/120`; กรองแล้วว่างแสดงข้อความ "ไม่พบสารที่ค้นหา"

### 3. ⚠️ index ต้องเป็นของลิสต์เต็มเสมอ

`patchAt`/`removeAt`/`cloneAt` อ้างด้วย index ของ `list` เต็ม — เมื่อกรองแล้ว index
ของแถวที่แสดง ≠ index จริง จึง derive เป็น

```
visible = list.map((std, i) => ({ std, i })).filter(({ std }) => match(std, listSearch))
```

แล้ว render จาก `visible` โดยส่ง **`i` เดิม** เข้า `patchAt`/`removeAt`/`cloneAt`
(clone แทรกที่ `i+1` ของลิสต์เต็ม — พฤติกรรมเดิม; แถว clone จะแสดงทันทีเพราะชื่อสาร
เดียวกันย่อม match filter เดียวกัน)

### 4. การเพิ่มสารขณะกรองอยู่

เพิ่มจาก picker ฝั่งซ้ายยัง append ท้ายลิสต์เต็มเหมือนเดิม — ถ้าชื่อไม่ match `listSearch`
จะไม่แสดงจนกว่าจะล้างคำค้น (ยอมรับได้ ฝั่งซ้ายมี state ปุ่ม disabled/+ บอกอยู่แล้วว่า
เพิ่มสำเร็จ) ไม่ auto-clear คำค้นให้

## Testing

Vitest (`SubstanceStandardsDialog.test.tsx` — อัปเดต/เพิ่ม):

1. render แถวกะทัดรัด: ชื่อสาร + NativeSelect + ช่องค่า + checkbox หน.QC ครบ,
   ไม่มีข้อความสรุปสีเขียวแล้ว
2. operator `between`/`tolerance` โชว์ช่องค่าที่ 2
3. ค้นหาฝั่งขวากรองรายการถูกต้อง + ตัวนับ `แสดง x/y` + เคสไม่พบ
4. **ขณะกรองอยู่**: แก้ค่า/ลบ/คัดลอก ต้องโดนตัวที่ถูกต้องในลิสต์เต็ม (ไม่ใช่ตัวที่ index
   ชนกันหลังกรอง) — เคสหลักของ #3
5. toggle หน.QC แล้ว save ได้ค่า `headOnly` ถูกตัว
6. `npx tsc -p tsconfig.app.json --noEmit` ผ่าน (type-check จริงตาม convention repo)

Manual (browser): เปิด dialog กับ field ที่มีสารเยอะ → เลื่อน/ค้นหา/แก้ inline →
บันทึก → เปิดใหม่ค่าคงอยู่

## นอกขอบเขต (YAGNI)

- ไม่ทำ virtualization (NativeSelect + แถวเบาพอสำหรับหลักร้อยแถว)
- ไม่ทำ sort/จัดกลุ่มลิสต์ฝั่งขวา
- ไม่แตะ dialog เกณฑ์โหมดอื่น (Conditional / LabelTolerance)
- ไม่เปลี่ยน data model / API
