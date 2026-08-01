# Petition Flow Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้กระดิ่งแจ้งเตือนในแอปเด้งความเคลื่อนไหวของคำขอ (petition) ตามแผนก/บทบาทของผู้ใช้และงานที่ผู้ใช้ถือเอง — ปัจจุบันกระดิ่งมีแต่ Daily Check

**Architecture:** เพิ่ม endpoint `GET /api/petitions/notifications` ที่ join `PetitionAuditLog` เข้ากับ `Petition` แล้วใช้ `lineNotify.describeEvent()` ตัวเดิม (ที่ LINE ใช้อยู่) ตัดสินถ้อยคำ + audience ฝั่ง frontend เพิ่ม watcher component ที่ poll ทุก 60 วิ แล้ว `push()` เข้า `NotificationContext` เดิม ตรรกะที่มีความหมายทั้งหมดอยู่ในโมดูล pure สองไฟล์ (`server/lib/petitionNotifications.js`, `src/lib/petitionAudience.ts`) ที่มี unit test

**Tech Stack:** Express 4 + Mongoose 8 (backend, เทสต์ด้วย `node --test`), React 18 + TypeScript + TanStack React Query (frontend, เทสต์ด้วย Vitest/jsdom)

**Spec:** `docs/superpowers/specs/2026-08-01-petition-flow-notifications-design.md`

## Global Constraints

- **ห้ามแก้ `server/lib/lineNotify.js`** — พฤติกรรมแจ้งเตือน LINE ต้องไม่เปลี่ยน โมดูลใหม่เรียกใช้อย่างเดียว
- **ห้ามรัน `npm run build`** — `postbuild` เขียนไฟล์ root ทับและทำ dev server พัง ใช้ `npx tsc -p tsconfig.app.json --noEmit` type-check แทน (`npx tsc --noEmit` เฉย ๆ เป็น no-op เพราะ root tsconfig มี `files: []`)
- **เทสต์ backend รันด้วย `node --test <file>`** ไม่ใช่ `npm test` ใน `server/` (สคริปต์นั้นชี้ไป jest ซึ่งไม่ได้ตั้งค่าไว้) ไฟล์เทสต์ใช้ `require('node:test')` + `require('node:assert')` ตามแบบ `server/lib/lineNotify.test.js`
- **เทสต์ frontend รันด้วย `npm run test`** (vitest run) ที่ root
- **route ใหม่ต้องประกาศก่อน `router.get('/:id', …)`** ใน `server/routes/petitions.js` ไม่งั้น Express จับคำว่า `notifications` เป็น id
- **UI ทุกข้อความเป็นภาษาไทย** ตามระบบเดิม
- **commit ทุก task** — ใช้ pathspec ระบุไฟล์ตรง ๆ (`git add -- <paths>`) เพราะ working tree อาจมีงานค้างของ session อื่น ห้าม `git add -A`
- ค่าคงที่ที่ต้องตรงกันทุกไฟล์: cursor key prefix `lis.petitionNotify.cursor.`, see-all key `lis.petitionNotify.seeAll`, see-all event `lis:petition-notify-seeall`, lookback 24 ชม., limit default 30 / max 50

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `server/lib/petitionNotifications.js` (สร้าง) | Pure: แปลง audit log + petition → notification, ตัดสินว่าใครควรเห็น |
| `server/lib/petitionNotifications.test.js` (สร้าง) | เทสต์ของข้างบน |
| `server/routes/petitions.js` (แก้) | route `GET /notifications` — โหลดข้อมูลแล้วเรียกโมดูล pure |
| `src/lib/petitionAudience.ts` (สร้าง) | Pure: user → audience keys + ตัวช่วยอ่าน/เขียนสวิตช์ "ดูทั้งระบบ" |
| `src/lib/petitionAudience.test.ts` (สร้าง) | เทสต์ของข้างบน |
| `src/lib/api.ts` (แก้) | `getPetitionNotifications()` |
| `src/components/lis/PetitionFlowWatcher.tsx` (สร้าง) | Glue: poll → push → เลื่อน cursor |
| `src/App.tsx` (แก้) | mount watcher |
| `src/context/NotificationContext.tsx` (แก้) | `group` field + จำกัดจำนวนที่เก็บลง localStorage |
| `src/context/notificationStorage.test.ts` (สร้าง) | เทสต์ `capPersisted` |
| `src/components/lis/NotificationBell.tsx` (แก้) | สวิตช์ "ดูทั้งระบบ" เฉพาะ admin |

---

## Task 1: โมดูล pure ฝั่ง backend

**Files:**
- Create: `server/lib/petitionNotifications.js`
- Test: `server/lib/petitionNotifications.test.js`

**Interfaces:**
- Consumes: `describeEvent(petition, payload)` จาก `server/lib/lineNotify.js` (คืน `{ audiences: string[], text: string } | null`), `hasLabTrack(petition)` จาก `server/lib/petitionStatusLog.js`, `requiresQcTrack(petition)` จาก `server/lib/petitionSubmissionRules.js`
- Produces:
  - `bellDescribe(petition, log)` → `{ audiences: string[], title: string, message?: string } | null`
  - `isRelevant(desc, petition, viewer)` → `boolean` โดย `viewer = { audiences: string[], employeeId?: string, seeAll?: boolean }`
  - `levelForEvent(log)` → `'info' | 'warning' | 'success' | 'error'`
  - `toNotification(petition, log, desc)` → `{ id, petitionNo, title, message, level, link, createdAt }`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `server/lib/petitionNotifications.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  bellDescribe,
  isRelevant,
  levelForEvent,
  toNotification,
} = require('./petitionNotifications');

// batchNo ลงท้าย 1 หรือ 6 = งาน Lab (กติกาเดิมใน petitionStatusLog.isLabBatch)
const labItem = { batchNo: '326', sampleName: 'OMETHOATE' };
const petition = {
  _id: 'p1',
  petitionNo: 'P-2606-0018',
  dept: 'production',
  items: [labItem],
  submittedBy: { name: 'สมชาย', employeeId: 'E100', department: 'Production' },
};

test('bellDescribe: created ใช้ถ้อยคำร่วมกับ LINE และแตกบรรทัดแรกเป็น title', () => {
  const d = bellDescribe(petition, { event: 'created' });
  assert.deepStrictEqual(d.audiences, ['qc']);
  assert.strictEqual(d.title, '📋 คำขอใหม่ P-2606-0018');
  assert.match(d.message, /ผู้ยื่น: สมชาย/);
  assert.match(d.message, / · /); // หลายบรรทัดถูกรวบด้วย " · "
});

test('bellDescribe: received — LINE ไม่ส่ง แต่กระดิ่งส่ง โดยดู side จาก metadata', () => {
  const d = bellDescribe(petition, { event: 'received', metadata: { side: 'lab' } });
  assert.deepStrictEqual(d.audiences, ['lab']);
  assert.strictEqual(d.title, '📥 Lab รับตัวอย่าง P-2606-0018');
});

test('bellDescribe: received ที่ไม่มี side → null', () => {
  assert.strictEqual(bellDescribe(petition, { event: 'received', metadata: {} }), null);
});

test('bellDescribe: resultEntered ไม่มี side → ทั้งสองฝั่งที่งานนี้มี', () => {
  const d = bellDescribe(petition, { event: 'resultEntered', metadata: { parameterName: 'pH' } });
  assert.deepStrictEqual(d.audiences, ['qc', 'lab']);
  assert.strictEqual(d.title, '🧪 เริ่มบันทึกผล P-2606-0018');
  assert.strictEqual(d.message, 'pH');
});

test('bellDescribe: resultUpdated → null เสมอ (แก้ค่าทีละช่องจะเด้งรัว)', () => {
  assert.strictEqual(
    bellDescribe(petition, { event: 'resultUpdated', metadata: { side: 'qc', parameterName: 'pH' } }),
    null,
  );
});

test('bellDescribe: reviewed → null', () => {
  assert.strictEqual(bellDescribe(petition, { event: 'reviewed' }), null);
});

test('isRelevant: audience ตัดกัน → true', () => {
  const desc = { audiences: ['qc'], title: 't' };
  assert.strictEqual(isRelevant(desc, petition, { audiences: ['qc'], employeeId: 'E999' }), true);
  assert.strictEqual(isRelevant(desc, petition, { audiences: ['lab'], employeeId: 'E999' }), false);
});

test('isRelevant: งานที่ตัวเองถือ / คำขอที่ตัวเองยื่น → true แม้ audience ไม่ตรง', () => {
  const desc = { audiences: ['qc'], title: 't' };
  const assigned = { ...petition, assignedTo: { employeeId: 'E200', name: 'สมหญิง' } };
  assert.strictEqual(isRelevant(desc, assigned, { audiences: ['lab'], employeeId: 'E200' }), true);
  assert.strictEqual(isRelevant(desc, petition, { audiences: ['lab'], employeeId: 'E100' }), true);
});

test('isRelevant: ไม่มี employeeId → ไม่ผ่านทางงานตัวเอง', () => {
  const desc = { audiences: ['qc'], title: 't' };
  assert.strictEqual(isRelevant(desc, petition, { audiences: ['lab'], employeeId: '' }), false);
});

test('isRelevant: seeAll ผ่านหมด', () => {
  const desc = { audiences: ['qc'], title: 't' };
  assert.strictEqual(isRelevant(desc, petition, { audiences: [], seeAll: true }), true);
});

test('levelForEvent: rejected/success/approved/ผิดปกติ/อื่น', () => {
  assert.strictEqual(levelForEvent({ event: 'statusChanged', toStatus: 'rejected' }), 'error');
  assert.strictEqual(levelForEvent({ event: 'statusChanged', toStatus: 'success' }), 'success');
  assert.strictEqual(levelForEvent({ event: 'statusChanged', toStatus: 'approved' }), 'success');
  assert.strictEqual(levelForEvent({ event: 'updated', note: 'พบค่าผิดปกติ 2 รายการ' }), 'warning');
  assert.strictEqual(levelForEvent({ event: 'created' }), 'info');
});

test('toNotification: id = audit log id, link ชี้หน้า timeline ของคำขอ', () => {
  const log = { _id: 'log1', event: 'created', createdAt: '2026-08-01T02:00:00.000Z' };
  const desc = { audiences: ['qc'], title: 'T', message: 'M' };
  assert.deepStrictEqual(toNotification(petition, log, desc), {
    id: 'log1',
    petitionNo: 'P-2606-0018',
    title: 'T',
    message: 'M',
    level: 'info',
    link: '/petition/p1',
    createdAt: '2026-08-01T02:00:00.000Z',
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `node --test server/lib/petitionNotifications.test.js`
Expected: FAIL — `Cannot find module './petitionNotifications'`

- [ ] **Step 3: เขียน implementation**

สร้าง `server/lib/petitionNotifications.js`:

```js
// Turns PetitionAuditLog rows into in-app bell notifications. Pure — no DB access;
// routes/petitions.js loads the inputs and calls these.
//
// Wording and audience routing come from lineNotify.describeEvent so the bell and the
// LINE groups can never drift apart. The bell tolerates finer-grained events than a
// LINE group does, so the two events describeEvent deliberately skips (received /
// resultEntered) get a bell-only fallback here.
const { describeEvent } = require('./lineNotify');
const { hasLabTrack } = require('./petitionStatusLog');
const { requiresQcTrack } = require('./petitionSubmissionRules');

const SIDE_LABELS = { lab: 'Lab', qc: 'QC' };

// describeEvent builds ONE multi-line LINE message; the bell wants a short title plus
// a secondary line. First line = title, everything else collapses into message.
function splitText(text) {
  const [first, ...rest] = String(text).split('\n');
  const message = rest.map((s) => s.trim()).filter(Boolean).join(' · ');
  return { title: first.trim(), message: message || undefined };
}

function bothSides(petition) {
  return [requiresQcTrack(petition) ? 'qc' : null, hasLabTrack(petition) ? 'lab' : null].filter(Boolean);
}

function bellDescribe(petition, log) {
  const shared = describeEvent(petition, log);
  if (shared) return { audiences: shared.audiences, ...splitText(shared.text) };

  const no = petition?.petitionNo || log?.petitionNo || '(ไม่ทราบเลข)';
  const side = log?.metadata?.side;

  switch (log?.event) {
    case 'received': {
      if (side !== 'lab' && side !== 'qc') return null;
      return { audiences: [side], title: `📥 ${SIDE_LABELS[side]} รับตัวอย่าง ${no}` };
    }
    case 'resultEntered': {
      const audiences = side === 'lab' || side === 'qc' ? [side] : bothSides(petition);
      if (!audiences.length) return null;
      return {
        audiences,
        title: `🧪 เริ่มบันทึกผล ${no}`,
        message: log?.metadata?.parameterName || undefined,
      };
    }
    default:
      // resultUpdated = แก้ค่าทีละช่อง (รัวเกินไป), reviewed/deleted = ไม่มีอะไรต้องบอก
      return null;
  }
}

// Does this viewer care? Audience match OR it is their own job.
function isRelevant(desc, petition, viewer) {
  if (viewer?.seeAll) return true;
  const mine = viewer?.audiences || [];
  if ((desc?.audiences || []).some((a) => mine.includes(a))) return true;

  // employeeId only — names collide, and a collision would leak someone else's work.
  const empId = String(viewer?.employeeId || '').trim();
  if (!empId) return false;
  return (
    String(petition?.assignedTo?.employeeId || '').trim() === empId ||
    String(petition?.submittedBy?.employeeId || '').trim() === empId
  );
}

function levelForEvent(log) {
  if (log?.toStatus === 'rejected') return 'error';
  if (log?.toStatus === 'success' || log?.toStatus === 'approved') return 'success';
  if (String(log?.note || '').includes('ผิดปกติ')) return 'warning';
  return 'info';
}

// id = audit log id, so NotificationContext.push() de-dupes on its own when two
// polls overlap the same window.
function toNotification(petition, log, desc) {
  return {
    id: String(log?._id),
    petitionNo: petition?.petitionNo || log?.petitionNo || '',
    title: desc.title,
    message: desc.message,
    level: levelForEvent(log),
    link: `/petition/${petition?._id ?? log?.petitionId}`,
    createdAt: log?.createdAt,
  };
}

module.exports = { bellDescribe, isRelevant, levelForEvent, toNotification };
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `node --test server/lib/petitionNotifications.test.js`
Expected: PASS ทั้ง 12 เทสต์

- [ ] **Step 5: ยืนยันว่าไม่ได้ทำเทสต์ LINE เดิมพัง**

Run: `node --test server/lib/lineNotify.test.js`
Expected: PASS 15 เทสต์เหมือนเดิม

- [ ] **Step 6: Commit**

```bash
git add -- server/lib/petitionNotifications.js server/lib/petitionNotifications.test.js
git commit -m "feat(server): pure module turning petition audit logs into bell notifications"
```

---

## Task 2: Endpoint `GET /petitions/notifications`

**Files:**
- Modify: `server/routes/petitions.js` (แทรกหลัง route `/audit-logs` ที่บรรทัด ~322)

**Interfaces:**
- Consumes: `bellDescribe`, `isRelevant`, `toNotification` จาก Task 1
- Produces: `GET /api/petitions/notifications?since&audiences&employeeId&all&limit` → `{ items: Notification[], serverTime: string }` — Task 4 (`api.ts`) เรียกใช้

- [ ] **Step 1: เพิ่ม import**

ที่หัวไฟล์ `server/routes/petitions.js` (ใต้ `const PetitionAuditLog = require('../models/PetitionAuditLog');` บรรทัด 9) เพิ่ม:

```js
const {
  bellDescribe,
  isRelevant,
  toNotification,
} = require('../lib/petitionNotifications');
```

- [ ] **Step 2: เพิ่ม route**

แทรก **ต่อจาก** route `GET /audit-logs` (ปิดที่ `});` บรรทัด ~322) และ **ก่อน** route ใด ๆ ที่ขึ้นต้นด้วย `/:id`:

```js
// GET /api/petitions/notifications?since=<ISO>&audiences=qc,lab&employeeId=E1&all=0&limit=30
// In-app bell feed: audit log + petition → notifications this viewer should see.
// Unauthenticated like the rest of this API — the client states who it is, same as
// the `actor` field other routes accept.
const NOTIFY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

router.get('/notifications', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
    const audiences = String(req.query.audiences || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const viewer = {
      audiences,
      employeeId: String(req.query.employeeId || '').trim(),
      seeAll: String(req.query.all || '') === '1',
    };

    // Hard 24h ceiling no matter how stale the client's cursor is.
    const floor = new Date(Date.now() - NOTIFY_LOOKBACK_MS);
    const since = new Date(String(req.query.since || ''));
    const window = !Number.isNaN(since.getTime()) && since > floor ? since : floor;

    const logs = await PetitionAuditLog.find({ createdAt: { $gte: window } })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const petitionIds = [...new Set(logs.map((l) => String(l.petitionId)).filter(Boolean))];
    const petitions = petitionIds.length
      ? await Petition.find({ _id: { $in: petitionIds } })
          .select(
            'petitionNo dept status items.batchNo items.sampleName items.commonName ' +
            'submittedBy assignedTo qcCompletedAt labCompletedAt labApprovedAt',
          )
          .lean()
      : [];
    const byId = new Map(petitions.map((p) => [String(p._id), p]));

    const items = [];
    for (const log of logs) {
      if (items.length >= limit) break;
      const petition = byId.get(String(log.petitionId));
      if (!petition) continue; // ถูกลบ/soft delete แล้ว
      const desc = bellDescribe(petition, log);
      if (!desc) continue;
      if (!isRelevant(desc, petition, viewer)) continue;
      items.push(toNotification(petition, log, desc));
    }

    // Client uses serverTime as its next cursor — avoids client/server clock skew.
    res.json({ items, serverTime: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
```

- [ ] **Step 3: ยืนยันว่า route มาก่อน `/:id`**

Run (PowerShell): `Select-String -Path server/routes/petitions.js -Pattern "router\.get\('/notifications'|router\.get\('/:id" | Select-Object LineNumber, Line`
Expected: เลขบรรทัดของ `/notifications` **น้อยกว่า** ทุกบรรทัดที่เป็น `/:id`
ถ้าไม่ใช่ ให้ย้ายบล็อกขึ้นไปไว้ติดกับ `/audit-logs`

- [ ] **Step 4: Smoke test กับ server จริง**

ต้องมี MongoDB รันอยู่ เปิด backend ในอีกเทอร์มินัล: `cd server && npm run dev`
แล้วยิง (PowerShell):

```powershell
Invoke-RestMethod "http://localhost:3001/api/petitions/notifications?audiences=qc,lab&limit=5" | ConvertTo-Json -Depth 5
```

Expected: JSON `{ items: [...], serverTime: "..." }` — `items` เป็น array (ว่างได้ถ้า 24 ชม.ล่าสุดไม่มีความเคลื่อนไหว) ทุก item มีครบ `id`, `title`, `level`, `link`, `createdAt`
ถ้าได้ 404 แปลว่า backend ไม่ได้รัน ถ้าได้ `Cast to ObjectId failed` แปลว่า route ไปโดน `/:id` จับ — กลับไป Step 3

- [ ] **Step 5: ยืนยันว่า `all=1` กว้างกว่า และ audience ผิดได้น้อยกว่า**

```powershell
$all = Invoke-RestMethod "http://localhost:3001/api/petitions/notifications?all=1&limit=50"
$none = Invoke-RestMethod "http://localhost:3001/api/petitions/notifications?limit=50"
"$($all.items.Count) vs $($none.items.Count)"
```

Expected: จำนวนของ `all=1` มากกว่าหรือเท่ากับอีกอัน (ถ้าเท่ากับ 0 ทั้งคู่แปลว่า 24 ชม.ล่าสุดไม่มี audit log — ยังถือว่าผ่าน)

- [ ] **Step 6: Commit**

```bash
git add -- server/routes/petitions.js
git commit -m "feat(server): GET /petitions/notifications bell feed"
```

---

## Task 3: audience helper ฝั่ง frontend

**Files:**
- Create: `src/lib/petitionAudience.ts`
- Test: `src/lib/petitionAudience.test.ts`

**Interfaces:**
- Consumes: `normalizeRoles(user)` จาก `src/lib/roles.ts`
- Produces:
  - `audiencesForUser(user: AudienceUser | null | undefined) → string[]`
  - `readSeeAll() → boolean`
  - `writeSeeAll(value: boolean) → void` (เขียน localStorage แล้ว dispatch `SEE_ALL_EVENT`)
  - `SEE_ALL_EVENT: string` — Task 4 (watcher) และ Task 5 (bell) ใช้ทั้งคู่

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/petitionAudience.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { audiencesForUser, readSeeAll, writeSeeAll, SEE_ALL_EVENT } from "./petitionAudience";

describe("audiencesForUser", () => {
  it("แปลง role เป็น audience", () => {
    expect(audiencesForUser({ roles: ["qc-staff"] })).toEqual(["qc"]);
    expect(audiencesForUser({ roles: ["lab-analyze"] })).toEqual(["lab"]);
    expect(audiencesForUser({ roles: ["qc-head", "lab-head"] })).toEqual(["qc", "lab"]);
  });

  it("รองรับ legacy single role", () => {
    expect(audiencesForUser({ role: "qc-head" })).toEqual(["qc"]);
  });

  it("แปลง department เป็น audience ทั้งไทยและอังกฤษ ไม่สนตัวพิมพ์", () => {
    expect(audiencesForUser({ department: "RM" })).toEqual(["rm"]);
    expect(audiencesForUser({ department: "คลังวัตถุดิบ" })).toEqual(["rm"]);
    expect(audiencesForUser({ department: "fg warehouse" })).toEqual(["fg"]);
    expect(audiencesForUser({ department: "แผนกผลิต" })).toEqual(["production"]);
    expect(audiencesForUser({ department: "Production" })).toEqual(["production"]);
  });

  it("ไม่ซ้ำเมื่อ role กับ department ชี้ที่เดียวกัน", () => {
    expect(audiencesForUser({ roles: ["qc-staff"], department: "QC" })).toEqual(["qc"]);
  });

  it("admin ล้วน ๆ ไม่มี department → ไม่ได้ audience พิเศษ", () => {
    expect(audiencesForUser({ roles: ["admin"] })).toEqual([]);
  });

  it("null/undefined → []", () => {
    expect(audiencesForUser(null)).toEqual([]);
    expect(audiencesForUser(undefined)).toEqual([]);
  });
});

describe("สวิตช์ ดูทั้งระบบ", () => {
  beforeEach(() => localStorage.clear());

  it("ค่าเริ่มต้น = false และ write/read ไปกลับได้", () => {
    expect(readSeeAll()).toBe(false);
    writeSeeAll(true);
    expect(readSeeAll()).toBe(true);
    writeSeeAll(false);
    expect(readSeeAll()).toBe(false);
  });

  it("write แล้ว dispatch event ให้ watcher รู้", () => {
    let fired = 0;
    const onEvent = () => { fired += 1; };
    window.addEventListener(SEE_ALL_EVENT, onEvent);
    writeSeeAll(true);
    window.removeEventListener(SEE_ALL_EVENT, onEvent);
    expect(fired).toBe(1);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run src/lib/petitionAudience.test.ts`
Expected: FAIL — resolve โมดูล `./petitionAudience` ไม่ได้

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/petitionAudience.ts`:

```ts
// ผู้ใช้คนหนึ่ง "อยู่ฝั่งไหน" ในสายตาของระบบแจ้งเตือน — คีย์ตรงกับ LineGroup.audience
// ฝั่ง server (qc / lab / production / rm / fg) เพื่อให้ endpoint กรองด้วยชุดคำเดียวกัน
import { normalizeRoles } from "@/lib/roles";

export interface AudienceUser {
  role?: string;
  roles?: string[];
  department?: string;
}

const ROLE_AUDIENCE: Record<string, string> = {
  "qc-head": "qc",
  "qc-staff": "qc",
  "lab-head": "lab",
  "lab-analyze": "lab",
};

// department มาจาก HR/Microsoft จึงสะกดได้หลายแบบ — match แบบหลวมทั้งไทยและอังกฤษ
const DEPT_PATTERNS: Array<[RegExp, string]> = [
  [/\brm\b|วัตถุดิบ/i, "rm"],
  [/\bfg\b|สำเร็จรูป/i, "fg"],
  [/production|ผลิต/i, "production"],
  [/\bqc\b|ควบคุมคุณภาพ/i, "qc"],
  [/\blab\b|วิเคราะห์/i, "lab"],
];

/** audience ทั้งหมดของผู้ใช้ (role ∪ department) — `admin` ไม่ได้สิทธิ์พิเศษตรงนี้ */
export function audiencesForUser(user: AudienceUser | null | undefined): string[] {
  if (!user) return [];
  const out: string[] = [];
  const add = (a: string) => { if (a && !out.includes(a)) out.push(a); };

  for (const role of normalizeRoles(user)) {
    const audience = ROLE_AUDIENCE[role];
    if (audience) add(audience);
  }
  const dept = user.department || "";
  for (const [pattern, audience] of DEPT_PATTERNS) {
    if (pattern.test(dept)) add(audience);
  }
  return out;
}

const SEE_ALL_KEY = "lis.petitionNotify.seeAll";
/** bell เปลี่ยนสวิตช์ → watcher ต้อง refetch ทันที (คนละ subtree จึงคุยกันผ่าน window event) */
export const SEE_ALL_EVENT = "lis:petition-notify-seeall";

export function readSeeAll(): boolean {
  try {
    return localStorage.getItem(SEE_ALL_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSeeAll(value: boolean): void {
  try {
    if (value) localStorage.setItem(SEE_ALL_KEY, "1");
    else localStorage.removeItem(SEE_ALL_KEY);
  } catch {
    // private mode / quota — สวิตช์แค่ไม่จำข้ามรีเฟรช ไม่ต้องพัง
  }
  window.dispatchEvent(new Event(SEE_ALL_EVENT));
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionAudience.test.ts`
Expected: PASS ทั้ง 8 เทสต์

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/petitionAudience.ts src/lib/petitionAudience.test.ts
git commit -m "feat: map a user to petition notification audiences"
```

---

## Task 4: API client + watcher + mount

**Files:**
- Modify: `src/lib/api.ts` (เพิ่ม type + method ในอ็อบเจ็กต์ `api`)
- Create: `src/components/lis/PetitionFlowWatcher.tsx`
- Modify: `src/App.tsx:11` (import) และ `:96` (mount)

**Interfaces:**
- Consumes: endpoint จาก Task 2, `audiencesForUser` / `readSeeAll` / `SEE_ALL_EVENT` จาก Task 3, `useNotifications().push` จาก `src/context/NotificationContext.tsx`, `useAuth().user` จาก `src/context/AuthContext.tsx`
- Produces: `api.getPetitionNotifications(params)` และ `<PetitionFlowWatcher />` (default export, ไม่ render อะไร)

- [ ] **Step 1: เพิ่ม type + method ใน `src/lib/api.ts`**

วาง interface ไว้ใกล้ ๆ interface อื่นที่หัวไฟล์ (หลัง `StockTransactionParams` บรรทัด ~39):

```ts
export interface PetitionFlowNotification {
  id: string;
  petitionNo: string;
  title: string;
  message?: string;
  level: "info" | "warning" | "success" | "error";
  link: string;
  createdAt: string;
}
```

แล้วเพิ่ม method ในอ็อบเจ็กต์ `api` ต่อจาก `getDailyCheckTodaySummary` (บรรทัด ~475):

```ts
  // แจ้งเตือน petition flow สำหรับกระดิ่ง — server กรอง audience ให้แล้ว
  getPetitionNotifications: (params: {
    since: string;
    audiences: string[];
    employeeId?: string;
    all?: boolean;
    limit?: number;
  }) => {
    const qs = new URLSearchParams({ since: params.since });
    if (params.audiences.length) qs.set("audiences", params.audiences.join(","));
    if (params.employeeId) qs.set("employeeId", params.employeeId);
    if (params.all) qs.set("all", "1");
    if (params.limit) qs.set("limit", String(params.limit));
    return request<{ items: PetitionFlowNotification[]; serverTime: string }>(
      `/petitions/notifications?${qs.toString()}`,
    );
  },
```

- [ ] **Step 2: สร้าง watcher**

สร้าง `src/components/lis/PetitionFlowWatcher.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { audiencesForUser, readSeeAll, SEE_ALL_EVENT } from "@/lib/petitionAudience";

const CURSOR_PREFIX = "lis.petitionNotify.cursor.";
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

// cursor ผูกกับคน กันเคสสลับ user บนเครื่องเดียวกัน (dev role switcher) แล้วรับ cursor ของคนก่อน
const cursorKey = (employeeId?: string) => `${CURSOR_PREFIX}${employeeId || "anonymous"}`;

const readCursor = (employeeId?: string): string => {
  const fallback = new Date(Date.now() - LOOKBACK_MS).toISOString();
  try {
    return localStorage.getItem(cursorKey(employeeId)) || fallback;
  } catch {
    return fallback;
  }
};

/**
 * Poll ความเคลื่อนไหวของคำขอทุกนาทีแล้วยิงเข้ากระดิ่ง
 * cursor เดินหน้าเฉพาะตอน query สำเร็จ — เน็ตกระตุกแล้วต้องไม่กลืน event ที่ยังไม่เคยแสดง
 */
const PetitionFlowWatcher = () => {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [seeAll, setSeeAll] = useState(() => readSeeAll());

  useEffect(() => {
    const sync = () => setSeeAll(readSeeAll());
    window.addEventListener(SEE_ALL_EVENT, sync);
    return () => window.removeEventListener(SEE_ALL_EVENT, sync);
  }, []);

  const audiences = useMemo(() => audiencesForUser(user), [user]);
  const employeeId = user?.employeeId;
  const enabled = !!user && (audiences.length > 0 || !!employeeId || seeAll);

  const { data } = useQuery({
    queryKey: ["petition-notifications", employeeId ?? "", audiences.join(","), seeAll],
    queryFn: () =>
      api.getPetitionNotifications({
        since: readCursor(employeeId),
        audiences,
        employeeId,
        all: seeAll,
      }),
    refetchInterval: 60_000,
    enabled,
  });

  useEffect(() => {
    if (!data) return;
    // server เรียงใหม่→เก่า; push ทีละอันแบบกลับด้าน เพื่อให้อันใหม่สุดไปอยู่หัวลิสต์
    for (const item of [...data.items].reverse()) {
      push({
        id: item.id,
        title: item.title,
        message: item.message,
        level: item.level,
        link: item.link,
        createdAt: new Date(item.createdAt).getTime(),
        persistent: true,
        group: "petition",
      });
    }
    try {
      localStorage.setItem(cursorKey(employeeId), data.serverTime);
    } catch {
      // private mode — รอบหน้าจะดึงย้อนหลัง 24 ชม.ใหม่ ซึ่ง push กันซ้ำด้วย id อยู่แล้ว
    }
  }, [data, employeeId, push]);

  return null;
};

export default PetitionFlowWatcher;
```

> `group: "petition"` เป็น field ที่ Task 5 เพิ่มเข้า `AppNotification` — ถ้าทำ Task 4 ก่อน TypeScript จะฟ้อง ให้ทำ Task 5 Step 1-3 ก่อนแล้วค่อยกลับมา verify Task 4

- [ ] **Step 3: mount ใน `src/App.tsx`**

เพิ่ม import ใต้บรรทัด 11:

```tsx
import PetitionFlowWatcher from "@/components/lis/PetitionFlowWatcher";
```

แล้วเพิ่มใต้ `<DailyCheckReminderWatcher />` (บรรทัด 96):

```tsx
            <PetitionFlowWatcher />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ในไฟล์ที่แตะ (repo มี latent error เดิมอยู่ ~12 จุด — สนใจเฉพาะไฟล์ 3 ไฟล์ข้างบน)

- [ ] **Step 5: ทดสอบด้วยตาในแอปจริง**

เปิด backend (`cd server && npm run dev`) และ frontend (`npm run dev`) → เข้า http://localhost:8000
สลับ role เป็น `qc-staff` ด้วย DevRoleSwitcher แล้วเปิด DevTools → Network
Expected:
- มี request `/api/petitions/notifications?...` ยิงตอนโหลด และซ้ำทุก 60 วิ
- ถ้า 24 ชม.ล่าสุดมีความเคลื่อนไหวของคำขอ กระดิ่งขึ้นเลขสีแดง กดแล้วเห็นรายการ กดที่รายการแล้วเด้งไป `/petition/<id>`
- รีเฟรชหน้า → รายการยังอยู่ (persistent) และไม่ซ้ำ
- กด "ลบ" ที่รายการหนึ่ง แล้วรีเฟรช → รายการนั้นไม่กลับมา

- [ ] **Step 6: Commit**

```bash
git add -- src/lib/api.ts src/components/lis/PetitionFlowWatcher.tsx src/App.tsx
git commit -m "feat: poll petition flow events into the notification bell"
```

---

## Task 5: จำกัดจำนวนที่เก็บ + สวิตช์ admin

**Files:**
- Modify: `src/context/NotificationContext.tsx` (เพิ่ม `group`, ย้ายตรรกะ persist ออกมา)
- Create: `src/context/notificationStorage.ts`
- Test: `src/context/notificationStorage.test.ts`
- Modify: `src/components/lis/NotificationBell.tsx`

**Interfaces:**
- Consumes: `readSeeAll` / `writeSeeAll` จาก Task 3, `normalizeRoles` จาก `src/lib/roles.ts`
- Produces: `capPersisted(list) → AppNotification[]`, `MAX_PERSISTED_PER_GROUP = 50`, และ field `group?: string` บน `AppNotification` (Task 4 ใช้)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/context/notificationStorage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { capPersisted, MAX_PERSISTED_PER_GROUP } from "./notificationStorage";
import type { AppNotification } from "./NotificationContext";

const n = (id: string, extra: Partial<AppNotification> = {}): AppNotification => ({
  id,
  title: id,
  level: "info",
  createdAt: Number(id.replace(/\D/g, "")) || 0,
  read: false,
  persistent: true,
  ...extra,
});

describe("capPersisted", () => {
  it("ทิ้งอันที่ไม่ persistent", () => {
    expect(capPersisted([n("1"), n("2", { persistent: false })]).map(x => x.id)).toEqual(["1"]);
  });

  it("เก็บอันที่ไม่มี group ไว้ทั้งหมด ไม่ว่าจะเยอะแค่ไหน", () => {
    const list = [n("daily-check-reminder", { createdAt: 1 })];
    for (let i = 0; i < MAX_PERSISTED_PER_GROUP + 10; i += 1) {
      list.push(n(`p${i + 100}`, { group: "petition", createdAt: i + 100 }));
    }
    const out = capPersisted(list);
    expect(out.some(x => x.id === "daily-check-reminder")).toBe(true);
  });

  it("เก็บเฉพาะ 50 อันใหม่สุดของแต่ละ group", () => {
    const list: AppNotification[] = [];
    for (let i = 0; i < MAX_PERSISTED_PER_GROUP + 10; i += 1) {
      list.push(n(`p${i}`, { group: "petition", createdAt: i }));
    }
    const out = capPersisted(list);
    expect(out).toHaveLength(MAX_PERSISTED_PER_GROUP);
    expect(out.some(x => x.createdAt === 0)).toBe(false);   // อันเก่าสุดถูกตัด
    expect(out.some(x => x.createdAt === 59)).toBe(true);   // อันใหม่สุดยังอยู่
  });

  it("รักษาลำดับเดิมของลิสต์", () => {
    const out = capPersisted([n("3", { group: "petition", createdAt: 3 }), n("1", { group: "petition", createdAt: 1 })]);
    expect(out.map(x => x.id)).toEqual(["3", "1"]);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run src/context/notificationStorage.test.ts`
Expected: FAIL — resolve `./notificationStorage` ไม่ได้

- [ ] **Step 3: เขียน implementation**

สร้าง `src/context/notificationStorage.ts`:

```ts
import type { AppNotification } from "./NotificationContext";

/** เพดานต่อ group — กันแจ้งเตือนที่ไหลเข้าเรื่อย ๆ (เช่น petition) กิน localStorage ข้ามวัน */
export const MAX_PERSISTED_PER_GROUP = 50;

/**
 * เลือกว่าอะไรควรถูกเก็บลง localStorage: เฉพาะ persistent, เก็บอันที่ไม่มี group ครบทุกอัน
 * (เช่น เตือน Daily Check ที่มีอันเดียวและห้ามหาย) ส่วนอันที่มี group เก็บ 50 อันใหม่สุดของ group นั้น
 * ลำดับในลิสต์เดิมถูกรักษาไว้
 */
export function capPersisted(list: AppNotification[]): AppNotification[] {
  const persistent = list.filter(n => n.persistent);

  const keptIds = new Set<string>();
  const byGroup = new Map<string, AppNotification[]>();

  for (const item of persistent) {
    if (!item.group) {
      keptIds.add(item.id);
      continue;
    }
    const bucket = byGroup.get(item.group) ?? [];
    bucket.push(item);
    byGroup.set(item.group, bucket);
  }

  for (const bucket of byGroup.values()) {
    [...bucket]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_PERSISTED_PER_GROUP)
      .forEach(item => keptIds.add(item.id));
  }

  return persistent.filter(n => keptIds.has(n.id));
}
```

แก้ `src/context/NotificationContext.tsx`:

1. เพิ่ม field ใน `AppNotification` (ต่อจาก `persistent?: boolean;` บรรทัด 17):

```ts
  /** จัดกลุ่มเพื่อจำกัดจำนวนที่เก็บลง localStorage แยกกัน (เช่น "petition") */
  group?: string;
```

2. เพิ่ม import ใต้บรรทัด 1:

```ts
import { capPersisted } from "./notificationStorage";
```

3. แทนที่ฟังก์ชัน `persist` (บรรทัด 52-59) ด้วย:

```ts
const persist = (list: AppNotification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capPersisted(list)));
  } catch {
    // ignore quota errors
  }
};
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/context/notificationStorage.test.ts`
Expected: PASS ทั้ง 4 เทสต์

- [ ] **Step 5: เพิ่มสวิตช์ "ดูทั้งระบบ" ใน `NotificationBell.tsx`**

เพิ่ม import ที่หัวไฟล์:

```tsx
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { normalizeRoles } from "@/lib/roles";
import { readSeeAll, writeSeeAll } from "@/lib/petitionAudience";
```

เพิ่ม state ในตัว component ต่อจากบรรทัด `const { notifications, ... } = useNotifications();`:

```tsx
  const { user } = useAuth();
  const isAdmin = normalizeRoles(user).includes("admin");
  const [seeAll, setSeeAll] = useState(() => readSeeAll());
```

แล้วแทรก UI ต่อจาก `</div>` ที่ปิดแถวหัว popover (บรรทัด 73 เดิม) ก่อน `{notifications.length === 0 ? (`:

```tsx
        {isAdmin && (
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <label htmlFor="notify-see-all" className="text-xs text-muted-foreground">
              ดูแจ้งเตือนทั้งระบบ (ไม่จำกัดแผนก)
            </label>
            <Switch
              id="notify-see-all"
              checked={seeAll}
              onCheckedChange={(value) => { setSeeAll(value); writeSeeAll(value); }}
            />
          </div>
        )}
```

- [ ] **Step 6: Type-check + เทสต์ทั้งชุด**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ในไฟล์ที่แตะ

Run: `npm run test`
Expected: PASS ทั้งหมด (เทสต์เดิมทั้งชุด + ที่เพิ่มใน Task 3, 5)

Run: `node --test server/lib/petitionNotifications.test.js server/lib/lineNotify.test.js`
Expected: PASS ทั้งสองไฟล์

- [ ] **Step 7: ทดสอบสวิตช์ด้วยตา**

ในแอป สลับ role เป็น `admin` ด้วย DevRoleSwitcher → เปิดกระดิ่ง
Expected: เห็นสวิตช์ "ดูแจ้งเตือนทั้งระบบ"; เปิดสวิตช์แล้ว Network ยิง request ใหม่ที่มี `all=1` ทันที (ไม่ต้องรอครบ 60 วิ)
สลับ role เป็น `qc-staff` → เปิดกระดิ่ง
Expected: ไม่มีสวิตช์

- [ ] **Step 8: Commit**

```bash
git add -- src/context/notificationStorage.ts src/context/notificationStorage.test.ts src/context/NotificationContext.tsx src/components/lis/NotificationBell.tsx
git commit -m "feat: cap persisted notifications per group + admin see-all toggle"
```

---

## เกณฑ์ว่าเสร็จ

- [ ] `node --test server/lib/petitionNotifications.test.js server/lib/lineNotify.test.js` ผ่านทั้งหมด
- [ ] `npm run test` ผ่านทั้งหมด
- [ ] `npx tsc -p tsconfig.app.json --noEmit` ไม่มี error ใหม่
- [ ] เปิดแอปด้วย role `qc-staff` แล้วเห็นแจ้งเตือนคำขอฝั่ง QC เด้งในกระดิ่ง กดแล้วไปหน้า `/petition/<id>` ได้
- [ ] รีเฟรชแล้วแจ้งเตือนยังอยู่ และที่ลบไปแล้วไม่กลับมา
- [ ] role `admin` เห็นสวิตช์ "ดูแจ้งเตือนทั้งระบบ" และเปิดแล้วเห็นของทุกแผนก
- [ ] กลุ่ม LINE ยังได้ข้อความเหมือนเดิม (ไม่ได้แก้ `lineNotify.js`)
