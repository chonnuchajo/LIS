# แถบ "รับเข้า" รวมศูนย์ใน Stock Management — Design

วันที่: 2026-06-08
สถานะ: รอ implementation

## ปัญหา / เป้าหมาย

ปัจจุบันการ "รับเข้า" stock กระจายอยู่ในปุ่มรายแถวของแต่ละหมวด (Standards / สารเคมี / เครื่องแก้ว)
คนรับของต้องไปหาหมวดและแถวรายการเองทุกครั้ง ต้องการ **แถบรับเข้ารวมศูนย์ที่เดียว**: เลือกหมวด →
เลือกรายการ → รับเข้า

## ขอบเขต

- เพิ่มแถบ (tab) ที่ 5 ชื่อ "รับเข้า" ในหน้า `src/pages/Stock.tsx` วางก่อนแถบ "ประวัติ"
- **ไม่สร้าง logic รับเข้าใหม่** — reuse dialog + API + การปริ้นลาเบล + การลง transaction ที่มีอยู่ทั้งหมด
- แถบนี้ทำหน้าที่เป็น selector (เลือกหมวด + เลือกรายการ) แล้วยิงเข้า dialog เดิม

นอกขอบเขต: ไม่แตะ backend, ไม่แตะ flow รับเข้าเดิมในแถบรายหมวด (ปุ่ม ⬇️ ในแถวยังอยู่)

## ดีไซน์

### โครงแถบ

```
[Standards] [สารเคมี] [เครื่องแก้ว] [รับเข้า] [ประวัติ]
```

แถบ "รับเข้า" = component ใหม่ `ReceiveTab` (อยู่ใน `Stock.tsx` เหมือน tab อื่น)

### เนื้อในแถบ

1. **เลือกหมวด** — ปุ่ม segmented 3 อัน: Standards / สารเคมี / เครื่องแก้ว
   - default = **Standards**
2. **ตัวกรอง + ค้นหา** — ช่องค้นหา (code/ชื่อ) + ปุ่มกรอง "เฉพาะใกล้หมด/หมด"
3. **ลิสต์รายการ** ในหมวดที่เลือก แต่ละแถวมี:
   - code/ชื่อ
   - badge สถานะ stock: `ปกติ` / `ใกล้หมด` / `หมด` (+ `หมดอายุ`/`ใกล้หมดอายุ` สำหรับ Standards)
   - ปุ่ม "รับเข้า"
4. กด "รับเข้า" ที่รายการใด → เปิด dialog เดิมตามหมวด:
   - **Standards** → `ReceiveBottlesDialog` (รายขวด: lot/ขนาด/EXP/ที่มา + ปริ้นลาเบล)
   - **สารเคมี** → `SimpleMoveDialog` mode="receive" + `api.receiveSolvent`
   - **เครื่องแก้ว** → `SimpleMoveDialog` mode="receive" + `api.receiveGlassware`
5. หลังรับเข้าสำเร็จ → invalidate query: หมวดนั้น + `["stock","units"]` + `["stock","transactions"]`
   (ตรงกับพฤติกรรมเดิมของแต่ละ dialog)

### แหล่งข้อมูล (reuse query เดิม ทั้งหมด cache อยู่แล้ว)

- Standards: `useQuery(["stock","standards"], api.getStandards)`
- Units (ใช้คำนวณสถานะ Standards): `useQuery(["stock","units"], api.getStockUnits)`
- สารเคมี: `useQuery(["stock","solvents"], api.getSolvents)`
- เครื่องแก้ว: `useQuery(["stock","glassware"], api.getGlassware)`

### เกณฑ์สถานะ (ใช้ค่าคงที่เดิมในไฟล์)

- **Standards** — คำนวณจาก `summarizeUnits(units ของ code นั้น)`:
  - `หมด` = sealed+working === 0
  - `ใกล้หมด` = 0 < sealed+working <= `LOW_STD_QTY` (=1)
  - `หมดอายุ` / `ใกล้หมดอายุ` จาก `sum.expired` / `sum.expiringSoon`
  - `ปกติ` = นอกเหนือจากนั้น
- **สารเคมี** — `qty < LOW_SOL_QTY` (=3) → ใกล้หมด; `qty === 0` → หมด
- **เครื่องแก้ว** — `qty < LOW_GLASS_QTY` (=5) → ใกล้หมด; `qty === 0` → หมด

ตัวกรอง "เฉพาะใกล้หมด/หมด" = แสดงเฉพาะรายการที่เข้าเกณฑ์ใกล้หมดหรือหมด (รวมหมดอายุ/ใกล้หมดอายุของ Standards)

## โครงสร้างโค้ด

- ไฟล์เดียว: `src/pages/Stock.tsx`
- เพิ่ม component `ReceiveTab` (state: `category`, `search`, `lowOnly`, `selected` สำหรับเปิด dialog)
- reuse `ReceiveBottlesDialog` (import เดิม), `SimpleMoveDialog` (local ในไฟล์), `summarizeUnits`,
  ค่าคงที่ `LOW_STD_QTY/LOW_SOL_QTY/LOW_GLASS_QTY`
- เพิ่ม `<TabsTrigger value="receive">รับเข้า</TabsTrigger>` + `<TabsContent value="receive"><ReceiveTab/></TabsContent>`

## Testing

- type-check ผ่าน (`npx tsc -p tsconfig.app.json` — คำสั่งจริงตาม memory)
- ตรวจ manual บน localhost:
  - แถบ "รับเข้า" โผล่ default Standards
  - เลือกหมวดสลับได้ ลิสต์เปลี่ยนตาม
  - ค้นหา + กรอง "ใกล้หมด/หมด" ทำงาน
  - กดรับเข้า Standards → ReceiveBottlesDialog เปิด รับเข้าได้ ลิสต์/สถานะอัปเดต
  - กดรับเข้าสารเคมี/เครื่องแก้ว → SimpleMoveDialog (receive) เปิด รับเข้าได้ qty อัปเดต
  - ลง transaction + badge สถานะ refresh หลังรับเข้า

## ความเสี่ยง

ต่ำ — ไม่แตะ backend, ไม่แตะ dialog/API เดิม, แค่ห่อ selector รอบของที่ทดสอบแล้ว
