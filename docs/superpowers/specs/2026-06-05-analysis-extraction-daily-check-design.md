# Daily Check — ห้องวิเคราะห์ (analysis) & ห้องสกัด (extraction)

วันที่: 2026-06-05
สถานะ: อนุมัติ design แล้ว — รอเขียน implementation plan

## เป้าหมาย

เปิดใช้ Daily Check (เช็กการทำงานเครื่องมือประจำวัน) สำหรับ **ห้องวิเคราะห์** และ
**ห้องสกัด** ซึ่งปัจจุบันเป็น `RoomPlaceholderPage` โดยใช้ pattern เดียวกับ
**ห้องเตรียมตัวอย่าง (sample-prep)** ที่ทำเสร็จแล้ว

## บริบท / ของเดิมที่มีอยู่

- `EquipmentCheck` model (`server/models/EquipmentCheck.js`) เป็น **generic** keyed by
  `roomSlug` — readings เป็น array ของ `{ key, label, value, unit }` รองรับทุกห้อง
- route `server/routes/equipment-checks.js` + API client (`api.getEquipmentChecks`,
  `api.createEquipmentCheck`) เป็น generic อยู่แล้ว
- **Backend ไม่ต้องแก้** และ **ไม่มี collection ใหม่**
- `SamplePrepRoomPage.tsx` เป็นหน้า template สมบูรณ์: tab บันทึกผล (การ์ดต่อเครื่อง:
  สถานะ ปกติ/ผิดปกติ + readings + หมายเหตุ + ผู้บันทึก) และ tab ประวัติ (filter
  วันที่/เครื่องมือ/สถานะ)
- อุณหภูมิ/ความชื้นของห้องวิเคราะห์อยู่ใน tab "อุณหภูมิ/ความชื้น" (environment) แล้ว
  (`src/lib/dailyCheckEnv.ts` รวม `analysis`) — หน้าห้องวิเคราะห์จึงมีแค่เครื่องมือ
- ห้องสกัดไม่มีฟอร์มอุณหภูมิ/ความชื้น

## สถาปัตยกรรม — รวมหน้าเพจเป็น component กลาง

หน้าทั้ง 3 ห้อง (sample-prep, analysis, extraction) มีตรรกะเหมือนกันเป๊ะ จึงรวมเป็น
component เดียว ลดโค้ดซ้ำ ~420 บรรทัด/ห้อง

### `src/lib/roomEquipment.ts` (ใหม่ — types + registry)

```ts
export interface ReadingField { key: string; label: string; unit: string; }
export interface RoomInstrument {
  id: string; name: string; brand: string;
  group: string; readings: ReadingField[];
}
export interface RoomGroup { key: string; label: string; }
export interface RoomCatalog {
  slug: string;
  instruments: RoomInstrument[];
  groups: RoomGroup[];
}

export const ROOM_CATALOGS: Record<string, RoomCatalog> = { ... };
export const getRoomCatalog = (slug: string): RoomCatalog | undefined => ...;
```

- types `ReadingField` / instrument shape ลิฟต์ออกจาก `samplePrepInstruments.ts`
  มาไว้ที่นี่ (ของเดิม `ReadingGroup` เป็น union แคบ `"basic"|"temp"|"ph"` → ขยายเป็น
  `string` เพื่อรองรับกลุ่มใหม่ `gc`/`hplc`)
- `samplePrepInstruments.ts` ยังอยู่ (import types จาก `roomEquipment.ts`) เพื่อให้
  export เดิม (`SAMPLE_PREP_INSTRUMENTS`, `SAMPLE_PREP_ROOM_SLUG`, `samplePrepGroups`,
  `getSamplePrepInstrument`) และ test เดิมไม่พัง; registry อ้างถึง catalog ของ sample-prep

### `src/pages/daily-check/RoomEquipmentCheckPage.tsx` (ใหม่ — generalize จาก SamplePrepRoomPage)

- รับ prop `roomSlug: string`
- ดึง catalog จาก `getRoomCatalog(roomSlug)`, ดึง meta ห้อง (label, icon) จาก
  `getRoomBySlug(roomSlug)`
- หัวข้อ = `{room.label} — เช็กการทำงานเครื่องมือ`
- ไอคอนการ์ด = `room.icon` (Beaker / Microscope / FlaskConical)
- ตรรกะ/JSX อื่นเหมือน `SamplePrepRoomPage` ทุกอย่าง (drafts, mutation, validation
  readings เป็นตัวเลข, นับ ตรวจแล้ว/ปกติ, tab ประวัติ + filter)
- ใช้ `catalog.instruments` / `catalog.groups` แทน constant ของ sample-prep
- ลบ `SamplePrepRoomPage.tsx`

## Catalog ห้องวิเคราะห์ (analysis)

7 เครื่อง, 2 กลุ่ม: `gc` ("GC"), `hplc` ("HPLC"). ทุกเครื่อง brand = Agilent

GC readings: `ความดันแก๊สพา (psi)`, `อุณหภูมิ oven (°C)`, `Flow rate (mL/min)`
HPLC readings: `ความดันระบบ (bar)`, `Flow rate (mL/min)`, `อุณหภูมิ column (°C)`

| id     | name                  | group | readings |
|--------|-----------------------|-------|----------|
| LD-003 | GC 7890A              | gc    | pressure(psi), temp(°C), flow(mL/min) |
| LD-043 | GC 8850               | gc    | pressure(psi), temp(°C), flow(mL/min) |
| LD-004 | GC 8890               | gc    | pressure(psi), temp(°C), flow(mL/min) |
| LD-044 | HPLC 1260 Infinity III| hplc  | pressure(bar), flow(mL/min), temp(°C) |
| LD-001 | HPLC Agilent 1260     | hplc  | pressure(bar), flow(mL/min), temp(°C) |
| LD-033 | HPLC Agilent 1260     | hplc  | pressure(bar), flow(mL/min), temp(°C) |
| LD-034 | HPLC Agilent 1260     | hplc  | pressure(bar), flow(mL/min), temp(°C) |

reading keys: `pressure`, `temp`, `flow` (key ซ้ำข้ามกลุ่มได้ เพราะ label/unit
เก็บลง record อยู่แล้ว และ key unique ภายในเครื่องเดียว)

## Catalog ห้องสกัด (extraction)

10 เครื่อง, 2 กลุ่ม: `basic` ("เครื่องมือทั่วไป"), `temp` ("วัดอุณหภูมิ").
brand เว้นว่าง ("") ทุกเครื่อง (ไม่ทราบ)

temp reading: `อุณหภูมิ (°C)` (`{ key:"temp", label:"อุณหภูมิ", unit:"°C" }`)

| id     | name            | group | readings |
|--------|-----------------|-------|----------|
| LD-022 | Aspirator pump  | basic | — |
| LD-045 | Aspirator pump  | basic | — |
| LD-042 | Desiccator      | basic | — |
| LD-039 | Magnetic stirrer| basic | — |
| LD-020 | Cooling         | temp  | temp(°C) |
| LD-030 | Cooling         | temp  | temp(°C) |
| LD-017 | Heating mantle  | temp  | temp(°C) |
| LD-018 | Heating mantle  | temp  | temp(°C) |
| LD-036 | Heating mantle  | temp  | temp(°C) |
| LD-037 | Heating mantle  | temp  | temp(°C) |

## Wiring

- `src/App.tsx`: เปลี่ยน route 3 ห้องให้ใช้ component กลาง
  - `sample-prep` / `analysis` / `extraction` → `<RoomEquipmentCheckPage roomSlug="…" />`
  - เอา import `SamplePrepRoomPage` ออก, เพิ่ม import `RoomEquipmentCheckPage`
  - `RoomPlaceholderPage` import ยังคงอยู่ก็ได้ (ไม่มีห้องใช้แล้ว แต่เก็บไว้เผื่ออนาคต)
- `src/lib/dailyCheckRooms.ts`: `analysis` & `extraction` → `ready: true`

## Tests

- `src/lib/dailyCheckRooms.test.ts`: แก้ test "ready set" → คาดหวัง
  `["balance","sample-prep","analysis","extraction"]`
- `src/lib/samplePrepInstruments.test.ts`: **คงเดิม** ต้องยังผ่าน
- เพิ่ม test catalog ห้องใหม่ (ไฟล์ `roomEquipment.test.ts` หรือแยกตามห้อง):
  - analysis: 7 เครื่อง id ไม่ซ้ำ, 3 gc + 4 hplc, ทุกเครื่องมี 3 readings,
    ทุกเครื่อง group อยู่ใน groups
  - extraction: 10 เครื่อง id ไม่ซ้ำ, 4 basic (readings ว่าง) + 6 temp
    (1 temp reading °C), ทุกเครื่อง group อยู่ใน groups
  - registry: `getRoomCatalog` คืน catalog ของ 3 ห้อง, คืน undefined สำหรับ slug มั่ว
- DailyCheckLayout test เดิมไม่ควรกระทบ

## Verification

- `npx tsc --noEmit` ผ่าน
- `npm run test` ผ่าน (รวม test เดิมทั้งหมด)
- รันแอปจริง: เปิด tab ห้องวิเคราะห์ + ห้องสกัด, บันทึกผลเครื่องตัวอย่าง,
  ดูค่าขึ้นใน tab ประวัติ

## Out of scope

- ไม่แตะ backend / model / route / API client
- ไม่แตะ balance (ใช้ model อื่น `DailyCheckRecord`) และ environment tab
- ไม่ทำ milli-Q / Density / Hood (deferred เหมือนเดิม)
- brand ห้องสกัดเว้นว่าง — เติมภายหลังถ้าได้ข้อมูล
