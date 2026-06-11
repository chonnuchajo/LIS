# Dev Petition Status Stepper — Design

วันที่: 2026-06-11
สถานะ: รอ implement
Scope: เครื่องมือ dev-only สำหรับเลื่อน `petition.status` ทีละสเตปบนหน้า petition detail เพื่อเทสต์ feature อื่น ๆ ที่ขึ้นกับ status โดยไม่ต้องเดินผ่าน flow จริง (scan/รับ/assign)

## เป้าหมาย

ตอนพัฒนา feature ที่ผูกกับ `petition.status` (เช่น status_log dual-track, dashboard, การ์ดต่าง ๆ) ต้องมี petition ในสถานะที่ต้องการเพื่อทดสอบ ปัจจุบันต้องเดิน flow จริงทุกครั้ง (ส่งตัวอย่าง → รับ → assign → กรอกผล → อนุมัติ) ซึ่งช้าและต้องมีข้อมูลรองครบ

ต้องการปุ่ม dev-only ที่ดัน status ไป **สเตปถัดไป** ได้เลย โดย:
- เลื่อนได้ทีละสเตปตามลำดับจริง **ห้ามข้าม**
- โผล่เฉพาะใน dev mode (เหมือน `DevRoleSwitcher`)
- ไม่แตะ backend — เป็น frontend-only ล้วน

## ลำดับ status (อ้างจาก `PETITION_STATUSES`)

```
deliveringQC → sampleSent → pendingReview → inProgress → success → { approved | rejected }
```

- `success` เป็นจุด branch: ถัดไปได้ 2 ทาง = `approved` หรือ `rejected`
- `approved` / `rejected` = terminal (ไม่มีถัดไป)

## ทำไมไม่ต้องแก้ backend

`PATCH /api/petitions/:id` (generic update path ใน `server/routes/petitions.js`) เซ็ต `status` ตรง ๆ ได้อยู่แล้วสำหรับ forward transition ทั่วไป และ log `statusChanged` ให้เอง ส่วน branch ที่ `success`:
- `approved`: backend บังคับต้องมาจาก `success` อยู่แล้ว → ใช้ `api.approvePetition` เดิม
- `rejected`: backend บังคับต้องมาจาก `success` + ต้องมี `revisionNote` → ใช้ `api.rejectPetition` เดิม ใส่ note อัตโนมัติ

terminal guard ฝั่ง backend (approved/rejected เปลี่ยนต่อไม่ได้) เป็นไปตามที่ออกแบบ — **ไม่มี reset** (ตัดสินใจแล้ว: ถ้าจะเทสต์ใหม่ให้สร้าง petition ใบใหม่)

ดังนั้น UI ถูก gate ด้วย `DEV_MODE` จึงไม่โผล่ใน prod และไม่เพิ่ม surface ใด ๆ ที่ backend

## คอมโพเนนต์

### `src/components/petition/DevStatusStepper.tsx` (ใหม่)

Props:
- `petitionId: string`
- `status: PetitionStatus`
- `onChanged: () => void` — เรียกหลังเปลี่ยน status สำเร็จ (ให้หน้า refetch)

พฤติกรรม:
- `if (!DEV_MODE) return null;` (import จาก `@/config/dev`)
- กล่อง border ส้มสไตล์เดียวกับ `DevRoleSwitcher` (ป้าย `DEV` ให้รู้ว่าเป็นของ dev) วาง inline บนหน้า detail
- หา next จาก `PETITION_STATUSES`:
  - ถ้า status ปัจจุบันอยู่ก่อน `success`: ปุ่มเดียว `เปลี่ยนเป็น: <label ถัดไป> →`
  - ถ้า `success`: 2 ปุ่ม `อนุมัติ (approved)` / `ส่งกลับแก้ไข (rejected)`
  - ถ้า `approved`/`rejected`: ข้อความ `ปิดแล้ว — ไม่มีสเตปถัดไป` (ไม่มีปุ่ม)
- label ใช้ `PETITION_STATUS_CONFIG[next].label`
- ระหว่างยิง API: disable ปุ่ม + แสดง loading; error → toast/inline message

actor ที่ส่ง: ใช้ user ปัจจุบันจาก `useAuth` ถ้ามี ไม่งั้น `'__dev__'`

### API layer — `src/lib/api.ts`

เพิ่ม 1 ฟังก์ชัน (forward ทั่วไป):

```ts
devSetPetitionStatus: (petitionId: string, status: PetitionStatus, actor: string) =>
  request<Petition>(`/petitions/${petitionId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, actor }),
  }),
```

branch ที่ success ใช้ของเดิม: `approvePetition(id, actor)`, `rejectPetition(id, actor, "[dev] ทดสอบ reject")`

mapping next → call:
| from | next | call |
|------|------|------|
| deliveringQC | sampleSent | devSetPetitionStatus |
| sampleSent | pendingReview | devSetPetitionStatus |
| pendingReview | inProgress | devSetPetitionStatus |
| inProgress | success | devSetPetitionStatus |
| success | approved | approvePetition |
| success | rejected | rejectPetition (note อัตโนมัติ) |

### `src/hooks/usePetition.ts`

เพิ่ม `refresh` ให้ `usePetition` (เลียนแบบ `usePetitionList` ที่มี `reloadKey`/`refresh` อยู่แล้ว) เพื่อให้หน้า detail ดึงข้อมูลใหม่หลังเปลี่ยน status — return เป็น `{ data, loading, error, refresh }` (เพิ่ม field, backward-compatible)

### `src/pages/PetitionDetailPage.tsx`

- ดึง `refresh` จาก `usePetition`
- render `<DevStatusStepper petitionId={id} status={data.status} onChanged={refresh} />` ใกล้ status badge

## ขอบเขตที่ไม่ทำ (YAGNI)

- ไม่ตั้งข้อมูลรอง (assignedTo / receivedAt / ผลทดสอบ) — เซ็ตแค่ status ดิบ ตาม scope ที่ต้องการ
- ไม่มี reset จาก terminal
- ไม่ทำใน list/widget — เฉพาะหน้า detail ต่อใบ
- ไม่แตะ backend

## Testing

- Unit: ฟังก์ชันคำนวณ next status (รวม branch ที่ success + terminal ไม่มี next) — แยกเป็น pure helper เพื่อเทสต์ได้ เช่น `nextPetitionStatuses(status): PetitionStatus[]`
- Manual (dev): เปิดหน้า detail ใน dev mode, กดเลื่อนทีละสเตปจน success, เลือก approve/reject, ยืนยันหน้า reflect ทันที + audit log ขึ้น `statusChanged`
