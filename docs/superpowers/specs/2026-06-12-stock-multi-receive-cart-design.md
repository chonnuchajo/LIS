# Stock Multi-Receive Cart — Design Spec

วันที่: 2026-06-12
สถานะ: รอ user review

## ปัญหา

แท็บ "รับเข้า" ในหน้า Stock (`src/pages/Stock.tsx` → `ReceiveTab`) ปัจจุบันเป็น
ตารางรายการ ผู้ใช้ต้องกดปุ่ม "รับเข้า" ทีละแถว เปิด dialog ทีละรายการ การรับเข้า
ของหลายอย่างในคราวเดียวจึงช้าและน่าเบื่อ (ต้องค้น-เลือก-กรอก-ปิด ซ้ำทุกตัว)

## เป้าหมาย

แทนที่ตารางด้วย **ฟอร์มตะกร้า (cart)** อันเดียวที่รับเข้าได้หลายรายการรวดเดียว
ครอบทั้ง 3 หมวด (Standards / สารเคมี / เครื่องแก้ว) โดยไม่ต้องเปิด dialog ทีละตัว

## ขอบเขต (ทำ / ไม่ทำ)

**ทำ:**
- ฟอร์มตะกร้าเพิ่มรายการทีละแถว เลือกของจาก combobox ค้นหาได้
- รองรับทั้ง 3 หมวดในฟอร์มเดียว ฟิลด์ปรับตามหมวด
- Standard: สร้างรายขวด (StockUnit) จริง + ปริ้นลาเบลต่อขวด (ของเดิมมีอยู่แล้ว)
- สารเคมี: บวก qty (ของเดิม) + ปริ้นสติกเกอร์ N ใบตามจำนวน
- เครื่องแก้ว: บวก qty (ของเดิม) ไม่มีลาเบล
- submit แบบ loop ฝั่ง client เรียก API เดิม (แนวทาง A — ไม่แตะ backend)

**ไม่ทำ (อยู่นอกขอบเขต feature นี้):**
- ไม่ยกระบบ solvent ให้เป็นรายขวด (StockUnit) — stock solvent ยังเป็นตัวเลข qty
- ไม่ทำให้ QR สติกเกอร์สารเคมีสแกนแล้วเปิด dialog แบ่ง/ทิ้งได้ (solvent ไม่มี
  per-bottle unit ให้ scanner resolve) — เป็นเฟสถัดไปถ้าต้องการ
- ไม่ทำ backend batch endpoint / transaction (ไม่ atomic โดยตั้งใจ)
- ไม่แตะปุ่ม "รับเข้า" รายแถวในแท็บ Standards/สารเคมี/แก้ว — คงไว้เหมือนเดิม

## แนวทางที่เลือก: A — loop ฝั่ง client

submit ตะกร้าโดยวนทีละแถว เรียก API per-item ที่มีอยู่แล้ว
(`receiveStockUnits`, `receiveSolvent`, `receiveGlassware`) ไม่ต้องแก้ backend
ข้อแลกเปลี่ยน: ไม่ atomic — ถ้าแถวกลางๆ fail แถวก่อนหน้าที่สำเร็จไปแล้วไม่ย้อนกลับ
ชดเชยด้วยการรายงานผลรายแถวชัดเจน + เก็บแถวที่ fail ไว้ให้ retry

## โครงสร้าง UI

แท็บ "รับเข้า" = `<ReceiveCart/>` (แทน `<ReceiveTab/>` เดิม) เป็นฟอร์มล้วน
ตัดแบนเนอร์ "ใกล้หมด/หมด" ออก (สถานะยังดูได้ในแท็บหมวดอยู่แล้ว)

```
┌─ รับเข้า stock ─────────────────────────────┐
│  [+ เพิ่มแถว]                                  │
│  ┌─ แถว (สารเคมี) ─────────────────────  [×] ┐│
│  │ [เลือกของ ▼ ค้นหา...]   หมวด: สารเคมี      ││
│  │ จำนวน[__] ขนาด[__] lot[__] EXP[__] note[_]││
│  └───────────────────────────────────────────┘│
│  ┌─ แถว (Standard) ────────────────────  [×] ┐│
│  │ [STD-001 Methanol ▼]    หมวด: Standard     ││
│  │ ที่มา(primary/supply)  lot[__]  ขนาด[__]ml ││
│  │ จำนวนขวด[__]  ☑EXP เท่ากัน  EXP[____]      ││
│  │   └ ถ้าไม่เท่ากัน: กาง EXP รายขวด           ││
│  └───────────────────────────────────────────┘│
│  ┌─ แถว (เครื่องแก้ว) ─────────────────  [×] ┐│
│  │ [Beaker 250ml ▼]   จำนวน[__] note[_]      ││
│  └───────────────────────────────────────────┘│
│  ☑ ปริ้นลาเบลหลังรับเข้า                       │
│              [ รับเข้าทั้งหมด (3 รายการ) ]    │
└───────────────────────────────────────────────┘
```

### Item picker (combobox)

- Popover + Command (shadcn) ค้นหาด้วย code/ชื่อ
- จัดกลุ่ม 3 หมวด: Standards (โชว์ code+ชื่อ), สารเคมี (ชื่อ), เครื่องแก้ว (ชื่อ)
- เลือกแล้วแถวนั้น lock หมวด + แสดงฟิลด์ตามหมวด
- กันเลือกซ้ำในแถวอื่นได้ (ไม่บังคับ — ปล่อยให้ซ้ำได้ เพราะอาจรับ lot ต่างกัน)

### ฟิลด์รายแถว ตามหมวด

| หมวด | ฟิลด์ | ค่า default |
|------|------|------------|
| Standard | source (primary/supply), lotNo, sizeMl, count, sameExp+commonExp / perExp[] | source=primary, sizeMl=100, count=1, sameExp=true |
| สารเคมี | qty, sizeLabel (ขนาด/ขวด เป็น text เช่น "2.5 L"), lotNo, exp, note | qty=1 |
| เครื่องแก้ว | qty, note | qty=1 |

## Data flow / submit

```
onSubmit:
  rows.forEach validate → ถ้ามี row ไม่ผ่าน ยกเลิกทั้งชุด toast บอกแถวที่ผิด
  results = []
  for (row of rows) sequentially:
    try:
      if standard:
        bottles = sameExp ? repeat(commonExp, count) : perExp.slice(0,count)
        created = await api.receiveStockUnits(row.itemId,
                    { lotNo, sizeMl, unit:'ml', source, bottles })
        if printAfter: labelHtmls.push(...created.map(buildStockLabelHtml))
      if solvent:
        note2 = compose(note, lotNo, exp, sizeLabel)   // ยัด lot/exp ลง note
        await api.receiveSolvent(row.itemId, { qty, note: note2 })
        if printAfter: labelHtmls.push(
            ...repeat(buildSolventLabelHtml({name,code:_id,lotNo,exp,sizeLabel}), qty))
      if glassware:
        await api.receiveGlassware(row.itemId, { qty, note })
      results.push({ row, ok:true })
    catch e:
      results.push({ row, ok:false, error:e.message })
  // ปริ้นท้ายสุด (ไม่ให้ error ปริ้นทำ receive ล้ม — already received)
  for (html of labelHtmls) try await api.printDocument({docType:'stock-label', html})
  toast: "รับเข้าสำเร็จ X / ล้มเหลว Y"
  ลบแถวที่ ok ออก เก็บแถวที่ fail ไว้
  qc.invalidateQueries: ['stock','units'], ['stock','solvents'],
                        ['stock','glassware'], ['stock','transactions']
```

หมายเหตุ: ลำดับ sequential (await ทีละตัว) เพื่อความง่ายในการ track ผลรายแถว
และเลี่ยงยิง request พรึบเดียว

## ลาเบลสารเคมี (ใหม่)

`buildSolventLabelHtml(payload)` ใน `src/lib/stockLabel.ts`:
- รับ payload ธรรมดา (ไม่ต้องมี StockUnit): `{ name, idForQr, lotNo, exp, sizeLabel }`
- QR encode `idForQr` = `_id` ของสารเคมี (บอกว่าเป็นสารตัวไหน)
- ขนาด/ฟอร์แมตสติกเกอร์ใช้แนวเดียวกับ `buildStockLabelHtml` (docType `stock-label`
  → เข้าเครื่องพิมพ์ลาเบลตัวเดิม) ดู gotcha สีดำล้วน (thermal) ด้วย
- ทุกใบของสารตัวเดียวกัน QR เหมือนกัน (เพราะ encode ตัวสาร ไม่ใช่รายขวด)
- ข้อจำกัดที่รับทราบ: scanner ในแอป (`api.getStockUnit`) จะ resolve QR นี้ไม่เจอ
  เพราะไม่มี StockUnit — สแกนแล้วยังเปิด dialog แบ่ง/ทิ้งไม่ได้ (เป็นเฟสถัดไป)

## ไฟล์ที่แตะ

- **ใหม่** `src/components/lis/stock/ReceiveCart.tsx` — ฟอร์มตะกร้า + submit loop
- `src/lib/stockLabel.ts` — เพิ่ม export `buildSolventLabelHtml`
- `src/pages/Stock.tsx`:
  - แท็บ `receive` render `<ReceiveCart/>` แทน `<ReceiveTab/>`
  - ลบ `ReceiveTab` + ชนิด/ค่าคงที่ที่ใช้เฉพาะมัน (`ReceiveRow`, `ReceiveCategory`,
    `RECEIVE_CATEGORIES`, `LevelBadge`) ถ้าไม่มีที่อื่นใช้
  - คงปุ่ม "รับเข้า" รายแถวในแท็บ Standards/สารเคมี/แก้ว + `ReceiveBottlesDialog`
    + `SimpleMoveDialog` ไว้เหมือนเดิม

## การพิจารณาเรื่องโครงสร้าง (isolation)

- `ReceiveCart.tsx` แยกไฟล์ออกมาเอง (Stock.tsx ยาว ~1276 บรรทัดแล้ว) — มี
  responsibility เดียว: รวบรวมรายการรับเข้าหลายตัวแล้ว submit
- พิจารณาแยก sub-component ภายใน `ReceiveCart`:
  - `StandardRowFields` (ที่มา/lot/ml/count/exp) — โครงคล้าย `ReceiveBottlesDialog`
    body; **ไม่บังคับ** extract shared (DRY ดีแต่เพิ่มความเสี่ยงแตะ dialog เดิม) —
    ตัดสินตอนเขียน plan ว่าคุ้มไหม
  - `ItemPicker` (combobox) — แยกได้ถ้าโตเกิน

## Testing

- Unit: `buildSolventLabelHtml` คืน HTML ที่มี QR + escape ชื่อ (mirror สไตล์
  test ของ stockLabel ถ้ามี / เพิ่มใหม่)
- Manual E2E (DEV_MODE):
  1. เพิ่มแถว standard + solvent + glassware ในตะกร้าเดียว กรอกครบ submit
  2. ยืนยัน: standard สร้างรายขวดถูกจำนวน + EXP, solvent qty เพิ่ม, glass qty เพิ่ม
  3. ยืนยันปริ้น: standard N ใบ, solvent N ใบ (มี QR), glass ไม่ปริ้น
  4. ทำให้ 1 แถว fail (เช่น standard ไม่เลือก source) → ยืนยัน toast รายงานถูก
     + แถวที่ fail ยังค้างในตะกร้า แถวสำเร็จหายไป
  5. ประวัติ (History tab) ขึ้น transaction ครบ + note solvent มี lot/exp

## Error handling

- validate ก่อน submit: ทุกแถวต้องเลือกของ + จำนวน > 0; standard ต้องมี source
- receive fail รายแถว → ไม่ล้มทั้งชุด, เก็บ error ต่อแถว
- print fail → toast เตือนต่อใบ แต่ไม่ถือว่า receive ล้ม (ของรับเข้าไปแล้ว)
  (mirror พฤติกรรมเดิมใน `ReceiveBottlesDialog.printLabels`)
