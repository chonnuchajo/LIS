# Env Room Config in System Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authorized user assign each environment room's Node-RED board and edit its temp/humidity thresholds from the System Settings page, stored in MongoDB and shared across machines.

**Architecture:** Rooms stay fixed in code (`dailyCheckEnv.ts` = slug→label + default thresholds + default boardId). A new `EnvRoomConfig` collection stores per-room overrides (`boardId` + thresholds). A `GET /env-room-config` always returns all three rooms (synthesizing defaults for rooms with no doc); `PUT /:slug` upserts one room. The frontend merges DB config over code defaults via `mergeEnvRooms()`; both the Settings UI and the Environment Check page consume the merged rooms through a `useEnvRooms()` hook.

**Tech Stack:** Express 4 + Mongoose 8 (server), React 18 + TypeScript + TanStack React Query + shadcn/ui (client), Vitest (tests).

---

## Context for the implementer

- The server auto-registers every file in `server/models/` on boot (`loadAllModels()` in `server/index.js:63`) and runs `syncIndexes()` via `ensureCollections()`. **Creating the model file is enough** — no manual registration.
- Routes are mounted twice (`/api/*` and `/LIS/api/*`) via `mountApi()` in `server/index.js`. Existing env routes are mounted at lines 45-47 (`daily-checks`, `temphum`, `env-checks`).
- The client API layer is `src/lib/api.ts`; it already imports shared types from sibling libs (e.g. `@/lib/standardConfig`), so importing a type from `@/lib/dailyCheckEnv` follows the existing pattern.
- **NOTE — file changed recently:** `src/lib/dailyCheckEnv.ts` now ships DEMO defaults `boardId = slug` (e.g. `balance`) and also exports `isReadingStale` / `STALE_AFTER_MS`. Preserve all of that. Our merge overlays DB values on top of these defaults.
- The Environment Check page (`src/pages/daily-check/EnvironmentCheckPage.tsx`) uses `ENV_ROOMS` in 5 places: line 126 (`onSuccess` find), 188 & 191 (`.length`), 208 (`.map` cards), 382 (`.map` history-filter dropdown). All switch to the merged `rooms`.
- Commit with explicit pathspecs only (a concurrent committer sometimes touches this repo) — never `git add -A`.

## File Structure

- **Create** `server/models/EnvRoomConfig.js` — Mongoose model, one doc per room slug.
- **Create** `server/routes/envRoomConfig.js` — `GET /` (all rooms, defaults filled) + `PUT /:slug` (upsert).
- **Modify** `server/index.js` — mount the new route.
- **Modify** `src/lib/dailyCheckEnv.ts` — add `EnvRoomConfig`/`EnvRoomConfigInput` types, `validateEnvRoomConfig()`, `mergeEnvRooms()`. (Keep `ENV_ROOMS` as the defaults source.)
- **Modify** `src/lib/dailyCheckEnv.test.ts` — tests for the two new pure functions.
- **Modify** `src/lib/api.ts` — `getEnvRoomConfigs()` + `updateEnvRoomConfig()`.
- **Create** `src/hooks/useEnvRooms.ts` — query + merge → `EnvRoom[]`.
- **Create** `src/components/lis/EnvRoomConfigCard.tsx` — per-room editor (board selector + thresholds + save).
- **Modify** `src/pages/SettingsPage.tsx` — render the env-room config section.
- **Create** `src/pages/__tests__/SettingsPage.test.tsx` — smoke test (3 cards, controls).
- **Modify** `src/pages/daily-check/EnvironmentCheckPage.tsx` — use `useEnvRooms()` instead of `ENV_ROOMS`.
- **Modify** `src/pages/daily-check/__tests__/EnvironmentCheckPage.test.tsx` — add `getEnvRoomConfigs` to the api mock.

---

## Task 1: Backend model `EnvRoomConfig`

**Files:**
- Create: `server/models/EnvRoomConfig.js`

- [ ] **Step 1: Write the model**

```js
// server/models/EnvRoomConfig.js
const mongoose = require('mongoose');

const EnvRoomConfigSchema = new mongoose.Schema({
  slug: {
    type: String,
    enum: ['balance', 'sample-prep', 'analysis'],
    required: true,
    unique: true,
    index: true,
  },
  boardId: { type: String, default: '' },   // '' = no sensor / manual entry
  tempMin: { type: Number, required: true },
  tempMax: { type: Number, required: true },
  humidityMax: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('EnvRoomConfig', EnvRoomConfigSchema);
```

- [ ] **Step 2: Verify the model loads on boot**

Run: `cd server && node -e "require('./models/EnvRoomConfig'); console.log('ok')"`
Expected: prints `ok` with no Mongoose schema error.

- [ ] **Step 3: Commit**

```bash
git add server/models/EnvRoomConfig.js
git commit -m "feat(env-config): add EnvRoomConfig model (board + thresholds per room)"
```

---

## Task 2: Backend route `/env-room-config`

**Files:**
- Create: `server/routes/envRoomConfig.js`
- Modify: `server/index.js` (mount the route after the `env-checks` mount, ~line 47)

- [ ] **Step 1: Write the route**

The defaults in `ROOM_DEFAULTS` must match `ENV_ROOMS` in `src/lib/dailyCheckEnv.ts` (slug order + default thresholds). `GET` synthesizes a default for any room without a DB doc but does **not** write it. `PUT` validates and upserts.

```js
// server/routes/envRoomConfig.js
const express = require('express');
const router = express.Router();
const EnvRoomConfig = require('../models/EnvRoomConfig');

// Mirror of src/lib/dailyCheckEnv.ts ENV_ROOMS defaults (boardId default = slug demo).
const ROOM_DEFAULTS = [
  { slug: 'balance',     boardId: 'balance',     tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: 'sample-prep', boardId: 'sample-prep', tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: 'analysis',    boardId: 'analysis',    tempMin: 15, tempMax: 25, humidityMax: 70 },
];
const ALLOWED_SLUGS = ROOM_DEFAULTS.map((r) => r.slug);

function pick(doc) {
  return {
    slug: doc.slug,
    boardId: doc.boardId || '',
    tempMin: doc.tempMin,
    tempMax: doc.tempMax,
    humidityMax: doc.humidityMax,
  };
}

// Validate thresholds; mirrors validateEnvRoomConfig on the client. Returns
// an error string or null.
function validate(body) {
  const { tempMin, tempMax, humidityMax } = body;
  for (const [field, v] of [['tempMin', tempMin], ['tempMax', tempMax], ['humidityMax', humidityMax]]) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return `${field} ต้องเป็นตัวเลข`;
  }
  if (tempMin > tempMax) return 'อุณหภูมิต่ำสุดต้องไม่เกินสูงสุด';
  if (humidityMax <= 0) return 'ความชื้นสูงสุดต้องมากกว่า 0';
  return null;
}

// GET /api/env-room-config — always returns all 3 rooms (DB doc or default).
router.get('/', async (req, res) => {
  try {
    const docs = await EnvRoomConfig.find().lean();
    const bySlug = new Map(docs.map((d) => [d.slug, d]));
    const data = ROOM_DEFAULTS.map((def) => {
      const d = bySlug.get(def.slug);
      return d ? pick(d) : { ...def };
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/env-room-config/:slug — upsert one room's board + thresholds.
router.put('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!ALLOWED_SLUGS.includes(slug)) {
      return res.status(400).json({ error: 'slug ไม่ถูกต้อง' });
    }
    const err = validate(req.body || {});
    if (err) return res.status(400).json({ error: err });

    const { boardId, tempMin, tempMax, humidityMax } = req.body;
    const doc = await EnvRoomConfig.findOneAndUpdate(
      { slug },
      { slug, boardId: typeof boardId === 'string' ? boardId : '', tempMin, tempMax, humidityMax },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    res.json({ data: pick(doc) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount the route**

In `server/index.js`, immediately after the `env-checks` mount (line 47), add:

```js
mountApi('/env-room-config', require('./routes/envRoomConfig'));
```

- [ ] **Step 3: Verify GET returns 3 rooms from an empty collection**

Start the server (`cd server && npm run dev`), then in another shell:

Run: `curl -s http://localhost:3001/api/env-room-config`
Expected: JSON `{ "data": [ {slug:"balance",boardId:"balance",tempMin:15,...}, {sample-prep...}, {analysis...} ] }` — exactly 3 entries.

- [ ] **Step 4: Verify PUT upserts and validates**

Run: `curl -s -X PUT http://localhost:3001/api/env-room-config/balance -H "Content-Type: application/json" -d '{"boardId":"BALANCE-01","tempMin":15,"tempMax":25,"humidityMax":65}'`
Expected: `{ "data": { "slug":"balance","boardId":"BALANCE-01","tempMin":15,"tempMax":25,"humidityMax":65 } }`

Run (invalid): `curl -s -X PUT http://localhost:3001/api/env-room-config/balance -H "Content-Type: application/json" -d '{"boardId":"x","tempMin":30,"tempMax":25,"humidityMax":65}'`
Expected: HTTP body `{ "error": "อุณหภูมิต่ำสุดต้องไม่เกินสูงสุด" }`

Run (bad slug): `curl -s -X PUT http://localhost:3001/api/env-room-config/nope -H "Content-Type: application/json" -d '{"boardId":"x","tempMin":15,"tempMax":25,"humidityMax":65}'`
Expected: `{ "error": "slug ไม่ถูกต้อง" }`

- [ ] **Step 5: Commit**

```bash
git add server/routes/envRoomConfig.js server/index.js
git commit -m "feat(env-config): GET/PUT /env-room-config route (defaults + upsert + validation)"
```

---

## Task 3: Client lib — validation + merge (TDD)

**Files:**
- Modify: `src/lib/dailyCheckEnv.ts`
- Test: `src/lib/dailyCheckEnv.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/dailyCheckEnv.test.ts` (and add the two new names to the existing import on line 2):

```ts
import {
  ENV_ROOMS, evaluateEnv, getEnvRoom, isReadingStale, STALE_AFTER_MS,
  validateEnvRoomConfig, mergeEnvRooms, type EnvRoomConfig,
} from "./dailyCheckEnv";

describe("validateEnvRoomConfig", () => {
  const good = { boardId: "b", tempMin: 15, tempMax: 25, humidityMax: 70 };

  it("returns null for a valid config", () => {
    expect(validateEnvRoomConfig(good)).toBeNull();
  });

  it("rejects non-numeric thresholds", () => {
    expect(validateEnvRoomConfig({ ...good, tempMin: NaN })?.field).toBe("tempMin");
    expect(validateEnvRoomConfig({ ...good, humidityMax: undefined as unknown as number })?.field).toBe("humidityMax");
  });

  it("rejects tempMin greater than tempMax", () => {
    expect(validateEnvRoomConfig({ ...good, tempMin: 30, tempMax: 25 })?.field).toBe("tempMin");
  });

  it("rejects humidityMax of zero or less", () => {
    expect(validateEnvRoomConfig({ ...good, humidityMax: 0 })?.field).toBe("humidityMax");
  });

  it("allows an empty boardId (manual entry)", () => {
    expect(validateEnvRoomConfig({ ...good, boardId: "" })).toBeNull();
  });
});

describe("mergeEnvRooms", () => {
  const configs: EnvRoomConfig[] = [
    { slug: "balance", boardId: "BAL-1", tempMin: 18, tempMax: 24, humidityMax: 60 },
  ];

  it("overlays DB values onto defaults, preserving label", () => {
    const merged = mergeEnvRooms(ENV_ROOMS, configs);
    const bal = merged.find((r) => r.slug === "balance")!;
    expect(bal.boardId).toBe("BAL-1");
    expect(bal.tempMin).toBe(18);
    expect(bal.humidityMax).toBe(60);
    expect(bal.label).toBe("ห้องชั่งสาร"); // label still from code default
  });

  it("falls back to the code default for rooms with no DB doc", () => {
    const merged = mergeEnvRooms(ENV_ROOMS, configs);
    const ana = merged.find((r) => r.slug === "analysis")!;
    expect(ana).toEqual(ENV_ROOMS.find((r) => r.slug === "analysis"));
  });

  it("returns one entry per default room in default order", () => {
    expect(mergeEnvRooms(ENV_ROOMS, []).map((r) => r.slug)).toEqual(
      ENV_ROOMS.map((r) => r.slug),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/dailyCheckEnv.test.ts`
Expected: FAIL — `validateEnvRoomConfig`/`mergeEnvRooms` are not exported.

- [ ] **Step 3: Implement the new exports**

Append to `src/lib/dailyCheckEnv.ts` (after `evaluateEnv`):

```ts
/** DB-stored per-room override. `label` is not stored — it comes from ENV_ROOMS. */
export type EnvRoomConfig = {
  slug: EnvRoom["slug"];
  boardId: string;
  tempMin: number;
  tempMax: number;
  humidityMax: number;
};

/** Editable subset used by the Settings form / PUT body. */
export type EnvRoomConfigInput = {
  boardId: string;
  tempMin: number;
  tempMax: number;
  humidityMax: number;
};

export type EnvRoomConfigErrorField = "boardId" | "tempMin" | "tempMax" | "humidityMax";
export type EnvRoomConfigError = { field: EnvRoomConfigErrorField; message: string } | null;

/** Validate a config draft. Mirrors the server-side checks in routes/envRoomConfig.js. */
export const validateEnvRoomConfig = (input: {
  boardId?: unknown;
  tempMin?: unknown;
  tempMax?: unknown;
  humidityMax?: unknown;
}): EnvRoomConfigError => {
  const fields: [EnvRoomConfigErrorField, unknown][] = [
    ["tempMin", input.tempMin],
    ["tempMax", input.tempMax],
    ["humidityMax", input.humidityMax],
  ];
  for (const [field, v] of fields) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return { field, message: "ต้องเป็นตัวเลข" };
    }
  }
  if ((input.tempMin as number) > (input.tempMax as number)) {
    return { field: "tempMin", message: "อุณหภูมิต่ำสุดต้องไม่เกินสูงสุด" };
  }
  if ((input.humidityMax as number) <= 0) {
    return { field: "humidityMax", message: "ความชื้นสูงสุดต้องมากกว่า 0" };
  }
  return null;
};

/** Overlay DB configs onto code defaults by slug, preserving label + any other default fields. */
export const mergeEnvRooms = (defaults: EnvRoom[], configs: EnvRoomConfig[]): EnvRoom[] => {
  const bySlug = new Map(configs.map((c) => [c.slug, c]));
  return defaults.map((d) => {
    const c = bySlug.get(d.slug);
    return c
      ? { ...d, boardId: c.boardId, tempMin: c.tempMin, tempMax: c.tempMax, humidityMax: c.humidityMax }
      : d;
  });
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/dailyCheckEnv.test.ts`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dailyCheckEnv.ts src/lib/dailyCheckEnv.test.ts
git commit -m "feat(env-config): add validateEnvRoomConfig + mergeEnvRooms helpers (TDD)"
```

---

## Task 4: Client API layer

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Import the shared type**

Add to the type-imports block near the top of `src/lib/api.ts` (after the `standardConfig` import on line 10):

```ts
import type { EnvRoomConfig, EnvRoomConfigInput } from "@/lib/dailyCheckEnv";
```

- [ ] **Step 2: Add the two endpoints**

Insert into the `api` object right after `getLiveTempHum` (line 236):

```ts
  // ── Env room config (board ↔ room mapping + thresholds) ──
  getEnvRoomConfigs: () =>
    request<{ data: EnvRoomConfig[] }>("/env-room-config").then((r) => r.data),
  updateEnvRoomConfig: (slug: EnvRoomConfig["slug"], input: EnvRoomConfigInput) =>
    request<{ data: EnvRoomConfig }>(`/env-room-config/${slug}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(env-config): add getEnvRoomConfigs + updateEnvRoomConfig API"
```

---

## Task 5: `useEnvRooms()` hook + wire Environment page

**Files:**
- Create: `src/hooks/useEnvRooms.ts`
- Modify: `src/pages/daily-check/EnvironmentCheckPage.tsx`
- Modify: `src/pages/daily-check/__tests__/EnvironmentCheckPage.test.tsx`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useEnvRooms.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ENV_ROOMS, mergeEnvRooms, type EnvRoom } from "@/lib/dailyCheckEnv";

/**
 * Environment rooms with DB config (board + thresholds) overlaid on the code
 * defaults. Falls back to pure defaults while loading or on error so the env
 * page always renders all 3 rooms.
 */
export function useEnvRooms(): { rooms: EnvRoom[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["env-room-config"],
    queryFn: api.getEnvRoomConfigs,
  });
  const rooms = useMemo(() => mergeEnvRooms(ENV_ROOMS, data ?? []), [data]);
  return { rooms, isLoading };
}
```

- [ ] **Step 2: Update the EnvironmentCheckPage test mock first (so it keeps passing)**

In `src/pages/daily-check/__tests__/EnvironmentCheckPage.test.tsx`, add `getEnvRoomConfigs` to the api mock object (line 9-13):

```ts
vi.mock("@/lib/api", () => ({
  api: {
    getEnvChecks: vi.fn().mockResolvedValue([]),
    getLiveTempHum: vi.fn().mockResolvedValue([]),
    getEnvRoomConfigs: vi.fn().mockResolvedValue([]),
    createEnvCheck: vi.fn(),
  },
}));
```

- [ ] **Step 3: Wire the page to use the hook**

In `src/pages/daily-check/EnvironmentCheckPage.tsx`:

a) The import on line 17 keeps `evaluateEnv`, `isReadingStale`, `type EnvRoom` but no longer needs `ENV_ROOMS`:
```ts
import { evaluateEnv, isReadingStale, type EnvRoom } from "@/lib/dailyCheckEnv";
```

b) Add the hook import near the other hook imports (top of file):
```ts
import { useEnvRooms } from "@/hooks/useEnvRooms";
```

c) Inside the component, near the other hooks (e.g. right after `const { user } = useAuth();`), add:
```ts
  const { rooms } = useEnvRooms();
```

d) Replace every `ENV_ROOMS` reference with `rooms`:
- line 126: `const room = ENV_ROOMS.find((r) => r.slug === vars.room)!;` → `const room = rooms.find((r) => r.slug === vars.room)!;`
- line 188: `{checkedCount}/{ENV_ROOMS.length}` → `{checkedCount}/{rooms.length}`
- line 191: `ผ่าน {passCount}/{ENV_ROOMS.length}` → `ผ่าน {passCount}/{rooms.length}`
- line 208: `{ENV_ROOMS.map((room) => {` → `{rooms.map((room) => {`
- line 382: `{ENV_ROOMS.map((r) => (` → `{rooms.map((r) => (`

Note: `rooms` is a stable memoized array from the hook. The `onSuccess` callback at line 126 closes over it — that is fine because the mutation is defined inside the component render and re-created each render with the current `rooms`.

- [ ] **Step 4: Run the env page test + type-check**

Run: `npm run test -- src/pages/daily-check/__tests__/EnvironmentCheckPage.test.tsx`
Expected: PASS (3 rooms still render — hook falls back to defaults on empty data).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEnvRooms.ts src/pages/daily-check/EnvironmentCheckPage.tsx src/pages/daily-check/__tests__/EnvironmentCheckPage.test.tsx
git commit -m "feat(env-config): read rooms via useEnvRooms (DB config over defaults)"
```

---

## Task 6: Settings UI — per-room editor card + page section

**Files:**
- Create: `src/components/lis/EnvRoomConfigCard.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Test: `src/pages/__tests__/SettingsPage.test.tsx`

- [ ] **Step 1: Write the per-room card component**

```tsx
// src/components/lis/EnvRoomConfigCard.tsx
import { useState } from "react";
import { Thermometer, Droplets, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { validateEnvRoomConfig, type EnvRoom, type EnvRoomConfigInput } from "@/lib/dailyCheckEnv";

const MANUAL = "__manual__"; // boardId = "" (no sensor)
const CUSTOM = "__custom__"; // reveal free-text board id input

interface Props {
  room: EnvRoom;                 // merged current values (label + current boardId/thresholds)
  detectedBoards: string[];      // board ids seen live from getLiveTempHum
  saving: boolean;
  onSave: (slug: EnvRoom["slug"], input: EnvRoomConfigInput) => void;
}

const EnvRoomConfigCard = ({ room, detectedBoards, saving, onSave }: Props) => {
  // Board options = detected boards ∪ the room's current saved board.
  const options = Array.from(
    new Set([...detectedBoards, ...(room.boardId ? [room.boardId] : [])]),
  );

  // Initial select value: MANUAL when no board; otherwise the board id itself.
  const [boardSel, setBoardSel] = useState<string>(room.boardId ? room.boardId : MANUAL);
  const [customBoard, setCustomBoard] = useState<string>("");
  const [tempMin, setTempMin] = useState<string>(String(room.tempMin));
  const [tempMax, setTempMax] = useState<string>(String(room.tempMax));
  const [humidityMax, setHumidityMax] = useState<string>(String(room.humidityMax));

  const effectiveBoardId =
    boardSel === MANUAL ? "" : boardSel === CUSTOM ? customBoard.trim() : boardSel;

  const draft: EnvRoomConfigInput = {
    boardId: effectiveBoardId,
    tempMin: Number(tempMin),
    tempMax: Number(tempMax),
    humidityMax: Number(humidityMax),
  };
  const error = validateEnvRoomConfig(draft);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-primary" />
          {room.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Board selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" /> เซนเซอร์ (board)
          </label>
          <Select value={boardSel} onValueChange={setBoardSel}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="เลือก board" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MANUAL}>— ไม่มี (กรอกมือ)</SelectItem>
              {options.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
              <SelectItem value={CUSTOM}>พิมพ์เอง…</SelectItem>
            </SelectContent>
          </Select>
          {boardSel === CUSTOM && (
            <Input
              className="mt-2 h-9 text-sm"
              placeholder="board id (เช่น BALANCE-01)"
              value={customBoard}
              onChange={(e) => setCustomBoard(e.target.value)}
            />
          )}
        </div>

        {/* Thresholds */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">อุณหภูมิต่ำสุด (°C)</label>
            <Input type="number" step="0.1" value={tempMin} onChange={(e) => setTempMin(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">อุณหภูมิสูงสุด (°C)</label>
            <Input type="number" step="0.1" value={tempMax} onChange={(e) => setTempMax(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5" /> ความชื้นสูงสุด (%RH)
            </label>
            <Input type="number" step="0.1" value={humidityMax} onChange={(e) => setHumidityMax(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error.message}</p>}

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving || !!error}
            onClick={() => onSave(room.slug, draft)}
          >
            บันทึก
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnvRoomConfigCard;
```

- [ ] **Step 2: Rewrite SettingsPage to render the section**

```tsx
// src/pages/SettingsPage.tsx
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import EnvRoomConfigCard from "@/components/lis/EnvRoomConfigCard";
import { api } from "@/lib/api";
import { useEnvRooms } from "@/hooks/useEnvRooms";
import type { EnvRoom, EnvRoomConfigInput } from "@/lib/dailyCheckEnv";

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { rooms } = useEnvRooms();

  const { data: liveReadings = [] } = useQuery({
    queryKey: ["temphum", "live"],
    queryFn: api.getLiveTempHum,
  });
  const detectedBoards = useMemo(
    () => Array.from(new Set(liveReadings.map((r) => r.board))).filter(Boolean),
    [liveReadings],
  );

  const saveMutation = useMutation({
    mutationFn: ({ slug, input }: { slug: EnvRoom["slug"]; input: EnvRoomConfigInput }) =>
      api.updateEnvRoomConfig(slug, input),
    onSuccess: (_data, vars) => {
      const label = rooms.find((r) => r.slug === vars.slug)?.label ?? vars.slug;
      toast.success(`บันทึกการตั้งค่า ${label} แล้ว`);
      queryClient.invalidateQueries({ queryKey: ["env-room-config"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    },
  });

  return (
    <AppLayout title="ตั้งค่าระบบ">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Settings className="w-6 h-6" />
            ตั้งค่าระบบ
          </span>
        }
        description="ตั้งค่าห้องตรวจสภาพแวดล้อม (Environment) — เลือก board และเกณฑ์ temp/humidity ของแต่ละห้อง"
      />
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">ตั้งค่าห้องตรวจสภาพแวดล้อม</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <EnvRoomConfigCard
              key={room.slug}
              room={room}
              detectedBoards={detectedBoards}
              saving={saveMutation.isPending}
              onSave={(slug, input) => saveMutation.mutate({ slug, input })}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
```

- [ ] **Step 3: Write the smoke test**

```tsx
// src/pages/__tests__/SettingsPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SettingsPage from "../SettingsPage";

vi.mock("@/lib/api", () => ({
  api: {
    getEnvRoomConfigs: vi.fn().mockResolvedValue([]),
    getLiveTempHum: vi.fn().mockResolvedValue([]),
    updateEnvRoomConfig: vi.fn(),
  },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a config card for each of the 3 env rooms", () => {
    renderPage();
    expect(screen.getByText("ห้องชั่งสาร")).toBeInTheDocument();
    expect(screen.getByText("ห้องเตรียมตัวอย่าง")).toBeInTheDocument();
    expect(screen.getByText("ห้องวิเคราะห์")).toBeInTheDocument();
  });

  it("shows a board selector and threshold inputs per room", () => {
    renderPage();
    expect(screen.getAllByText("เซนเซอร์ (board)")).toHaveLength(3);
    expect(screen.getAllByText("อุณหภูมิต่ำสุด (°C)")).toHaveLength(3);
    expect(screen.getAllByText("ความชื้นสูงสุด (%RH)")).toHaveLength(3);
  });
});
```

- [ ] **Step 4: Run the smoke test + type-check**

Run: `npm run test -- src/pages/__tests__/SettingsPage.test.tsx`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/EnvRoomConfigCard.tsx src/pages/SettingsPage.tsx src/pages/__tests__/SettingsPage.test.tsx
git commit -m "feat(env-config): system-settings UI to map board + thresholds per room"
```

---

## Task 7: Full verification + seed-data backup

**Files:**
- Modify: `server/seed-data/envroomconfigs.json` (generated)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all suites PASS (existing + new dailyCheckEnv, SettingsPage, EnvironmentCheckPage).

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors in the files we touched.

- [ ] **Step 3: Export seed data for the new collection**

Per CLAUDE.md, a new model/off-cycle data change must be captured in `seed-data/`. With the backend running and at least one `PUT` saved (Task 2 Step 4), run:

Run: `cd server && npm run seed:export`
Expected: writes/refreshes `server/seed-data/*.json`, including a new `envroomconfigs.json`.

- [ ] **Step 4: Commit the seed-data backup**

```bash
git add server/seed-data/envroomconfigs.json
git commit -m "chore(seed): track envroomconfigs collection in seed-data backup"
```

- [ ] **Step 5: Manual smoke (optional but recommended)**

With both processes running, open `http://localhost:8000/LIS/settings`:
- 3 room cards show, each with a board dropdown + 3 threshold inputs.
- Pick "พิมพ์เอง…" → text input appears; type a board id; บันทึก → success toast.
- Open `http://localhost:8000/LIS/daily-check/environment`: the room whose board you set now shows "เซนเซอร์ • อัปเดต …" once Node-RED posts for that board id (or stays "กรอกมือ" if it hasn't yet — expected).

---

## Self-Review notes

- **Spec coverage:** model (Task 1), GET/PUT route + validation (Task 2), shared validate+merge (Task 3), API layer (Task 4), useEnvRooms + env-page wiring incl. the `onSuccess` merged-room fix (Task 5), settings UI with detected-boards dropdown + manual/custom + thresholds (Task 6), seed-export (Task 7). All spec sections mapped.
- **Server/client validation parity:** both reject non-numeric, `tempMin > tempMax`, `humidityMax <= 0`; both allow empty `boardId`.
- **Naming consistency:** `getEnvRoomConfigs`, `updateEnvRoomConfig`, `EnvRoomConfig`, `EnvRoomConfigInput`, `mergeEnvRooms`, `validateEnvRoomConfig`, `useEnvRooms`, query key `["env-room-config"]` used identically across tasks.
