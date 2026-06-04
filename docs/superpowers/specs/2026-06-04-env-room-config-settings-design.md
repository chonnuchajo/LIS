# Env Room Config in System Settings — Design

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Branch:** develop

## Problem

The Environment Check page (`/LIS/daily-check/environment`) maps each room to a
Node-RED sensor board via `boardId`. Today those mappings — plus the
temperature/humidity thresholds — are **hardcoded** in `src/lib/dailyCheckEnv.ts`
(`ENV_ROOMS`). All three rooms currently ship with `boardId: ""`, so every card
shows "ไม่มีเซนเซอร์ — กรอกเอง" and users must type readings manually.

Changing which board feeds which room, or adjusting a threshold, requires editing
code and redeploying. We want lab staff to do this from the **ตั้งค่าระบบ**
(System Settings) page, with the value shared across every machine.

## Goal

From the System Settings page, an authorized user can, per environment room:
- assign which Node-RED **board** feeds it (or set "no sensor / manual entry"),
- edit the **temp/humidity thresholds** (`tempMin`, `tempMax`, `humidityMax`),

and have the Environment Check page pick up those values immediately (badge flips
to "เซนเซอร์ • อัปเดต HH:MM", live pre-fill + "ดึงค่าล่าสุด" enabled) without a
code change. Config is stored in MongoDB so it is shared across machines and
backed up by the existing `seed:export` auto-sync.

## Approach (chosen: A — fixed rooms, DB overrides)

Rooms stay **fixed in code** (`balance`, `sample-prep`, `analysis`) — they map 1:1
to physical lab rooms and to daily-check room routing + `evaluateEnv`, so `slug`
remains a stable identity. The DB only stores **per-room overrides**: `boardId`
and the three thresholds. `dailyCheckEnv.ts` keeps `slug → label` and the default
thresholds; a room with no DB doc falls back to those code defaults.

Rejected — Approach B (fully dynamic add/remove rooms in DB): more work and risk
(slug is wired into routing and evaluation) for flexibility we don't need (exactly
three physical rooms, rarely changing). YAGNI.

## Data Model — `EnvRoomConfig`

New collection, **one doc per room slug**:

```js
// server/models/EnvRoomConfig.js
{
  slug: String,        // enum ['balance','sample-prep','analysis'], unique, required
  boardId: String,     // default '' → manual entry only
  tempMin: Number,     // required
  tempMax: Number,     // required
  humidityMax: Number, // required
  // timestamps: true
}
```

- `label` is **not** stored — it lives in code (`dailyCheckEnv.ts`) keyed by slug.
- Auto-created on boot by the existing `loadAllModels()` + `ensureCollections()`
  flow; picked up by `seed:export` automatically (dynamic `listCollections()`),
  so no seed wiring is needed.

## Backend — `routes/envRoomConfig.js`, mounted `/env-room-config`

Mounted twice via `mountApi('/env-room-config', …)` in `server/index.js`
(alongside `/env-checks`, `/temphum`).

- **`GET /`** → returns all three rooms, always complete. For each slug in the
  code's room list, return the DB doc if present, else a synthesized default
  (`boardId: ''` + code default thresholds). Shape: `{ data: EnvRoomConfig[] }`.
  Does **not** write defaults to the DB (read stays side-effect-free).
- **`PUT /:slug`** → upsert (`findOneAndUpdate … upsert:true`) `boardId` +
  thresholds for one room. Validates slug ∈ allowed set and the threshold rules
  below; returns `{ data: <doc> }`. 400 on invalid body/slug.

Threshold validation (server, mirrored on client):
- `tempMin`, `tempMax`, `humidityMax` are finite numbers,
- `tempMin ≤ tempMax`,
- `humidityMax > 0`.
- `boardId` is a string; empty string allowed (= manual).

## Shared validation — `src/lib/dailyCheckEnv.ts`

Add a pure `validateEnvRoomConfig(input)` returning a field-level error or null,
reused by the Settings form (inline errors) and conceptually matching the server
checks. Keep the existing `ENV_ROOMS` export as the **defaults** source (no
rename — avoids import churn) and add a merge helper
`mergeEnvRooms(defaults, dbConfigs): EnvRoom[]` that overlays DB
`boardId`/thresholds onto the code defaults by slug, preserving `label`.

Note: `EnvironmentCheckPage` currently uses `ENV_ROOMS.find(...)` inside the
create mutation's `onSuccess` (to label the toast and evaluate pass/fail). After
the switch it must use the **merged** room (from `useEnvRooms()`), not the raw
defaults, so the toast/evaluation reflect any edited thresholds.

## Frontend — API layer (`src/lib/api.ts`)

```ts
export type EnvRoomConfig = {
  slug: "balance" | "sample-prep" | "analysis";
  boardId: string;
  tempMin: number; tempMax: number; humidityMax: number;
};
getEnvRoomConfigs: () => request<{ data: EnvRoomConfig[] }>("/env-room-config").then(r => r.data),
updateEnvRoomConfig: (slug, input) =>
  request<{ data: EnvRoomConfig }>(`/env-room-config/${slug}`, { method: "PUT", body: JSON.stringify(input) }).then(r => r.data),
```

## Frontend — `useEnvRooms()` hook

New hook that:
- queries `getEnvRoomConfigs()` (React Query, key `["env-room-config"]`),
- merges via `mergeEnvRooms(ENV_ROOM_DEFAULTS, data)` → `EnvRoom[]`,
- returns the merged rooms (falls back to pure defaults while loading / on error).

`EnvironmentCheckPage` switches from importing the static `ENV_ROOMS` to using
`useEnvRooms()`. No other logic in that page changes — `liveForRoom`,
pre-fill, and `pullLatest` already key off `room.boardId`, so a configured board
lights up the sensor badge automatically.

## Frontend — Settings UI (`src/pages/SettingsPage.tsx`)

Replace the "อยู่ระหว่างพัฒนา" placeholder body with a section
**"ตั้งค่าห้องตรวจสภาพแวดล้อม (Environment)"**. One card per room (3 cards),
each showing the Thai `label` and these controls:

- **Board selector** — a `Select` whose options are the union of:
  - boards detected live from `getLiveTempHum()` (the `board` field),
  - the room's currently-saved `boardId` (so a saved-but-offline board still shows),
  - a **"— ไม่มี (กรอกมือ)"** option mapping to `boardId: ""`,
  - a **"พิมพ์เอง…"** option that reveals a text input to enter a board id that
    has never posted yet.
  Helps the empty-`temphums` case: today the dropdown lists only the two synthetic
  options, and the user types the board id their Node-RED flow will send.
- **Thresholds** — number inputs `tempMin`, `tempMax`, `humidityMax`.
- **บันทึก** button per room → `updateEnvRoomConfig`, then a `sonner` toast and
  React Query invalidation of `["env-room-config"]` (and the env page picks it up).
  Disable Save while a validation error is present.

Access: the Settings route already exists in `navItems`/`App.tsx`; reuse its
current access control (no new permission paths).

## Data Flow

1. Node-RED `POST /api/temphum { board, temp, hum }` → readings accumulate in
   `temphums`; `getLiveTempHum()` exposes the latest per board.
2. Settings page reads detected boards + current config, user assigns a board /
   edits thresholds, `PUT /env-room-config/:slug` upserts the doc.
3. `useEnvRooms()` (used by both Settings and the Env page) re-fetches → merged
   `EnvRoom[]` now carries the chosen `boardId` + thresholds.
4. Env page: `liveForRoom(room)` finds `liveByBoard[room.boardId]` → badge shows
   "เซนเซอร์ • อัปเดต HH:MM", value pre-fills, "ดึงค่าล่าสุด" enabled.

## Error Handling

- `GET /env-room-config` always returns all three rooms even with an empty
  collection (synthesized defaults). Page still works if the request fails
  (hook falls back to code defaults).
- Invalid threshold/slug on `PUT` → 400 with a Thai message; client shows inline
  field error and keeps the Save button disabled.
- Saving a `boardId` that no board has posted yet is **allowed** (forward
  configuration) — the env card simply stays "กรอกมือ" until that board sends data.

## Testing

- **Unit (Vitest):** `validateEnvRoomConfig` (good/bad thresholds, ordering,
  humidityMax ≤ 0); `mergeEnvRooms` (DB overlay wins, missing slug → default,
  label preserved).
- **Smoke (Vitest/RTL):** `SettingsPage` renders 3 room cards, each with a board
  selector + three threshold inputs; selecting "พิมพ์เอง…" reveals the text input.
- **Server:** `PUT` validation rejects `tempMin > tempMax` and `humidityMax <= 0`;
  `GET` returns 3 rooms from an empty collection.

## Out of Scope (YAGNI)

- Add/remove/rename rooms from the UI (Approach B).
- Editing room `label` from the UI.
- Live capture-trigger flow changes (the existing `/temphum/trigger` polling and
  "ดึงค่าล่าสุด" behavior are unchanged).
