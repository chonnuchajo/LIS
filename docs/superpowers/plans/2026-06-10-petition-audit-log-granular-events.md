# Petition Audit Log — Granular Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ขยาย `PetitionAuditLog` timeline เดิมให้บันทึก event ละเอียดขึ้น — Lab/QC สแกนรับตัวอย่าง (แยกฝั่ง) และ QC ใส่/แก้ค่าพารามิเตอร์ (ระดับพารามิเตอร์)

**Architecture:** เพิ่ม 3 ค่าใน `event` enum แบบ additive (ไม่ migrate). ดึง logic ตัดสินใจว่า "QC write นี้ควร log event อะไร" ออกเป็น pure helper ใน `server/lib/auditEvents.js` (เทสได้ด้วย `node:test` ตามแพทเทิร์น lib เดิม) แล้วเรียกจาก route. `/receive` แก้ event ตรงๆ. Frontend แค่เพิ่ม label + สี badge — note จาก backend พกข้อความเต็มมาแล้ว ไม่ต้องแก้ JSX logic.

**Tech Stack:** Express 4 + Mongoose 8 (server), Node built-in test runner (`node --test`), React 18 + TypeScript + Vite (frontend), Vitest (frontend tests)

---

## File Structure

| ไฟล์ | ความรับผิดชอบ | สร้าง/แก้ |
|---|---|---|
| `server/models/PetitionAuditLog.js` | schema — เพิ่ม 3 event ใน enum | แก้ |
| `server/lib/auditEvents.js` | pure helper: ตัดสิน event ของ QC write + สร้าง note | **สร้าง** |
| `server/lib/auditEvents.test.js` | เทส helper | **สร้าง** |
| `server/routes/qcResults.js` | เรียก helper + logAudit หลัง save | แก้ |
| `server/routes/petitions.js` | `/receive` log → event `received` + metadata.side | แก้ |
| `src/types/petition.types.ts` | union `PetitionAuditEvent` + labels | แก้ |
| `src/components/petition/PetitionAuditLog.tsx` | `EVENT_VARIANT` +3 สี | แก้ |
| `src/pages/PetitionAuditLogPage.tsx` | `EVENT_VARIANT` +3 สี (filter ขึ้นเองจาก labels) | แก้ |

> หมายเหตุ committer: ของ LIS มี process อื่น commit แทรกใน develop ได้ — ทุก commit ใช้ explicit pathspec (ระบุไฟล์เอง อย่า `git add -A`)

---

## Task 1: เพิ่ม event enum ใน PetitionAuditLog model

**Files:**
- Modify: `server/models/PetitionAuditLog.js` (field `event`, ราว line 14-18)

- [ ] **Step 1: แก้ enum**

หา block:

```js
    event: {
      type: String,
      enum: ['created', 'statusChanged', 'assigned', 'reviewed', 'updated', 'deleted'],
      required: true,
    },
```

แทนด้วย:

```js
    event: {
      type: String,
      enum: [
        'created', 'statusChanged', 'assigned', 'reviewed', 'updated', 'deleted',
        'received',        // Lab/QC สแกนรับตัวอย่าง
        'resultEntered',   // QC ใส่ค่าพารามิเตอร์ครั้งแรก
        'resultUpdated',   // QC แก้ค่าพารามิเตอร์
      ],
      required: true,
    },
```

- [ ] **Step 2: ตรวจว่าโหลด model ได้ (ไม่มี syntax error)**

Run: `cd server && node -e "require('./models/PetitionAuditLog'); console.log('ok')"`
Expected: พิมพ์ `ok` (ไม่ throw) — mongoose อาจ warn เรื่อง connection แต่ require ผ่าน

- [ ] **Step 3: Commit**

```bash
cd /c/Project/LIS && git add server/models/PetitionAuditLog.js && git commit -m "feat(audit): add received/resultEntered/resultUpdated to event enum"
```

---

## Task 2: pure helper `auditEvents.js` (TDD)

**Files:**
- Create: `server/lib/auditEvents.js`
- Test: `server/lib/auditEvents.test.js`

- [ ] **Step 1: เขียนเทสที่ fail ก่อน**

สร้าง `server/lib/auditEvents.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { qcResultAuditEvent, qcResultNote } = require('./auditEvents');

test('qcResultAuditEvent: doc ใหม่ → resultEntered', () => {
  assert.strictEqual(
    qcResultAuditEvent({ isNew: true, existingFieldValue: undefined }),
    'resultEntered',
  );
});

test('qcResultAuditEvent: แก้ field ที่เคยมีค่า → resultUpdated', () => {
  assert.strictEqual(
    qcResultAuditEvent({ isNew: false, existingFieldValue: '7.2' }),
    'resultUpdated',
  );
});

test('qcResultAuditEvent: เติม field ว่างในพารามิเตอร์เดิม → null (ไม่ log)', () => {
  assert.strictEqual(
    qcResultAuditEvent({ isNew: false, existingFieldValue: undefined }),
    null,
  );
  assert.strictEqual(
    qcResultAuditEvent({ isNew: false, existingFieldValue: '' }),
    null,
  );
});

test('qcResultAuditEvent: ค่าเดิมเป็นเลข 0 ถือว่ามีค่า → resultUpdated', () => {
  assert.strictEqual(
    qcResultAuditEvent({ isNew: false, existingFieldValue: 0 }),
    'resultUpdated',
  );
});

test('qcResultNote: entered มีชื่อพารามิเตอร์ + sample', () => {
  assert.strictEqual(
    qcResultNote('resultEntered', { parameterName: 'pH', sampleName: 'SP-001' }),
    'QC ใส่ค่า pH (SP-001)',
  );
});

test('qcResultNote: updated ไม่มี sampleName', () => {
  assert.strictEqual(
    qcResultNote('resultUpdated', { parameterName: 'ความหนาแน่น' }),
    'QC แก้ค่า ความหนาแน่น',
  );
});

test('qcResultNote: ไม่มี parameterName ใช้ parameterId แทน', () => {
  assert.strictEqual(
    qcResultNote('resultEntered', { parameterId: 'abc123', sampleName: '' }),
    'QC ใส่ค่า abc123',
  );
});
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `cd server && node --test lib/auditEvents.test.js`
Expected: FAIL — `Cannot find module './auditEvents'`

- [ ] **Step 3: เขียน helper minimal**

สร้าง `server/lib/auditEvents.js`:

```js
// ตัดสินใจว่า QC field-write หนึ่งครั้งควร log audit event อะไร (หรือไม่ log)
// - isNew: QCTestResult doc ของพารามิเตอร์นี้เพิ่งถูกสร้าง (field แรกของพารามิเตอร์)
// - existingFieldValue: ค่าเดิมของ fieldLabel นี้ "ก่อน" เขียน (undefined ถ้า field/doc ยังไม่มี)
// คืน 'resultEntered' | 'resultUpdated' | null
function qcResultAuditEvent({ isNew, existingFieldValue }) {
  if (isNew) return 'resultEntered';
  if (existingFieldValue != null && existingFieldValue !== '') return 'resultUpdated';
  return null; // เติม field ว่างในพารามิเตอร์เดิม → ไม่ log (ครอบด้วย resultEntered แรกแล้ว)
}

// สร้างข้อความ note ระดับพารามิเตอร์ (ไม่ใส่ตัวเลขค่าตาม design)
function qcResultNote(event, { parameterName, parameterId, sampleName } = {}) {
  const name = parameterName || parameterId || '';
  const verb = event === 'resultEntered' ? 'QC ใส่ค่า' : 'QC แก้ค่า';
  return `${verb} ${name}${sampleName ? ` (${sampleName})` : ''}`.trim();
}

module.exports = { qcResultAuditEvent, qcResultNote };
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `cd server && node --test lib/auditEvents.test.js`
Expected: PASS — ทุก test ผ่าน (7 tests)

- [ ] **Step 5: Commit**

```bash
cd /c/Project/LIS && git add server/lib/auditEvents.js server/lib/auditEvents.test.js && git commit -m "feat(audit): add auditEvents helper for QC result logging"
```

---

## Task 3: wire helper เข้า `PUT /qc-results`

**Files:**
- Modify: `server/routes/qcResults.js` (top imports + PUT handler ราว line 284-354)

- [ ] **Step 1: เพิ่ม imports ที่บนไฟล์**

หาบรรทัด require ที่มีอยู่ตอนต้นไฟล์ (เช่นที่ require `QCTestResult`, `Parameter`) แล้วเพิ่มต่อท้าย group นั้น:

```js
const mongoose = require('mongoose');
const PetitionAuditLog = require('../models/PetitionAuditLog');
const { qcResultAuditEvent, qcResultNote } = require('../lib/auditEvents');
```

> ถ้าไฟล์ require `mongoose` อยู่แล้ว ไม่ต้องซ้ำ — เพิ่มเฉพาะ 2 บรรทัดล่าง

- [ ] **Step 2: เก็บค่า field เดิมก่อน update**

ใน 핸들러 PUT `/` หา block (ราว line 312-313):

```js
    const existing = await QCTestResult.findOne(filter);
    const isNew = !existing;
```

แก้เป็น (เพิ่มการอ่านค่าเดิมของ field นี้):

```js
    const existing = await QCTestResult.findOne(filter);
    const isNew = !existing;
    const existingFieldValue = existing?.[valuesKey]?.[fieldLabel];
```

- [ ] **Step 3: log audit หลัง findOneAndUpdate สำเร็จ**

หา block (ราว line 329-332):

```js
    const doc = await QCTestResult.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });
```

เพิ่ม **ต่อจาก** block นั้น (ก่อน block `if (phaseNum === 1 && fieldDef?.triggersPhase2 ...)`):

```js
    // ลง audit log ระดับพารามิเตอร์ (fire-and-forget — ไม่ให้กระทบการบันทึกค่า)
    const auditEvent = qcResultAuditEvent({ isNew, existingFieldValue });
    if (auditEvent) {
      const petitionObjId = mongoose.Types.ObjectId.isValid(petitionId)
        ? new mongoose.Types.ObjectId(petitionId)
        : undefined;
      if (petitionObjId) {
        PetitionAuditLog.create({
          petitionId: petitionObjId,
          petitionNo,
          event: auditEvent,
          actor: enteredBy?.name || enteredBy?.email || 'system',
          note: qcResultNote(auditEvent, { parameterName, parameterId, sampleName }),
          metadata: { itemSeq, sampleName, commonName, parameterId, parameterName, fieldLabel, phase: phaseNum },
        }).catch((err) => {
          console.error('[audit-log] qc-result write failed:', err.message);
        });
      }
    }
```

> หมายเหตุ: `petitionId` ใน body เป็น string hex ของ Petition `_id`. `PetitionAuditLog.petitionId` เป็น `ObjectId` (required) — ถ้า cast ไม่ได้ ข้ามการ log (ไม่ throw) เพื่อไม่ให้การบันทึกค่าพัง

- [ ] **Step 4: smoke test — โหลด route ได้**

Run: `cd server && node -e "require('./routes/qcResults'); console.log('ok')"`
Expected: พิมพ์ `ok` (require ผ่าน ไม่ syntax error)

- [ ] **Step 5: ตรวจ logic ด้วยมือ (อ่านโค้ดทวน)**

ยืนยัน: `existingFieldValue` อ่าน **ก่อน** `findOneAndUpdate`; `valuesKey` คำนวณไว้แล้วด้านบน (line 307); log อยู่หลัง update สำเร็จ; ทุกอย่าง wrapped กัน throw

- [ ] **Step 6: Commit**

```bash
cd /c/Project/LIS && git add server/routes/qcResults.js && git commit -m "feat(audit): log resultEntered/resultUpdated on QC value save"
```

---

## Task 4: `/receive` → event `received` + metadata.side

**Files:**
- Modify: `server/routes/petitions.js` (PATCH `/:id/receive`, ราว line 396-402)

- [ ] **Step 1: แก้ logAudit call**

หา block:

```js
    logAudit(doc, {
      event: 'statusChanged',
      fromStatus: before.status,
      toStatus: doc.status,
      actor,
      note: side === 'lab' ? 'สแกนรับงาน Lab' : 'สแกนรับงาน QC',
    });
```

แทนด้วย:

```js
    logAudit(doc, {
      event: 'received',
      fromStatus: before.status,
      toStatus: doc.status,
      actor,
      note: side === 'lab' ? 'Lab รับตัวอย่าง' : 'QC รับตัวอย่าง',
      metadata: { side },
    });
```

- [ ] **Step 2: smoke test — โหลด route ได้**

Run: `cd server && node -e "require('./routes/petitions'); console.log('ok')"`
Expected: พิมพ์ `ok`

- [ ] **Step 3: Commit**

```bash
cd /c/Project/LIS && git add server/routes/petitions.js && git commit -m "feat(audit): receive logs 'received' event with side metadata"
```

---

## Task 5: Frontend types — union + labels

**Files:**
- Modify: `src/types/petition.types.ts` (`PetitionAuditEvent` ราว line 132-140, `PETITION_AUDIT_EVENT_LABELS` ราว line 155-162)

- [ ] **Step 1: เพิ่มสมาชิกใน union `PetitionAuditEvent`**

หา type (ราว line 132-140) ที่ลงท้ายด้วย:

```ts
  | 'updated'
  | 'deleted';
```

แก้เป็น:

```ts
  | 'updated'
  | 'deleted'
  | 'received'
  | 'resultEntered'
  | 'resultUpdated';
```

- [ ] **Step 2: เพิ่ม label**

หา `PETITION_AUDIT_EVENT_LABELS` แล้วเพิ่ม 3 บรรทัดก่อนปิด `}`:

```ts
export const PETITION_AUDIT_EVENT_LABELS: Record<PetitionAuditEvent, string> = {
  created: 'สร้างคำร้อง',
  statusChanged: 'เปลี่ยนสถานะ',
  assigned: 'มอบหมาย',
  reviewed: 'พิจารณา',
  updated: 'แก้ไขข้อมูล',
  deleted: 'ลบคำร้อง',
  received: 'รับตัวอย่าง',
  resultEntered: 'ใส่ค่า QC',
  resultUpdated: 'แก้ค่า QC',
};
```

- [ ] **Step 3: Commit**

```bash
cd /c/Project/LIS && git add src/types/petition.types.ts && git commit -m "feat(audit): add new audit event types + Thai labels"
```

---

## Task 6: สี badge ใน 2 component (Record ต้องครบ key ไม่งั้น TS error)

**Files:**
- Modify: `src/components/petition/PetitionAuditLog.tsx` (`EVENT_VARIANT` line 10-17)
- Modify: `src/pages/PetitionAuditLogPage.tsx` (`EVENT_VARIANT` ราว line 28)

> ทั้งสองไฟล์มี `EVENT_VARIANT: Record<PetitionAuditEvent, ...>` คนละชุด — เพิ่ม key เดียวกันทั้งคู่ ไม่งั้น TypeScript error (Record ขาด key)

- [ ] **Step 1: แก้ `EVENT_VARIANT` ใน PetitionAuditLog.tsx**

หา (line 10-17):

```ts
const EVENT_VARIANT: Record<PetitionAuditEvent, 'gray-soft' | 'primary-soft' | 'yellow-soft' | 'blue-soft' | 'green-soft' | 'red-soft'> = {
  created: 'primary-soft',
  statusChanged: 'blue-soft',
  assigned: 'yellow-soft',
  reviewed: 'green-soft',
  updated: 'gray-soft',
  deleted: 'red-soft',
};
```

เพิ่ม 3 บรรทัดก่อนปิด `}`:

```ts
  received: 'primary-soft',
  resultEntered: 'green-soft',
  resultUpdated: 'yellow-soft',
```

- [ ] **Step 2: แก้ `EVENT_VARIANT` ใน PetitionAuditLogPage.tsx แบบเดียวกัน**

หา `EVENT_VARIANT` (ราว line 28) ที่มี key ชุดเดียวกัน (created/statusChanged/.../deleted) เพิ่ม 3 บรรทัดก่อนปิด `}`:

```ts
  received: 'primary-soft',
  resultEntered: 'green-soft',
  resultUpdated: 'yellow-soft',
```

> filter dropdown ของ page ดึงตัวเลือกจาก `PETITION_AUDIT_EVENT_LABELS` (`Object.entries`) อยู่แล้ว — เพิ่ม label ใน Task 5 ก็ขึ้นเอง ไม่ต้องแก้ JSX. timeline ทั้งสองที่ใช้ `entry.note` แสดงรายละเอียด (backend ส่ง note เต็มมาแล้ว) จึงไม่ต้องแก้ JSX logic

- [ ] **Step 3: Commit**

```bash
cd /c/Project/LIS && git add src/components/petition/PetitionAuditLog.tsx src/pages/PetitionAuditLogPage.tsx && git commit -m "feat(audit): badge colors for new audit events"
```

---

## Task 7: ตรวจสอบรวม (type-check + lint + เทส)

**Files:** ไม่แก้ไฟล์ (เว้นแต่เจอ error)

- [ ] **Step 1: เทส backend helper**

Run: `cd server && node --test lib/auditEvents.test.js`
Expected: PASS ทั้งหมด

- [ ] **Step 2: type-check frontend (ใช้ tsconfig.app.json — root เป็น no-op ตาม CLAUDE.md/memory)**

Run: `cd /c/Project/LIS && npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้ (`petition.types.ts`, `PetitionAuditLog.tsx`, `PetitionAuditLogPage.tsx`). repo มี ~12 latent error เดิม — ยืนยันว่าไม่มีตัวใหม่ที่เกี่ยวกับ audit event/EVENT_VARIANT/PetitionAuditEvent

- [ ] **Step 3: lint ไฟล์ที่แก้**

Run: `cd /c/Project/LIS && npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้

- [ ] **Step 4: (optional) verify ด้วยตา** — รัน dev (frontend + `cd server && npm run dev`), เปิดหน้า petition detail ที่มีการรับ/ใส่ค่า QC, ดู timeline ว่าโผล่ "Lab/QC รับตัวอย่าง", "ใส่ค่า QC ...", "แก้ค่า QC ..." และ filter ในหน้า audit-logs มีตัวเลือกใหม่

- [ ] **Step 5: ไม่ต้อง commit** (ขั้นนี้ไม่แก้ไฟล์) — ถ้าแก้ error ให้ commit เฉพาะไฟล์นั้นด้วย explicit pathspec

---

## Notes

- **ไม่มี migration / ไม่แตะ log เก่า** — enum เพิ่มแบบ additive
- **seed-data** — log ใหม่ถูก dump ตามรอบ auto-sync ปกติ (PetitionAuditLog อยู่ใน listCollections)
- **fire-and-forget** — การ log ทุกจุดห่อ `.catch`/helper ที่ไม่ throw เพื่อไม่ให้ audit ทำให้ flow หลัก (รับ/บันทึกค่า) พัง
- **committer hazard** — commit ทุกครั้งด้วย explicit pathspec (อย่า `git add -A`)
