# แจ้งเตือน Petition Flow ในกระดิ่ง (in-app notification)

วันที่: 2026-08-01

## ปัญหา

กระดิ่งแจ้งเตือน (`NotificationBell`) ตอนนี้มีผู้ส่งเข้ามาแหล่งเดียวคือ `DailyCheckReminderWatcher`
(เตือน 8:00 ว่ายังบันทึก Daily Check ไม่ครบ) ส่วนความเคลื่อนไหวของคำขอ (petition) — คำขอใหม่,
ถูกมอบหมายงาน, รับตัวอย่าง, ผลออก, ถูกตีกลับ — ไปออกที่ LINE กลุ่มอย่างเดียว คนที่ทำงานอยู่หน้าเว็บ
จึงไม่รู้ว่ามีงานเข้าจนกว่าจะกดรีเฟรชหน้ารายการเอง

## สิ่งที่มีอยู่แล้ว (ต่อยอดได้)

- `PetitionAuditLog` เก็บทุก event อยู่แล้ว: `created`, `statusChanged`, `assigned`, `reviewed`,
  `updated`, `deleted`, `received`, `resultEntered`, `resultUpdated`
- `server/lib/lineNotify.js` มี `audiencesForEvent()` / `describeEvent()` (pure + unit-tested)
  ที่ตัดสินอยู่แล้วว่า event ไหนควรบอกใคร และข้อความว่าอย่างไร
- `NotificationContext` รองรับ `persistent: true` (เก็บ localStorage ข้ามรีเฟรช) และกันซ้ำด้วย `id`
- `GET /api/petitions/audit-logs` (list + filter) — แต่ไม่ได้ join petition จึงไม่รู้ dept/assignee

## ขอบเขต (ตกลงกับผู้ใช้แล้ว)

| หัวข้อ | ที่ตกลง |
|---|---|
| ใครเห็น | ตามแผนก/บทบาท (audience เดียวกับ LINE) **+** งานที่ตัวเองถือ/ยื่นเสมอ |
| event ไหน | ครบทุกด่าน: คำขอใหม่+มอบหมาย, ความคืบหน้าระหว่างทาง, ผลออก/อนุมัติ/ปิดงาน, ตีกลับ |
| admin | ไม่ bypass — เห็นตามแผนกจริง แต่มีสวิตช์ "ดูทั้งระบบ" ในกระดิ่ง |
| อายุแจ้งเตือน | ย้อนหลัง 24 ชม. และอยู่ข้ามรีเฟรช |
| สถาปัตยกรรม | endpoint ใหม่ฝั่ง backend (reuse `describeEvent`) — ไม่ port logic มา TS ซ้ำ |

## Data flow

```
PetitionAuditLog ──┐
Petition ──────────┴─> GET /petitions/notifications?since&audiences&employeeId&all
                          bellDescribe() → isRelevant(viewer) → toNotification()
                              │ poll ทุก 60 วิ
                       PetitionFlowWatcher ──push──> NotificationContext ──> NotificationBell
```

### ทำไมไม่ต้องมี tombstone

Watcher เก็บ cursor `lastSeenAt` ใน localStorage แล้วขอเฉพาะ `since=cursor` แจ้งเตือนที่ผู้ใช้กด "ลบ"
ไปแล้วจะไม่ถูกดึงกลับมาเพราะ cursor เดินผ่านไปแล้ว — ไม่ต้องเก็บรายการ id ที่ลบทิ้ง
เปิดแอปครั้งแรก (ไม่มี cursor) ใช้ `now - 24h`

## Backend

### `server/lib/petitionNotifications.js` (ใหม่, pure, ไม่แตะ DB)

**`bellDescribe(petition, log)` → `{ audiences, title, message } | null`**

1. เรียก `describeEvent(petition, log)` ก่อนเสมอ — ถ้อยคำและ audience ใช้ร่วมกับ LINE
   แตกผลลัพธ์: บรรทัดแรกของ `text` = `title`, บรรทัดที่เหลือ (join ด้วย " · ") = `message`
2. ถ้าได้ `null` → ใช้ fallback เฉพาะกระดิ่ง (กระดิ่งรับความละเอียดได้มากกว่ากลุ่ม LINE):
   - `received` → `"📥 <side> รับตัวอย่าง <no>"`, audience = `metadata.side` (`lab`/`qc`)
   - `resultEntered` → `"🧪 เริ่มบันทึกผล <no>"`, audience = `metadata.side` ถ้ามี ไม่งั้นทั้งสองฝั่งที่งานนี้มี
3. **`resultUpdated` คืน `null` เสมอ** — การแก้ค่าทีละช่องจะเด้งรัวเกินไป (`resultEntered` ครั้งแรกพอ)
4. event อื่นที่ `describeEvent` ไม่รู้จัก (`reviewed`, `deleted`, `updated` ที่ไม่มี note) → `null`

**`isRelevant(desc, petition, viewer)` → boolean**
ผ่านเมื่อเข้าเงื่อนไขใดเงื่อนไขหนึ่ง:
- `viewer.seeAll === true`
- `desc.audiences` ตัดกับ `viewer.audiences`
- `petition.assignedTo?.employeeId === viewer.employeeId` (งานที่ตัวเองถือ)
- `petition.submittedBy?.employeeId === viewer.employeeId` (คำขอที่ตัวเองยื่น)

เทียบ `employeeId` เท่านั้น ไม่ fallback ไปเทียบชื่อ — ชื่อซ้ำกันได้และจะทำให้เห็นงานคนอื่น
ถ้า `viewer.employeeId` ว่าง ข้อสามและสี่ถือว่าไม่ผ่าน

**`levelForEvent(log)` → `NotificationLevel`**

| เงื่อนไข | level |
|---|---|
| `toStatus === 'rejected'` | `error` |
| `toStatus === 'success'` หรือ `'approved'` | `success` |
| `note` มีคำว่า "ผิดปกติ" | `warning` |
| อื่น ๆ | `info` |

**`toNotification(petition, log, desc)`** →
`{ id: String(log._id), petitionNo, title, message, level, link: '/petition/' + petitionId, createdAt: log.createdAt }`

`id` = `_id` ของ audit log ทำให้ `push()` กันซ้ำได้เองถ้า poll ทับช่วงเวลากัน

### `GET /api/petitions/notifications`

วางในไฟล์ `server/routes/petitions.js` ติดกับ `/audit-logs` — **ต้องอยู่ก่อน route `/:id`**
ไม่งั้น Express จะจับ `notifications` เป็น id

Query: `since` (ISO), `audiences` (csv), `employeeId`, `all` (`0`/`1`), `limit` (default 30, max 50)

1. `window = max(since ?? now-24h, now-24h)` — บังคับเพดาน 24 ชม. เสมอ ไม่ว่า client ส่ง `since` เก่าแค่ไหน
2. `PetitionAuditLog.find({ createdAt: { $gte: window } }).sort({ createdAt: -1 }).limit(200).lean()`
3. โหลด petition ที่เกี่ยวข้องทีเดียวด้วย `$in` (distinct `petitionId`) — `.select()` เฉพาะ field ที่
   `describeEvent` ใช้: `petitionNo dept status items.batchNo items.sampleName items.commonName
   submittedBy assignedTo qcCompletedAt labCompletedAt labApprovedAt` → ทำเป็น `Map`
4. ต่อ log: `bellDescribe` → `isRelevant` → `toNotification`
5. ตัดที่ `limit` แล้วคืน `{ items, serverTime: new Date().toISOString() }`

`serverTime` ให้ client ใช้เป็น cursor รอบถัดไป (กัน clock skew ระหว่างเครื่อง client กับ server)

log ที่หา petition ไม่เจอ (ถูกลบ/soft delete) ให้ข้าม

## Frontend

### `src/lib/petitionAudience.ts` (ใหม่, pure)

`audiencesForUser(user)` → `string[]` โดย union จาก 2 ทาง:

- **role**: `qc-head`, `qc-staff` → `qc` · `lab-head`, `lab-analyze` → `lab`
- **department**: match แบบ case-insensitive กับ enum `Petition.dept` (`production`/`rm`/`fg`)
  รองรับทั้งคำอังกฤษและไทย (เช่น `rm`, `วัตถุดิบ` → `rm`; `fg`, `สำเร็จรูป` → `fg`; `production`, `ผลิต` → `production`)

`admin` ไม่ได้ audience พิเศษ — ได้ตาม role/department จริงของตัวเอง

### `src/components/lis/PetitionFlowWatcher.tsx` (ใหม่)

คู่แฝดของ `DailyCheckReminderWatcher`:

- `useQuery({ queryKey: ['petition-notifications'], refetchInterval: 60_000, enabled: !!user })`
- ส่ง `audiences` จาก `audiencesForUser(user)`, `employeeId` จาก `user`, `all` จากสวิตช์ admin
- ทุกครั้งที่ได้ผล: `push({ ...item, persistent: true })` ทีละรายการ แล้วเขียน cursor = `serverTime`
- cursor key: `lis.petitionNotify.cursor.<employeeId>` (ไม่มี `employeeId` ใช้ `anonymous`) —
  ผูกกับคนเพื่อกันเคสสลับ user บนเครื่องเดียวกัน (dev role switcher) แล้วเห็น cursor ของคนก่อน
- ถ้ายังไม่มี user หรือ `audiences` ว่างและไม่มี `employeeId` → ไม่ยิง query

### แก้ของเดิม

- **`NotificationContext`** — จุดเดียว: ตอน `persist()` เก็บเฉพาะ 50 รายการล่าสุด กันบวมข้ามวัน
  (ตอนนี้เก็บทุกอันที่ `persistent` ไม่มีเพดาน)
- **`NotificationBell`** — เพิ่มสวิตช์ "ดูทั้งระบบ" ในหัว popover **แสดงเฉพาะ admin**
  เก็บสถานะที่ `localStorage['lis.petitionNotify.seeAll']`
- **`src/lib/api.ts`** — `getPetitionNotifications(params)`
- **`src/App.tsx`** — mount `<PetitionFlowWatcher />` ข้าง `<DailyCheckReminderWatcher />`

## Error handling

- endpoint ล้ม / เน็ตหลุด → React Query retry ตามค่า default แล้วรอบหน้าค่อยว่าใหม่;
  **ห้ามเลื่อน cursor** เมื่อ query ไม่สำเร็จ จะได้ไม่กลืน event ที่ยังไม่เคยแสดง
- `bellDescribe` คืน `null` = ข้าม ไม่ใช่ error
- localStorage เขียนไม่ได้ (quota/private mode) → กลืน exception เหมือน `persist()` เดิม

## Test

**`server/lib/petitionNotifications.test.js`** (node:test เหมือน `lineNotify.test.js`)
- `bellDescribe`: `created` ใช้ถ้อยคำเดียวกับ `describeEvent` และแตก title/message ถูก
- `bellDescribe`: `received` (LINE ไม่ส่ง) → ได้ข้อความ + audience จาก `metadata.side`
- `bellDescribe`: `resultUpdated` → `null` เสมอ
- `bellDescribe`: `reviewed` → `null`
- `isRelevant`: audience ตัดกัน / assignee ตรง / submitter ตรง / seeAll / ไม่เข้าสักข้อ → false
- `isRelevant`: `viewer.employeeId` ว่าง → ไม่ผ่านทางงานตัวเอง
- `levelForEvent`: ครบ 4 กรณีในตาราง
- `toNotification`: `id` = audit log id, `link` = `/petition/<petitionId>`

**`src/lib/petitionAudience.test.ts`** (vitest)
- role → audience (qc/lab, หลาย role รวมกัน)
- department → audience (อังกฤษ/ไทย, case-insensitive)
- `admin` ล้วน ๆ ไม่มี department → `[]` (ไม่ bypass)

ไม่ทำ e2e — watcher เป็น glue ล้วน ตรรกะที่มีความหมายอยู่ในสองไฟล์ pure ข้างบนหมดแล้ว

## นอกขอบเขต

- ไม่สร้าง Notification collection ใน DB (read state ยังไม่ sync ข้ามเครื่อง)
- ไม่มีหน้าตั้งค่าเลือกรับเฉพาะบาง event รายคน
- ไม่แตะ LINE — `describeEvent`/`audiencesForEvent` ใช้ตามเดิม ไม่แก้ไข พฤติกรรม LINE จึงไม่เปลี่ยน
- ไม่ทำ realtime (websocket/SSE) — poll 60 วิพอสำหรับ flow ระดับนี้
