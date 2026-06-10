# Petition Audit Log — Granular Events (รับแยกฝั่ง + QC ใส่/แก้ค่า)

**Date:** 2026-06-10
**Status:** Approved (design)
**Branch:** develop

## Problem

หน้า petition มี timeline (`PetitionAuditLog`) อยู่แล้ว แต่หยาบเกินไป:

- การ **รับตัวอย่าง** ฝั่ง Lab และ QC ถูก log เป็น event `statusChanged` ปนกัน — ฝั่งที่ 2 ที่รับ (status ไม่เปลี่ยน เพราะเป็น `pendingReview` อยู่แล้ว) โผล่เป็น "เปลี่ยนสถานะ" ทั้งที่ status เท่าเดิม อ่านแล้วงง
- การ **QC ใส่ค่า** (`PUT /qc-results`) ไม่ถูก log ลง timeline เลย — ดูไม่ได้ว่าใครใส่ค่าพารามิเตอร์ไหน ตอนไหน

ต้องการ timeline ที่ละเอียดขึ้น แยกได้ว่า: ใครรับฝั่งไหนตอนไหน, QC ใส่/แก้ค่าพารามิเตอร์ไหนตอนไหน — เหมือน activity log ที่ขนานกับ status หลัก (ไม่ใช่ status field ใหม่)

## Goals

- ขยาย `PetitionAuditLog` เดิม (ไม่สร้าง model/collection ใหม่)
- เพิ่ม event: รับฝั่ง Lab, รับฝั่ง QC, QC ใส่ค่าพารามิเตอร์ครั้งแรก, QC แก้ค่าพารามิเตอร์
- แสดงใน timeline ที่มีอยู่ (`PetitionAuditLog.tsx`) + filter ในหน้า `PetitionAuditLogPage.tsx`

## Non-Goals

- ไม่เพิ่ม status field ใหม่ใน Petition (`pendingReview` มีอยู่แล้ว, label "รับตัวอย่างแล้ว")
- ไม่ log รายค่าย่อย (per-field) — สรุประดับพารามิเตอร์
- ไม่โชว์ตัวเลขค่าใน timeline — โชว์แค่ชื่อพารามิเตอร์
- ไม่ migrate log เดิม (เพิ่ม enum แบบ additive)
- ไม่เพิ่ม field ใน Petition / QCTestResult (ใช้ `enteredAt`/`updatedAt`/`labReceivedAt`/`qcReceivedAt` เดิม)
- ไม่มี API endpoint ใหม่ (reuse `GET /petitions/:id/audit-logs` + `GET /petitions/audit-logs` + hooks เดิม)

## Design

### 1. Backend — `PetitionAuditLog` model

ไฟล์: `server/models/PetitionAuditLog.js`

เพิ่ม 3 ค่าใน `event` enum (additive, ของเดิมคงไว้):

```js
event: {
  type: String,
  enum: [
    'created', 'statusChanged', 'assigned', 'reviewed', 'updated', 'deleted',
    'received',        // ใหม่: Lab/QC สแกนรับตัวอย่าง
    'resultEntered',   // ใหม่: QC ใส่ค่าพารามิเตอร์ครั้งแรก
    'resultUpdated',   // ใหม่: QC แก้ค่าพารามิเตอร์
  ],
  required: true,
}
```

ไม่แตะ field อื่น (`fromStatus/toStatus/actor/note/metadata` ใช้ได้กับ event ใหม่อยู่แล้ว)

### 2. `/receive` endpoint — เปลี่ยน log เป็น event `received`

ไฟล์: `server/routes/petitions.js` (PATCH `/:id/receive`, ราว line 396-402)

เดิม log เป็น `statusChanged`. เปลี่ยนเป็น:

```js
logAudit(doc, {
  event: 'received',
  fromStatus: before.status,   // คงไว้: ถ้า flip sampleSent→pendingReview จะเห็นใน field นี้
  toStatus: doc.status,
  actor,
  note: side === 'lab' ? 'Lab รับตัวอย่าง' : 'QC รับตัวอย่าง',
  metadata: { side },          // 'lab' | 'qc'
});
```

- ฝั่งแรกรับ (flip status): event เดียว `received` พอ — fromStatus/toStatus เก็บการเปลี่ยนไว้แล้ว ไม่ต้อง log `statusChanged` ซ้ำ
- ฝั่งที่ 2 รับ (status เท่าเดิม): `received` ที่ fromStatus === toStatus — timeline โชว์ "Lab/QC รับตัวอย่าง" ชัดเจน ไม่ใช่ "เปลี่ยนสถานะ"

### 3. `PUT /qc-results` — เพิ่มการ log (ระดับพารามิเตอร์)

ไฟล์: `server/routes/qcResults.js` (PUT `/`, ราว line 284-354)

ปัจจุบันไฟล์นี้ไม่ได้ import `PetitionAuditLog`. เพิ่ม:

1. `const PetitionAuditLog = require('../models/PetitionAuditLog');`
2. helper `logAudit` แบบ fire-and-forget (เหมือนใน petitions.js — `.catch` log error เฉยๆ ไม่ throw)

กติกาการ log (ใช้ `existing` + `isNew` ที่มีอยู่แล้ว ก่อน `findOneAndUpdate`):

| สถานการณ์ | เงื่อนไข | event |
|---|---|---|
| สร้าง QCTestResult ของพารามิเตอร์ครั้งแรก | `isNew === true` | `resultEntered` |
| แก้ field ที่ **เคยมีค่าอยู่แล้ว** | `!isNew && existing[valuesKey]?.[fieldLabel] != null && existing[valuesKey][fieldLabel] !== ''` | `resultUpdated` |
| เติม field ว่างเพิ่มในพารามิเตอร์เดิม | `!isNew && field เดิมว่าง` | **ไม่ log** (กันรก — ครอบด้วย resultEntered แรกแล้ว) |

> `valuesKey` = `'valuesPhase2'` ถ้า phase 2, ไม่งั้น `'values'` (ตรงกับ logic save เดิม)

payload:

```js
logAudit({
  petitionId: <ObjectId ถ้า valid ไม่งั้นข้าม>,   // body.petitionId เป็น string hex
  petitionNo,
  event: isNew ? 'resultEntered' : 'resultUpdated',
  actor: enteredBy?.name || enteredBy?.email || 'system',
  note: `${isNew ? 'QC ใส่ค่า' : 'QC แก้ค่า'} ${parameterName || parameterId}${sampleName ? ` (${sampleName})` : ''}`,
  metadata: { itemSeq, sampleName, commonName, parameterId, parameterName, phase: phaseNum },
});
```

- ไม่ใส่ตัวเลข `value` ใน note (per design) — แต่จะเก็บ `fieldLabel` ใน metadata ได้เผื่ออนาคต (optional)
- log **หลัง** `findOneAndUpdate` สำเร็จ (อ่าน `isNew`/`existing` ที่ snapshot ไว้ก่อน)
- `petitionId` ใน `PetitionAuditLog` เป็น `ObjectId` (required). `body.petitionId` เป็น string — cast ด้วย `mongoose.Types.ObjectId.isValid()` ถ้าไม่ valid ให้ใช้ helper ที่ไม่ throw (log จะ fail แต่ไม่ทำให้ save ค่าพัง เพราะ fire-and-forget)

### 4. Frontend — types

ไฟล์: `src/types/petition.types.ts`

- เพิ่ม `'received' | 'resultEntered' | 'resultUpdated'` ใน `PetitionAuditEvent`
- `PETITION_AUDIT_EVENT_LABELS`:
  - `received: 'รับตัวอย่าง'`
  - `resultEntered: 'ใส่ค่า QC'`
  - `resultUpdated: 'แก้ค่า QC'`
- เพิ่มสี badge ให้ event ใหม่ (map สีที่ใช้ใน component): `received` = primary/indigo, `resultEntered` = green, `resultUpdated` = amber/gray

### 5. Frontend — timeline component

ไฟล์: `src/components/petition/PetitionAuditLog.tsx`

- รองรับ render 3 event ใหม่ (badge สี + label)
- `received`: ถ้า `metadata.side === 'lab'` แสดง prefix "Lab", `'qc'` แสดง "QC" (เช่น "Lab รับตัวอย่าง โดย {actor}") — fallback ใช้ note จาก backend ถ้าไม่มี metadata
- `resultEntered`/`resultUpdated`: แสดงชื่อพารามิเตอร์จาก `metadata.parameterName` + `sampleName` (note จาก backend ก็พอแล้ว ใช้ note เป็นหลัก)
- ไม่พังถ้า metadata ว่าง (log เก่าไม่มี metadata)

### 6. Frontend — audit log page filter

ไฟล์: `src/pages/PetitionAuditLogPage.tsx`

- เพิ่ม 3 event ใหม่ในตัวเลือก dropdown filter "event type" (ใช้ `PETITION_AUDIT_EVENT_LABELS` เป็น source ของ label อยู่แล้ว — เพิ่มใน list ของ options)

## Data / Migration

- ไม่มี migration. enum เพิ่มแบบ additive, log เก่าไม่กระทบ
- `seed-data/` — log ที่เกิดใหม่จะถูก dump ตามรอบ auto-sync ปกติ (PetitionAuditLog เป็น collection ที่ listCollections เก็บอยู่แล้ว)

## Testing

- **Backend unit tests** (server มี test infra อยู่แล้ว เช่น `server/**/employeeLink.test.js`):
  - qcResults logging: `isNew` → `resultEntered`; แก้ field ที่มีค่า → `resultUpdated`; เติม field ว่าง → ไม่ log
  - receive: log เป็น event `received` + `metadata.side` ถูกต้องทั้ง lab/qc; ฝั่งแรก fromStatus=sampleSent toStatus=pendingReview; ฝั่ง 2 fromStatus===toStatus
- **Type-check**: `npx tsc -p tsconfig.app.json --noEmit` (root tsconfig เป็น no-op — ตาม memory)
- **Lint**: `npm run lint`
- (optional) ดู timeline จริงในหน้า detail ว่า render event ใหม่ถูก

## Files Touched

| ไฟล์ | การเปลี่ยน |
|---|---|
| `server/models/PetitionAuditLog.js` | +3 ค่าใน event enum |
| `server/routes/petitions.js` | `/receive` log → event `received` + metadata.side |
| `server/routes/qcResults.js` | import PetitionAuditLog + helper + log entered/updated |
| `src/types/petition.types.ts` | +3 event ใน union + labels + สี |
| `src/components/petition/PetitionAuditLog.tsx` | render 3 event ใหม่ |
| `src/pages/PetitionAuditLogPage.tsx` | +3 event ใน filter dropdown |
| `server/**/*.test.js` (ใหม่) | เทส logging rules |

## Open Questions (resolved)

- เติม field ว่างเพิ่ม = **ไม่ log** (ครอบด้วย resultEntered แรก) ✓
- timeline **ไม่โชว์ตัวเลขค่า** โชว์แค่ชื่อพารามิเตอร์ ✓
