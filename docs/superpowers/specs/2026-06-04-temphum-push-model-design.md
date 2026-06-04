# TempHum Push Model — Design

**Date:** 2026-06-04
**Status:** Approved (verbal)

## Problem

The env-check page (`/LIS/daily-check/environment`) needs live temperature/humidity
from Node-RED sensors. The previous backend used a click-trigger flow (POST /trigger →
poll /status/:id → Node-RED claims → POST reading) and persisted every reading to the
`temphums` collection. The flow was never wired on the frontend and the persistence is
unwanted: we only want a DB write when the user explicitly saves a daily check.

## New model (push)

- **Node-RED** pushes a reading every ~minute: `POST /api/temphum` body `{ board, temp, hum }`.
- **Backend** keeps the latest reading **per board in memory only** (a `Map`). No DB write
  on push. Newer reading overwrites the older for that board.
- **Frontend** polls `GET /api/temphum` (~every 30s) → shows the live value per room,
  pre-fills the input. A reading older than ~3 min is flagged stale (sensor may be down).
- **Save** stays the only DB write: clicking "บันทึกผล" creates an `EnvCheck` record
  (existing `createEnvCheck`). Unchanged.
- Server restart drops the cache — acceptable, Node-RED refreshes within a minute.

## Changes

### Backend — `server/routes/temphum.js` (rewrite)
- Remove all trigger/status/claim endpoints and the in-memory `requests` map.
- Remove the `TempHum` model dependency (collection `temphums` no longer written; model
  file left in place, harmless).
- `POST /` — validate `board` (400 if missing), store `{ board, temp, hum, receivedAt }`
  in `latest` Map, return the stored reading.
- `GET /` — return `[...latest.values()]` (latest snapshot per board).

### Frontend — `src/pages/daily-check/EnvironmentCheckPage.tsx`
- `temphum/live` query `refetchInterval` 15000 → 30000.
- Add stale indicator: if `receivedAt` older than ~3 min, show a muted "ค่าเก่า" hint on
  the sensor row instead of treating it as fresh.
- Save flow unchanged.

### Config — `src/lib/dailyCheckEnv.ts`
- Demo: set each room `boardId` = its slug (`balance` / `sample-prep` / `analysis`) so
  pushing `board:"balance"` lights up ห้องชั่งสาร immediately. Comment that these get
  replaced with real device board names later (one line per room). Unmapped rooms still
  fall back to manual entry.

## Out of scope
- No DB history of the live stream (explicitly not wanted).
- Real device board IDs — still in demo; slugs are placeholders.
- Node-RED flow itself — documented separately for the user to build.
