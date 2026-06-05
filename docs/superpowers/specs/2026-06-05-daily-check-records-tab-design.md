# Daily Check — แท็บ "รายการบันทึก" รวมในแถบ hub

วันที่: 2026-06-05
สถานะ: อนุมัติ design แล้ว — รอเขียน implementation plan

## เป้าหมาย

ย้าย "รายการบันทึก" (ประวัติเช็กเครื่อง) จาก sub-tab ในแต่ละหน้าห้อง มาเป็น **แท็บรวม
ระดับ hub** ที่ดูข้ามห้องได้ พร้อม filter เลือก **ห้อง + เครื่อง + วันที่ + สถานะ**
ครอบคลุม 3 ห้องเช็กเครื่อง (sample-prep / analysis / extraction)

## บริบท / ของเดิม

- 3 ห้อง (sample-prep/analysis/extraction) route ผ่าน `RoomEquipmentCheckPage` ตัวเดียว
  ซึ่งตอนนี้มี 2 sub-tab: "บันทึกผล" (grid การ์ดต่อเครื่อง) และ "รายการบันทึก"
  (history table + filter วันที่/เครื่อง-ของห้องนั้น/สถานะ)
- ข้อมูลมาจาก model generic **`EquipmentCheck`** keyed by `roomSlug`; API
  `api.getEquipmentChecks({ room, date?, instrumentId?, status?, from?, to? })`
  — **`room` เป็น required** (route 400 ถ้าไม่ส่ง)
- catalog 3 ห้องอยู่ใน `ROOM_CATALOGS` (`src/lib/roomEquipment.ts`); ชื่อห้องไทยจาก
  `getRoomBySlug` (`src/lib/dailyCheckRooms.ts`)
- แถบ tab ระดับ hub = `DAILY_CHECK_TABS` ใน `dailyCheckRooms.ts`
- balance ใช้ model คนละตัว (`DailyCheckRecord`), environment ใช้ `EnvCheck` —
  **อยู่นอกขอบเขต** (แท็บนี้รวมเฉพาะ 3 ห้องที่ใช้ `EquipmentCheck`)

## การตัดสินใจหลัก

- **ดึงข้อมูลแบบ frontend ล้วน — ไม่แตะ backend** (route ยังบังคับ `room` เหมือนเดิม)
- เอา sub-tab "รายการบันทึก" ออกจากหน้าห้อง (รวมศูนย์ที่แท็บใหม่)
- ขอบเขต filter ห้อง = 3 ห้องเช็กเครื่องเท่านั้น

## 1. แท็บใหม่ + route

`src/lib/dailyCheckRooms.ts`:
- import `List` จาก lucide-react (เพิ่มในรายการ import เดิม)
- เพิ่มใน `DAILY_CHECK_TABS` **ก่อน** entry "โหลดเอกสาร":
  ```ts
  { route: `${DAILY_CHECK_BASE}/records`, label: "รายการบันทึก", icon: List },
  ```
- ลำดับแถบใหม่: อุณหภูมิ/ความชื้น · เครื่องชั่ง · เตรียมตัวอย่าง · วิเคราะห์ · สกัด ·
  **รายการบันทึก** · โหลดเอกสาร

`src/App.tsx`: เพิ่ม route ใต้ `/daily-check`
```tsx
<Route path="records" element={<DailyCheckRecordsPage />} />
```

## 2. หน้าใหม่ `src/pages/daily-check/DailyCheckRecordsPage.tsx`

แสดงประวัติเช็กเครื่องรวม 3 ห้อง พร้อม filter

**Filter (state):**
- `filterRoom`: `"all" | "sample-prep" | "analysis" | "extraction"` (default `"all"`)
- `filterInstrument`: `string` (default `"all"`) — dropdown แสดงเครื่องของห้องที่เลือก;
  เมื่อ `filterRoom === "all"` → ล็อกเป็น `"all"` + disable (เพราะเครื่องข้ามห้าง
  ID อาจซ้ำ/ไม่สื่อความ)
- `filterDate`: `string` (default วันนี้, `<input type="date">`)
- `filterStatus`: `"all" | "normal" | "abnormal"` (default `"all"`)
- ปุ่ม "รีเซ็ตตัวกรอง" → คืนค่า default ทั้งหมด
- เมื่อเปลี่ยน `filterRoom` ให้รีเซ็ต `filterInstrument` เป็น `"all"` (กันค้างเครื่องของ
  ห้องเก่า)

**ดึงข้อมูล (frontend ล้วน):**
- ใช้ `useQueries` ยิง 1 query ต่อห้อง สำหรับ **ทั้ง 3 ห้องเสมอ** ตาม `filterDate`:
  ```ts
  api.getEquipmentChecks({ room: slug, date: filterDate || todayStr() })
  ```
  queryKey: `["equipment-checks", "records", slug, filterDate]`
- รายชื่อ slug ของ 3 ห้อง: เพิ่ม export `EQUIPMENT_ROOM_SLUGS: string[]` ใน
  `roomEquipment.ts` (= `Object.keys(ROOM_CATALOGS)` แบบ fix order:
  `["sample-prep","analysis","extraction"]`)
- merge ผลทั้ง 3 → sort `checkedAt` มากไปน้อย (ใหม่สุดก่อน)
- จากนั้น **filter ฝั่ง client** ด้วย pure helper (ดูข้อ 5):
  - ถ้า `filterRoom !== "all"` → เก็บเฉพาะ `roomSlug === filterRoom`
  - ถ้า `filterInstrument !== "all"` → เก็บเฉพาะ `instrumentId === filterInstrument`
  - ถ้า `filterStatus !== "all"` → เก็บเฉพาะ `status === filterStatus`
- loading = query ใดยัง pending; error → toast/ข้อความ "โหลดไม่สำเร็จ"

**ตาราง (เพิ่มคอลัมน์ "ห้อง"):**
| วันที่ | เวลา | **ห้อง** | เครื่อง | สถานะ | ค่าที่วัด | หมายเหตุ | ผู้บันทึก |

- ห้อง = `getRoomBySlug(rec.roomSlug)?.label ?? rec.roomSlug`
- คอลัมน์อื่นเหมือนตารางประวัติเดิมใน RoomEquipmentCheckPage (รวมการแสดง readings
  `${label} ${value} ${unit}` join ", ")
- ว่าง → ข้อความ "ไม่พบรายการในช่วงที่เลือก"

**Header:** หัวข้อ "รายการบันทึกการเช็กเครื่องมือ" + คำอธิบายสั้น

## 3. ลดงานซ้ำใน `RoomEquipmentCheckPage.tsx`

- เอา **sub-tab "รายการบันทึก"** ทั้งบล็อกออก: history `useQuery`, state
  `filterDate/filterInstrument/filterStatus`, และ JSX ตารางประวัติ + filter
- เอา `<Tabs>` wrapper ออก → เนื้อหาเหลือแค่ส่วน grid "บันทึกผล" (render ตรงๆ)
- ลบ import ที่ไม่ใช้แล้ว: `Tabs/TabsContent/TabsList/TabsTrigger`,
  `Table/TableBody/TableCell/TableHead/TableHeader/TableRow`,
  `Select/SelectContent/SelectItem/SelectTrigger/SelectValue`, `Filter`, `List`,
  `ClipboardList`, `fmtDate` (ถ้าไม่ถูกใช้แล้ว) — ตรวจตอนแก้ว่าตัวไหนยังถูกใช้
- คง query `todayRecords` (today, ต่อห้อง) ไว้ — ใช้โชว์สถานะการ์ดของวันนี้

## 4. รายละเอียดที่ต้องระวัง

- `useQueries` ยิง 3 ห้องเสมอ (ไม่ conditional) เพื่อให้ filter ห้อง=ทั้งหมด ทำงานได้
  และเลี่ยงปัญหา rules-of-hooks; ปริมาณ query เล็ก รับได้
- instrument dropdown: เมื่อเลือกห้องเจาะจง ดึงรายการเครื่องจาก
  `getRoomCatalog(filterRoom)?.instruments`
- ไม่มี collection ใหม่ / ไม่แตะ backend → **ไม่ต้องรัน seed:export**

## 5. Tests

- `src/lib/equipmentRecords.ts` (ใหม่): pure helper
  ```ts
  filterEquipmentRecords(records, { room, instrumentId, status })
  ```
  คืน records ที่ผ่าน filter (ค่า `"all"`/undefined = ไม่กรอง) — **ไม่ทำ sort/merge
  ในนี้** (sort ทำในหน้าเพจ); แยกออกมาเพื่อ unit-test logic filter โดยไม่พึ่ง network
  - test `src/lib/equipmentRecords.test.ts`: กรองตามห้อง/เครื่อง/สถานะ, ค่า "all"
    ไม่กรอง, รวมหลายเงื่อนไข
- แก้ `src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`: tab list ที่คาดหวัง
  เพิ่ม "รายการบันทึก" (ก่อน "โหลดเอกสาร")
- (ตัวเลือก) ถ้า merge+sort ซับซ้อนพอ อาจแยก `mergeAndSortByCheckedAt` เป็น helper +
  test — แต่ YAGNI: sort บรรทัดเดียว ปล่อยในหน้าเพจได้

## Verification

- `npx tsc --noEmit` ผ่าน
- `npm run test` ผ่าน (รวม test เดิม + ใหม่)
- รันแอปจริง: แท็บ "รายการบันทึก" โผล่ในแถบ; default โชว์ทั้ง 3 ห้องของวันนี้;
  เลือกห้อง → instrument dropdown โผล่เฉพาะเครื่องห้องนั้น + ตารางกรองถูก; คอลัมน์ห้อง
  แสดงชื่อไทย; หน้าห้องไม่มี sub-tab รายการบันทึกแล้ว เหลือแค่บันทึกผล

## Out of scope

- ไม่แตะ backend / model / route / API client
- balance + environment records (คนละ model) — ไม่รวมในแท็บนี้
- date range / export — ใช้ date เดี่ยว (default วันนี้) เหมือนของเดิม
