# Daily Check — หน้าอุณหภูมิ/ความชื้น (ทำจริง) + หน้าโหลดเอกสาร (scaffold)

วันที่: 2026-06-04
สถานะ: อนุมัติ design แล้ว — รอเขียน implementation plan

## ที่มา / เป้าหมาย

ทุกห้องปฏิบัติการต้องบันทึก "อุณหภูมิและความชื้น" ประจำวันเหมือนกัน (ฟอร์มต้นฉบับ
`FM-QP-06-03-002` มีอยู่ใน 3 ห้อง: ห้องชั่งสาร / เตรียมตัวอย่าง / วิเคราะห์) แทนที่จะ
ทำซ้ำในแต่ละหน้าห้อง จึงรวมเป็น **หน้าตรวจเฉพาะหน้าเดียว** ภายใต้ Daily Check

พร้อมกันนี้เพิ่ม **หน้า "โหลดเอกสาร"** ไว้เป็นโครงร่าง (scaffold) สำหรับฟีเจอร์ในอนาคต —
โหลด/พิมพ์ "บันทึกที่กรอกแล้ว" ออกมาเป็นเอกสาร รอบนี้ยังไม่ทำ logic จริง

ขอบเขตที่ตกลง:
- **หน้าอุณหภูมิ/ความชื้น** = ทำจริง + ต่อ backend, ครอบ 3 ห้อง, บันทึกวันละครั้ง/ห้อง,
  เกณฑ์ pass/fail ตั้งค่าได้ต่อห้อง (มี default ใน config)
- **หน้าโหลดเอกสาร** = scaffold เปล่า (placeholder)

## โครงสร้างปัจจุบันที่อิงด้วย

- `src/lib/dailyCheckRooms.ts` — config ห้อง (`DAILY_CHECK_ROOMS`), `getRoomBySlug`
- `src/pages/daily-check/DailyCheckLayout.tsx` — tab strip สร้างจาก `DAILY_CHECK_ROOMS`
- `src/pages/daily-check/BalanceRoomPage.tsx` — ฟอร์มจริงที่ใช้เป็น template
  (กรอกค่า → ประเมิน pass/fail → save ผ่าน React Query → tab ประวัติ + filter)
- `src/pages/daily-check/RoomPlaceholderPage.tsx` — สไตล์ placeholder
- `server/models/DailyCheck.js` + `server/routes/dailyChecks.js` — pattern model/route
  (ผูกกับเครื่องชั่งโดยเฉพาะ — **ไม่นำมาใช้ซ้ำ**, สร้าง model ใหม่แทน)
- `src/lib/api.ts` — เพิ่ม endpoint/type
- `src/lib/accessControl.ts` — `IMPLIED_CHILD_PATHS["/daily-check"]`
- `src/App.tsx` — nested routes ใต้ `/daily-check`

## Design

### 1. Config เกณฑ์ต่อห้อง — `src/lib/dailyCheckEnv.ts` (ไฟล์ใหม่)

```ts
export interface EnvRoom {
  slug: "balance" | "sample-prep" | "analysis";
  label: string;       // ชื่อห้องบนหน้าตรวจ
  tempMin: number;     // °C
  tempMax: number;     // °C
  humidityMax: number; // %RH (เกณฑ์บน)
}

export const ENV_ROOMS: EnvRoom[] = [
  { slug: "balance",     label: "ห้องชั่งสาร",       tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: "sample-prep", label: "ห้องเตรียมตัวอย่าง", tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: "analysis",    label: "ห้องวิเคราะห์",      tempMin: 15, tempMax: 25, humidityMax: 70 },
];
```

> ค่า default เป็นค่าประมาณตามมาตรฐานทั่วไป — ผู้ใช้ปรับเลขจริงได้ในไฟล์เดียว

Helper (มี unit test):
```ts
type Status = "pass" | "fail";
evaluateEnv(temp: number, humidity: number, room: EnvRoom): {
  tempStatus: Status;       // pass เมื่อ tempMin ≤ temp ≤ tempMax
  humidityStatus: Status;   // pass เมื่อ humidity ≤ humidityMax
  status: Status;           // pass เมื่อทั้งสองผ่าน
}
getEnvRoom(slug: string): EnvRoom | undefined
```

### 2. Backend

**Model** — `server/models/EnvCheck.js` (collection `envchecks`):

| field | type | หมายเหตุ |
|---|---|---|
| `room` | String enum[balance,sample-prep,analysis], required, index | slug ห้อง |
| `roomName` | String, required | ชื่อไทย (snapshot) |
| `temperature` | Number, required | °C |
| `humidity` | Number, required | %RH |
| `tempMin` / `tempMax` / `humidityMax` | Number | snapshot เกณฑ์ที่ใช้ตอนบันทึก |
| `tempStatus` / `humidityStatus` | String enum[pass,fail], required | |
| `status` | String enum[pass,fail], required, index | รวม |
| `note` | String, default "" | หมายเหตุ/การแก้ไขเมื่อเกินเกณฑ์ |
| `recorder` / `recorderId` / `recorderEmail` | String | ผู้บันทึก |
| `date` | String (YYYY-MM-DD), required, index | filter เร็ว |
| `checkedAt` | Date, required, default now | |

index รวม `{ date: -1, room: 1 }` (mirror ของ DailyCheck). โหลดอัตโนมัติผ่าน `loadAllModels()`

**Route** — `server/routes/envChecks.js` (ตาม `dailyChecks.js`):
- `GET /` — query `date` (`YYYY-MM-DD` หรือ `all`) | `from`+`to` | `room` | `status`; default = วันนี้;
  sort `checkedAt: -1`
- `POST /` — validate (`room`, `temperature`/`humidity` เป็น number, `recorder` ไม่ว่าง),
  คำนวณ `tempStatus`/`humidityStatus`/`status` ฝั่ง server จากเกณฑ์ที่ส่งมา, set `date`/`checkedAt`
- `GET /summary/today` — `{ date, count, rooms: [...], allPass }` (เผื่อต่อ notification ภายหลัง)

Mount ใน `server/index.js` (`mountApi`) ทั้ง `/api/env-checks` และ `/LIS/api/env-checks`

### 3. Frontend API — `src/lib/api.ts`

เพิ่ม:
- `getEnvChecks(params?: { date?; from?; to?; room?; status? })`
- `createEnvCheck(payload)`
- `getEnvCheckTodaySummary()`
- types `EnvCheckRecord`, `CreateEnvCheckPayload`, `EnvCheckTodaySummary`

### 4. หน้า `EnvironmentCheckPage.tsx` (ลอกจาก BalanceRoomPage)

- หัวข้อ + วันที่วันนี้ + badge "ตรวจแล้ว x/3" และ "ผ่าน x/3"
- 2 tab: **บันทึกผล** / **รายการบันทึก**
- tab บันทึกผล: 3 การ์ด (ห้องละใบจาก `ENV_ROOMS`)
  - input อุณหภูมิ (°C) + ความชื้น (%RH), step ที่เหมาะสม
  - แสดงเกณฑ์ของห้องใต้ช่อง (เช่น "เกณฑ์ 15–25°C / ≤70%RH")
  - ประเมินผ่าน/ไม่ผ่านสดด้วย `evaluateEnv`
  - ช่อง **หมายเหตุ** (`note`) — โผล่/แนะนำให้กรอกเมื่อค่าเกินเกณฑ์
  - ผู้บันทึก = auto จาก `useAuth()` (readonly)
  - ถ้าวันนี้บันทึกแล้ว → โชว์ผลค่าเดิม + ปุ่ม "บันทึกซ้ำ"; ยังไม่บันทึก → ปุ่ม "บันทึกผล"
- tab ประวัติ: ตารางพร้อม filter วันที่ / ห้อง / สถานะ (ปุ่มรีเซ็ตตัวกรอง)
- บันทึกแล้ว `invalidateQueries(["env-checks"])`, toast success/warning

### 5. หน้า `DocumentsPage.tsx` (scaffold)

การ์ด dashed สไตล์ `RoomPlaceholderPage`: หัวข้อ "โหลดเอกสาร — อยู่ระหว่างพัฒนา",
อธิบายว่าจะใช้โหลด/พิมพ์บันทึก daily check ที่กรอกแล้วออกมาเป็นเอกสาร/PDF — ยังไม่มี logic

### 6. เชื่อมเข้า Daily Check

- `src/lib/dailyCheckRooms.ts` — เพิ่ม export `DAILY_CHECK_TABS`: รายการ tab ทั้งหมด
  (route, label, icon) เรียงเป็น **อุณหภูมิ/ความชื้น · เครื่องชั่ง · เตรียมตัวอย่าง ·
  วิเคราะห์ · สกัด · โหลดเอกสาร** โดย tab ห้องยังมาจาก `DAILY_CHECK_ROOMS` เดิม
  ส่วน 2 utility tab (`environment`, `documents`) เป็น entry เพิ่ม
- `DailyCheckLayout.tsx` — เปลี่ยน `TABS` ให้ map จาก `DAILY_CHECK_TABS` แทน `DAILY_CHECK_ROOMS`
- `src/App.tsx` — เพิ่ม route ใต้ `/daily-check`:
  - `index` → redirect ไป `environment` (เดิมไป `balance`)
  - `environment` → `EnvironmentCheckPage`
  - `documents` → `DocumentsPage`
- `src/lib/accessControl.ts` — เพิ่ม `/daily-check/environment`, `/daily-check/documents`
  เข้า `IMPLIED_CHILD_PATHS["/daily-check"]`

## เทสต์ (TDD)

- `src/lib/dailyCheckEnv.test.ts` — `evaluateEnv`: ผ่าน/ไม่ผ่าน อุณหภูมิ (ขอบบน/ล่าง/พ้นช่วง),
  ความชื้น (เท่าเกณฑ์/เกิน), การรวมผล
- smoke test `EnvironmentCheckPage` render 3 การ์ดห้อง + หัวข้อ
- (ออปชัน) เทสต์ route `envChecks` POST คำนวณ status ถูกต้อง — ทำถ้ามี harness ฝั่ง server พร้อม

## หลักการ / ขอบเขตที่ไม่ทำ (YAGNI)

- ไม่แก้ `DailyCheck`/`BalanceRoomPage` เดิม
- หน้าโหลดเอกสาร: ยังไม่ทำ export/PDF logic
- ไม่ทำเกณฑ์แบบ admin-config ผ่าน DB (ใช้ config ในโค้ดพอ) — ปรับเป็น DB ภายหลังได้
- ความชื้นใช้เกณฑ์บนอย่างเดียว (`humidityMax`); ถ้าต้องมีขอบล่างค่อยเพิ่ม
- บันทึกวันละครั้ง/ห้อง — ไม่ทำ enforce unique ระดับ DB รอบนี้ (ปุ่ม "บันทึกซ้ำ" คุม UX)
