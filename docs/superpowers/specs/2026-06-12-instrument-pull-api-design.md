# ดึงค่าจากเครื่องมือผ่าน API (Instrument Pull) — Design

**วันที่:** 2026-06-12
**สถานะ:** Spec (รออนุมัติ implementation plan)

## ปัญหา / เป้าหมาย

หลายค่าในผลการทดสอบมาจากเครื่องมือวัดโดยตรง (เช่น ความถ่วงจำเพาะ ถ.พ. มาจากเครื่องวัด density) เครื่องกำลังจะเปิด API ให้ดึงค่าได้ ต้องการให้ผู้ใช้ **กดปุ่มข้างช่องกรอก แล้ว LIS ไปดึงค่าล่าสุดจากเครื่องมาเติมให้** โดยรองรับได้ "หลายค่า/หลายเครื่อง" ไม่ใช่แค่ density

## การตัดสินใจหลัก (ตกลงแล้ว)

1. **ทิศทาง: Pull** — กดปุ่ม → LIS ยิง request ไปเครื่อง → ได้ค่าล่าสุดกลับมา (ไม่ใช่รอ push)
2. **Framework กลาง** — config map `พารามิเตอร์ ↔ เครื่อง ↔ endpoint`; เพิ่มเครื่องใหม่ = เพิ่ม config ไม่ต้องแก้โค้ด
3. **Backend เป็น proxy** — frontend เรียก LIS backend, backend ยิงไปเครื่องในวง LAN (เลี่ยง CORS/mixed-content, ซ่อน endpoint+credential)
4. **Auto-fill แก้ได้ + เก็บ provenance** — ค่าที่ดึงมาเติมในช่อง ผู้ใช้แก้ได้ แต่บันทึกว่าค่ามาจากเครื่องไหน/เมื่อไหร่/ใครดึง
5. **Coexist กับ RealtimeDensity เดิม** — push-by-sampleId ของเดิมยังอยู่ ไม่แตะ; density เป็น `InstrumentSource` ตัวแรกของ pull. ค่อยพิจารณา migrate ทีหลังถ้า pull เวิร์ก

## สถาปัตยกรรม

```
[หน้า Record/Lab]  --กดปุ่ม-->  [LIS backend proxy]  --GET-->  [เครื่องมือใน LAN]
   auto-fill + badge  <--JSON--   value/raw/ts/ok   <--JSON--   latest reading
```

### 1) Model: `InstrumentSource` (config กลาง)

`server/models/InstrumentSource.js` — soft-delete plugin เหมือน model อื่น

| field | type | ความหมาย |
|---|---|---|
| `key` | String (unique) | คีย์พารามิเตอร์ ผูกกับ field ในผล เช่น `density` |
| `label` | String | ชื่อแสดง เช่น "ความถ่วงจำเพาะ (ถ.พ.)" |
| `instrumentName` | String | ชื่อเครื่อง เช่น "DMA 4500" |
| `fetchUrl` | String | endpoint ของเครื่อง (เก็บฝั่งเซิร์ฟเวอร์เท่านั้น) |
| `method` | String | default `GET` |
| `authHeader` | String | header ใส่ token/apiKey ถ้าเครื่องต้องการ (optional) |
| `responsePath` | String | path ไปยังค่าใน JSON ที่เครื่องตอบ เช่น `data.value` |
| `unit` | String | หน่วย เช่น `g/mL` |
| `decimals` | Number | ปัดทศนิยมตอนแสดง |
| `enabled` | Boolean | เปิด/ปิดต่อเครื่อง |
| `timeoutMs` | Number | default 5000 |

- index: `{ key:1, deletedAt:1 }` unique
- จัดการผ่านหน้า Settings (แพทเทิร์นเดียวกับ `EnvRoomConfig`) — list/create/edit/disable
- seed: สร้างแถว `density` เป็นตัวอย่างแรก (fetchUrl ใส่จริงตอนเครื่องพร้อม)

### 2) Backend proxy

Route ใหม่ `server/routes/instrument-readings.js`, mount ผ่าน `mountApi()` (ได้ทั้ง `/api/*` และ `/LIS/api/*`):

`GET /api/instrument-readings/:key/latest`

ขั้นตอน:
1. โหลด `InstrumentSource` ตาม `key` (ถ้าไม่เจอ/`enabled:false` → 404/422 พร้อมข้อความ)
2. server-side `fetch(fetchUrl, { method, headers:{authHeader}, signal: timeout })`
3. แกะค่าด้วย `responsePath` (helper อ่าน nested path ปลอดภัย)
4. ตอบกลับ:

```json
{
  "ok": true,
  "key": "density",
  "value": 0.998,
  "unit": "g/mL",
  "instrument": "DMA 4500",
  "readingAt": "2026-06-12T07:23:00.000Z",
  "raw": { "...": "payload ดิบจากเครื่องไว้ debug/trace" }
}
```

เคส error (timeout / เครื่องไม่ตอบ / parse ไม่ได้ / responsePath ไม่เจอ):

```json
{ "ok": false, "key": "density", "error": "เครื่องไม่ตอบ (timeout)" }
```

> ตอบ HTTP 200 พร้อม `ok:false` เพื่อให้ UI จัดการง่าย ไม่ throw — หรือ 502 ก็ได้ ตัดสินตอน implement. หลักคือ **หน้าไม่พัง** และผู้ใช้เห็นว่า "ดึงไม่ได้ ลองใหม่/กรอกมือ"

**Contract ฝั่งเครื่อง (เรากำหนดเอง — ส่งให้คนเซ็ต API ทำตาม):**
เครื่องเปิด endpoint `GET` คืน JSON ที่มีค่าล่าสุด 1 ค่า + timestamp; รูปแบบ field อะไรก็ได้เพราะ `responsePath`/`readingAt` map ได้ที่ config. แนะนำขั้นต่ำ:
```json
{ "value": 0.998, "unit": "g/mL", "measuredAt": "2026-06-12T07:23:00Z" }
```

### 3) Provenance (ร่องรอย)

เพิ่ม sub-object `valueSources` ใน `PhysicalResult` (และ `QCTestResult` ถ้ามี field ที่ดึงจากเครื่อง) — เก็บ meta เฉพาะ field ที่ดึงจากเครื่อง:

```js
valueSources: {
  density: {
    source: 'instrument',        // 'instrument' | 'instrument-edited' | 'manual'
    instrument: 'DMA 4500',
    rawValue: 0.998,             // ค่าที่ดึงมาดิบ ไว้ trace แม้ผู้ใช้แก้
    fetchedAt: '2026-06-12T07:23:00.000Z',
    fetchedBy: 'นายเอ'
  }
}
```

- ดึงครั้งแรก → `source:'instrument'`
- ผู้ใช้แก้ค่าหลังดึง → `source:'instrument-edited'` (ยังเก็บ `rawValue` เดิม)
- กรอกมือล้วน ไม่เคยกดปุ่ม → ไม่มี entry (= manual)
- schema เป็น `Mixed`/sub-doc แบบ key เป็น paramKey เพื่อ generalize หลายค่า

### 4) Frontend

**API layer** (`src/lib/api.ts`):
```ts
fetchInstrumentReading: (key: string) =>
  request<InstrumentReading>(`/instrument-readings/${key}/latest`)
```

**Component reuse** `src/components/lis/InstrumentFetchButton.tsx`:
- props: `paramKey`, `onValue(value, provenance)`, `disabled`
- กด → React Query mutation เรียก proxy
- สำเร็จ → เรียก `onValue` (พ่อแม่ auto-fill ลง field + เก็บ provenance state) + แสดง badge `📡 DMA 4500 • 14:23`
- ล้มเหลว → toast/ข้อความ "ดึงไม่ได้ — กรอกมือได้เลย" ปุ่มกดซ้ำได้
- กำลังโหลด → spinner ในปุ่ม

**จุดวาง:** ข้างช่องกรอกที่มาจากเครื่องในหน้า Lab/Record results (เริ่มที่ช่อง density). เมื่อผู้ใช้พิมพ์แก้ช่องนั้นเอง → badge เปลี่ยนเป็น "✎ แก้ด้วยมือ" และ provenance `source` → `instrument-edited`.

## Error handling

- เครื่อง timeout/ล่ม → `ok:false`, UI ขึ้นข้อความ ไม่บล็อกการกรอกมือ
- `responsePath` ผิด → `ok:false` พร้อม error ชี้ชัด (ช่วย debug ตอน config)
- key ไม่มีใน config → 404 + ข้อความให้ไปตั้งใน Settings
- ปุ่มกดรัวๆ → debounce/disable ระหว่างโหลด

## Testing

- **Unit (Vitest):** helper อ่าน `responsePath` (nested path, missing key, array index); แปลง provenance state เมื่อแก้ค่า
- **Backend:** mock fetch — เคส ok / timeout / parse fail / responsePath miss
- **E2E (Playwright, manual ก่อน):** mock instrument endpoint → กดปุ่ม → ค่าเข้าช่อง + badge; แก้ค่า → badge เปลี่ยน; เซฟ → provenance ลง DB

## ขอบเขตที่ "ยังไม่ทำ" (YAGNI)

- ไม่ทำ auto-poll/subscribe — pull on-demand อย่างเดียว
- ไม่ migrate RealtimeDensity push ตอนนี้
- ไม่ทำ retry/queue ฝั่งเซิร์ฟเวอร์ — กดใหม่เอาเอง
- ไม่ทำ multi-reading history — เก็บแค่ค่าที่ดึงล่าสุดตอนเซฟผล (provenance)

## ไฟล์ที่เกี่ยวข้อง (โดยประมาณ)

- `server/models/InstrumentSource.js` (ใหม่)
- `server/routes/instrument-readings.js` (ใหม่) + mount ใน `server/index.js`
- `server/models/PhysicalResult.js` (เพิ่ม `valueSources`)
- `src/lib/api.ts` (เพิ่ม endpoint + type)
- `src/components/lis/InstrumentFetchButton.tsx` (ใหม่)
- หน้า Settings สำหรับ `InstrumentSource` (แพทเทิร์น `EnvRoomConfig`)
- หน้า Lab/Record results — วางปุ่มข้างช่อง density
- `npm run seed:export` หลังเพิ่ม model + seed density row
