# ห้องเตรียมตัวอย่าง — Daily Equipment Working-Check

**Date:** 2026-06-05
**Status:** Approved (design) — pending implementation plan
**Branch:** develop

## Summary

Replace the `sample-prep` placeholder in Daily Check with a working page that lets lab
staff record a **daily working-check** for the room's main instruments — for each
instrument, per day: is it working normally, an optional equipment-specific reading
(temperature or pH), and a free-text note. This mirrors the existing
`BalanceRoomPage` pattern (card-per-machine + history tab), not a full per-use
logbook.

The temperature/humidity form is **out of scope** — it is already handled centrally in
the `/daily-check/environment` tab.

## Scope

### In scope — 13 "main group" instruments

| Group | Instruments (code) | Readings captured |
|---|---|---|
| Status only | Ultrasonic (LD-007), Ultrasonic (LD-008), Ultrasonic Cleaner (LD-046), Asirator pump (LD-041), Hotplate (LD-025), Hotplate (LD-026), Magnetic stirrer (LD-012), Magnetic stirrer (LD-040) | — |
| + Temperature | Hot Air Oven (LD-009), Oven (LD-010), Water bath (LD-029), Desiccator (LD-016) | temp (°C) |
| + pH | pH Meter (LD-011) | pH |

Each check records: `status` (normal/abnormal), the group's reading(s) if any, and an
optional note. Recorder is taken automatically from the logged-in user.

### Out of scope (deferred to a later phase)

- **milli-Q** (LD-023, LD-035), **Density Meter** (LD-024), **Hood** (LD-028) — these
  paper forms have bespoke multi-column layouts (conductivity/volume, pesticide
  type/density/sample-no, time-range). The data model is designed to absorb them later
  without a schema change.
- **"ผู้ตรวจสอบ" (reviewer) sign-off** — the paper footer field. Not modeled now.
- Temperature/humidity (already in the `environment` tab).

## Approach

**Chosen: generic `EquipmentCheck` collection + per-room instrument catalog**
(Approach A of three considered).

- Rejected **B** (sample-prep-specific model/page): would force duplication when the
  analysis and extraction rooms get the same treatment.
- Rejected **C** (extend the existing `DailyCheck` model): `DailyCheck` carries
  calibration-specific required fields (`avg100`, `status100`, weight arrays); mixing a
  second record shape into it risks the working balance-room flow.

The generic collection keys every record by `roomSlug` + `instrumentId`, so the same
model, route, and page shape can serve future rooms.

## Components

### 1. Data model — `server/models/EquipmentCheck.js`

New Mongoose model, collection `equipmentchecks`.

```js
{
  roomSlug:       String,  // "sample-prep"   (required, indexed)
  instrumentId:   String,  // "LD-009"        (required, indexed)
  instrumentName: String,  // "Hot Air Oven"  (required)
  brand:          String,  // "Memmert"       (default "")

  status: String,          // enum ["normal","abnormal"] (required, indexed)

  // 0..n readings — drives display; absent for status-only instruments
  readings: [{
    key:   String,         // "temp" | "ph"
    label: String,         // "อุณหภูมิ" | "pH"
    value: Number,
    unit:  String,         // "°C" | ""
  }],

  note: String,            // default ""

  recorder:      String,   // required
  recorderId:    String,   // default ""
  recorderEmail: String,   // default ""

  date:      String,       // "YYYY-MM-DD" (required, indexed) — fast per-day filter
  checkedAt: Date,         // required, default Date.now
}
// timestamps: true
// compound index: { roomSlug: 1, date: -1, instrumentId: 1 }
```

Semantics: **POST appends a new record**. The latest record of `instrumentId` for the
current `date` is treated as "today's status" (same convention as `BalanceRoomPage`).
History keeps every record. No upsert, no delete in this phase.

### 2. Instrument catalog — `src/lib/samplePrepInstruments.ts`

Static config (the analog of `SCALES` in `BalanceRoomPage`), the single source of truth
for which instruments render and what each one captures.

```ts
type ReadingField = { key: string; label: string; unit: string };
type ReadingGroup = "basic" | "temp" | "ph";

interface SamplePrepInstrument {
  id: string;            // "LD-009"
  name: string;          // "Hot Air Oven"
  brand: string;         // "Memmert"
  group: ReadingGroup;
  readings: ReadingField[]; // [] | [{key:"temp",...}] | [{key:"ph",...}]
}

export const SAMPLE_PREP_ROOM_SLUG = "sample-prep";
export const SAMPLE_PREP_INSTRUMENTS: SamplePrepInstrument[] = [ /* 13 entries */ ];

// helpers
export const samplePrepGroups: { key: ReadingGroup; label: string }[];
export const getSamplePrepInstrument = (id: string) => ...;
```

Group labels (Thai): basic → "เครื่องมือทั่วไป", temp → "วัดอุณหภูมิ", ph → "วัด pH".

### 3. Backend route — `server/routes/equipment-checks.js`

- `GET /equipment-checks` — query params: `room` (required), `date`, `instrumentId`,
  `status`. Returns records sorted `checkedAt` desc.
- `POST /equipment-checks` — validates `roomSlug`, `instrumentId`, `instrumentName`,
  `status` ∈ {normal,abnormal}, `recorder`; coerces `date`/`checkedAt`; saves and
  returns the created doc. Reading values validated numeric when present.

Mounted in `server/index.js` via the existing `mountApi()` (so available at both
`/api/*` and `/LIS/api/*`). `ensureCollections()` auto-creates the collection and runs
`syncIndexes()` on boot.

### 4. API layer — `src/lib/api.ts`

Add `EquipmentCheckRecord` type and:
- `getEquipmentChecks(params: { room; date?; instrumentId?; status? })`
- `createEquipmentCheck(payload)`

### 5. Page — `src/pages/daily-check/SamplePrepRoomPage.tsx`

Replaces `<RoomPlaceholderPage slug="sample-prep" />` in `src/App.tsx`. Structure
mirrors `BalanceRoomPage`:

- **Header summary:** `ตรวจแล้ว x/13` · `ปกติ y/13` (counts from today's latest-per-instrument).
- **Tab "บันทึกผล":** instrument cards grouped under the three section headings. Each card:
  instrument name + code + brand; status toggle (ปกติ / ผิดปกติ); numeric reading input(s)
  per the catalog (temp or pH); note field; recorder (read-only, from `useAuth`); save
  button. After save the card shows today's recorded status with a "บันทึกซ้ำ" reset
  (same affordance as balance).
- **Tab "รายการบันทึก":** history table with filters (date / instrument / status) and a
  reset-filters button. Columns: date, time, instrument, status, reading(s), note,
  recorder.

Data via TanStack React Query: a `today` query (date = today) and a filtered `history`
query; `createEquipmentCheck` mutation invalidates `["equipment-checks"]`.

### 6. Catalog/route wiring

- `src/lib/dailyCheckRooms.ts`: set the `sample-prep` room `ready: true`.
- `src/App.tsx`: import and route `SamplePrepRoomPage` for `path="sample-prep"`.

## Data flow

1. Page mounts → React Query fetches `GET /equipment-checks?room=sample-prep&date=<today>`.
2. Latest record per `instrumentId` → card's "today" status; summary counts derived.
3. User fills a card → `POST /equipment-checks` → on success, invalidate queries → card
   reflects saved status.
4. History tab issues a second filtered query independently.

## Error handling

- POST validation failures return 400 with a Thai message; the page surfaces it via
  `toast.error` (matching `BalanceRoomPage`).
- Missing logged-in user name blocks save with a toast (mirror balance behaviour).
- Reading inputs are numeric; non-numeric entry is rejected client-side before POST.

## Testing

- **Vitest** `src/lib/samplePrepInstruments.test.ts`: catalog integrity — 13 entries,
  unique ids, every `temp`/`ph` group has a matching `readings` entry, status-only group
  has empty `readings`.
- Reuse the existing test conventions in `src/pages/daily-check/__tests__/`.
- `npx tsc --noEmit` for type-check (per project gotchas — no `npm run build`).

## Seed data

After first real entries exist, `npm run seed:export` picks up the new `equipmentchecks`
collection automatically (dynamic `listCollections()`); commit `seed-data/` so it stays
restorable.

## Out-of-scope / future phases

1. milli-Q, Density Meter, Hood instruments (bespoke reading columns — `readings[]`
   already accommodates them).
2. Reviewer ("ผู้ตรวจสอบ") sign-off.
3. Same pattern applied to the analysis and extraction rooms (the generic
   `EquipmentCheck` model is built for this).
