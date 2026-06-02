# Common Name Override Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มชั้น normalize `common_name` ฝั่ง LIS (map `raw → canonical`) เพื่อแก้ string สาร+% ที่ผิดรูปแบบ และยุบ duplicate variant ใน Simple Method โดยไม่แตะ production ERP

**Architecture:** Mongo collection ใหม่ `CommonNameOverride` (CRUD route ตาม pattern `simpleMethodExclusions`) + helper บริสุทธิ์ฝั่ง client (`src/lib/commonNameOverride.ts`) ที่ map ค่าก่อน `parseSubstances`/grouping ใน Simple Method และก่อน snapshot ใน petition lot options. Admin จัดการผ่าน inline dialog ใน Simple Method tab + panel รวม.

**Tech Stack:** Express 4 + Mongoose 8 (backend), React 18 + TS + TanStack Query + shadcn/ui (frontend), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-06-02-common-name-override-design.md`

---

## File Structure

- Create `server/models/CommonNameOverride.js` — schema (`raw`, `rawKey` unique, `canonical`, `note`)
- Create `server/routes/commonNameOverrides.js` — GET/POST(upsert)/DELETE
- Modify `server/index.js` — mount route (1 line)
- Create `src/lib/commonNameOverride.ts` — `normalizeKey`, `buildOverrideMap`, `normalizeCommonName`, type
- Create `src/lib/commonNameOverride.test.ts` — unit tests
- Modify `src/pages/MasterItems.tsx` — export + extend `buildSimpleMethodRows`, add `rawCommonNames` to `SimpleMethodRow`, add overrides query, edit dialog + manager panel
- Create `src/pages/__tests__/buildSimpleMethodRows.test.ts` — integration test for dedup/canonical
- Modify `src/hooks/useExternalLookups.ts` — apply overrides to lot options

---

## Task 1: Backend model + route + mount

**Files:**
- Create: `server/models/CommonNameOverride.js`
- Create: `server/routes/commonNameOverrides.js`
- Modify: `server/index.js:39` (after the `simple-method-exclusions` mount line)

- [ ] **Step 1: Create the model**

`server/models/CommonNameOverride.js`:
```js
const mongoose = require('mongoose');

const CommonNameOverrideSchema = new mongoose.Schema({
  raw: { type: String, required: true, trim: true },
  rawKey: { type: String, required: true, unique: true, index: true },
  canonical: { type: String, required: true, trim: true },
  note: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('CommonNameOverride', CommonNameOverrideSchema);
```

- [ ] **Step 2: Create the route**

`server/routes/commonNameOverrides.js`:
```js
const express = require('express');
const CommonNameOverride = require('../models/CommonNameOverride');

const router = express.Router();

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

router.get('/', async (_req, res) => {
  try {
    const docs = await CommonNameOverride.find().sort({ raw: 1 }).lean();
    res.json(docs.map((doc) => ({
      _id: String(doc._id),
      raw: doc.raw,
      canonical: doc.canonical,
      note: doc.note || '',
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const raw = String(req.body && req.body.raw || '').trim();
    const canonical = String(req.body && req.body.canonical || '').trim();
    const note = String(req.body && req.body.note || '').trim();
    if (!raw) return res.status(400).json({ message: 'raw required' });
    if (!canonical) return res.status(400).json({ message: 'canonical required' });
    const rawKey = normalizeKey(raw);
    const doc = await CommonNameOverride.findOneAndUpdate(
      { rawKey },
      { $set: { raw, canonical, note }, $setOnInsert: { rawKey } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ _id: String(doc._id), raw: doc.raw, canonical: doc.canonical, note: doc.note || '' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await CommonNameOverride.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Mount the route**

In `server/index.js`, directly after the line:
```js
mountApi('/simple-method-exclusions', require('./routes/simpleMethodExclusions'));
```
add:
```js
mountApi('/common-name-overrides', require('./routes/commonNameOverrides'));
```

- [ ] **Step 4: Verify the endpoint (manual)**

Start backend: `cd server && npm run dev` (background). Then:
```bash
curl -s -X POST http://localhost:3001/api/common-name-overrides \
  -H "Content-Type: application/json" \
  -d '{"raw":"DIURON + HEXAZINONE 46.8% + 13.2% WG","canonical":"DIURON 13.2% + HEXAZINONE 46.8% WG","note":"test"}'
curl -s http://localhost:3001/api/common-name-overrides
```
Expected: POST returns the doc with `_id`; GET returns an array containing it. Then delete it:
```bash
curl -s -X DELETE http://localhost:3001/api/common-name-overrides/<_id>
```
Expected: `{"ok":true}`. (This row is throwaway — leave DB clean.)

- [ ] **Step 5: Commit**

```bash
git add server/models/CommonNameOverride.js server/routes/commonNameOverrides.js server/index.js
git commit -m "feat(server): common_name override collection + CRUD route"
```

---

## Task 2: Client helper + unit tests (TDD)

**Files:**
- Create: `src/lib/commonNameOverride.ts`
- Test: `src/lib/commonNameOverride.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/commonNameOverride.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  normalizeKey,
  buildOverrideMap,
  normalizeCommonName,
} from "@/lib/commonNameOverride";

describe("normalizeKey", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeKey("  DIURON   +  HEXAZINONE  ")).toBe("diuron + hexazinone");
  });
});

describe("buildOverrideMap", () => {
  it("maps rawKey → canonical and skips incomplete rows", () => {
    const map = buildOverrideMap([
      { raw: "A 1% + B 2%", canonical: "B 2% + A 1%" },
      { raw: "", canonical: "x" },
      { raw: "y", canonical: "" },
    ]);
    expect(map.size).toBe(1);
    expect(map.get("a 1% + b 2%")).toBe("B 2% + A 1%");
  });
});

describe("normalizeCommonName", () => {
  const map = buildOverrideMap([
    { raw: "DIURON + HEXAZINONE 46.8% + 13.2% WG", canonical: "DIURON 13.2% + HEXAZINONE 46.8% WG" },
  ]);
  it("returns canonical on hit (case/space-insensitive)", () => {
    expect(normalizeCommonName("diuron  +  hexazinone 46.8% + 13.2% wg", map))
      .toBe("DIURON 13.2% + HEXAZINONE 46.8% WG");
  });
  it("returns trimmed raw on miss", () => {
    expect(normalizeCommonName("  GLYPHOSATE 48% SL  ", map)).toBe("GLYPHOSATE 48% SL");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/commonNameOverride.test.ts`
Expected: FAIL — cannot resolve `@/lib/commonNameOverride`

- [ ] **Step 3: Write the implementation**

`src/lib/commonNameOverride.ts`:
```ts
export interface CommonNameOverrideRow {
  _id?: string;
  raw: string;
  canonical: string;
  note?: string;
}

// Match key for comparing against ERP common_name values — guards against
// whitespace and case noise so "DIURON  +  HEXAZINONE" === "diuron + hexazinone".
export function normalizeKey(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildOverrideMap(
  rows: CommonNameOverrideRow[] | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows || []) {
    if (!row || !row.raw || !row.canonical) continue;
    map.set(normalizeKey(row.raw), String(row.canonical).trim());
  }
  return map;
}

// Returns the canonical common_name if an override exists, else the trimmed raw.
export function normalizeCommonName(raw: string, map: Map<string, string>): string {
  const canonical = map.get(normalizeKey(raw));
  return canonical || String(raw || "").trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/commonNameOverride.test.ts`
Expected: PASS (3 files? no — 4 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/lib/commonNameOverride.ts src/lib/commonNameOverride.test.ts
git commit -m "feat(lib): common_name override map helper + tests"
```

---

## Task 3: Apply overrides in buildSimpleMethodRows (TDD)

**Files:**
- Modify: `src/pages/MasterItems.tsx` (type `SimpleMethodRow` ~93; `buildSimpleMethodRows` 347-400; `SimpleMethodPage` queries ~840-861)
- Test: `src/pages/__tests__/buildSimpleMethodRows.test.ts`

- [ ] **Step 1: Write the failing test**

`src/pages/__tests__/buildSimpleMethodRows.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSimpleMethodRows } from "@/pages/MasterItems";
import { buildOverrideMap } from "@/lib/commonNameOverride";

describe("buildSimpleMethodRows with common-name overrides", () => {
  it("merges malformed + well-formed variants into one canonical row", () => {
    const items = [
      { item_no: "A1", common_name: "DIURON + HEXAZINONE 46.8% + 13.2% WG" },
      { item_no: "A2", common_name: "DIURON 46.8%+HEXAZINONE 13.2% WG" },
    ];
    const cnMap = buildOverrideMap([
      { raw: "DIURON + HEXAZINONE 46.8% + 13.2% WG", canonical: "DIURON 13.2% + HEXAZINONE 46.8% WG" },
      { raw: "DIURON 46.8%+HEXAZINONE 13.2% WG", canonical: "DIURON 13.2% + HEXAZINONE 46.8% WG" },
    ]);
    const rows = buildSimpleMethodRows(items, {}, cnMap);
    expect(rows).toHaveLength(1);
    expect(rows[0].commonName).toBe("DIURON 13.2% + HEXAZINONE 46.8% WG");
    expect(rows[0].substances).toEqual(["DIURON 13.2%", "HEXAZINONE 46.8% WG"]);
    expect([...rows[0].itemNos].sort()).toEqual(["A1", "A2"]);
    expect([...rows[0].rawCommonNames].sort()).toEqual([
      "DIURON + HEXAZINONE 46.8% + 13.2% WG",
      "DIURON 46.8%+HEXAZINONE 13.2% WG",
    ]);
  });

  it("leaves unmapped names unchanged", () => {
    const items = [{ item_no: "B1", common_name: "GLYPHOSATE 48% SL" }];
    const rows = buildSimpleMethodRows(items, {}, new Map());
    expect(rows[0].commonName).toBe("GLYPHOSATE 48% SL");
    expect(rows[0].rawCommonNames).toEqual(["GLYPHOSATE 48% SL"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/__tests__/buildSimpleMethodRows.test.ts`
Expected: FAIL — `buildSimpleMethodRows` is not exported / 3rd arg ignored / `rawCommonNames` undefined

- [ ] **Step 3: Add import + extend the type**

At the top of `src/pages/MasterItems.tsx`, near the existing `import { parseSubstances } from "@/lib/substances";` (line 52), add:
```ts
import { buildOverrideMap, normalizeCommonName, normalizeKey } from "@/lib/commonNameOverride";
import type { CommonNameOverrideRow } from "@/lib/commonNameOverride";
```

Extend the `SimpleMethodRow` type (currently ~line 93) to add `rawCommonNames`:
```ts
type SimpleMethodRow = {
  key: string;
  commonName: string;
  substances: string[];
  assignments: AssignmentSlot[];
  itemNos: string[];
  rawCommonNames: string[];
  items: MasterItem[];
};
```
(Keep every existing field that is already there; only ADD `rawCommonNames`.)

- [ ] **Step 4: Rewrite buildSimpleMethodRows**

Replace the whole function (347-400) with:
```ts
export function buildSimpleMethodRows(
  items: MasterItem[],
  overrides: Record<string, AssignmentSlot[]> = {},
  cnMap: Map<string, string> = new Map(),
): SimpleMethodRow[] {
  const groups = new Map<string, SimpleMethodRow>();
  const collected = new Map<string, AssignmentSlot[]>();

  items.forEach((item) => {
    const rawCommonName = String(firstValue(item, commonNameKeys)).trim();
    if (!rawCommonName) return;
    const commonName = normalizeCommonName(rawCommonName, cnMap);

    const key = normalizeKey(commonName);
    const itemNo = String(firstValue(item, codeKeys)).trim();
    const substances = parseSubstances(commonName);
    const count = substances.length;

    let candidate: AssignmentSlot[] = emptyAssignments(count);
    const override = itemNo ? overrides[itemNo] : undefined;
    if (override && override.length > 0) {
      candidate = alignAssignments(override, count);
    } else {
      const detected = getDetectedAssignment(item);
      if (detected && count === 1) candidate = [detected];
    }

    const existing = groups.get(key);
    const current = collected.get(key) ?? emptyAssignments(count);
    const merged = current.map((slot, idx) => slot || candidate[idx] || "") as AssignmentSlot[];
    collected.set(key, merged);

    if (existing) {
      existing.items.push(item);
      if (itemNo && !existing.itemNos.includes(itemNo)) existing.itemNos.push(itemNo);
      if (!existing.rawCommonNames.includes(rawCommonName)) existing.rawCommonNames.push(rawCommonName);
      return;
    }

    groups.set(key, {
      key,
      commonName,
      substances,
      assignments: emptyAssignments(count),
      itemNos: itemNo ? [itemNo] : [],
      rawCommonNames: [rawCommonName],
      items: [item],
    });
  });

  groups.forEach((row, key) => {
    row.assignments = collected.get(key) ?? emptyAssignments(row.substances.length);
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.commonName.localeCompare(b.commonName, ["th", "en"]),
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/pages/__tests__/buildSimpleMethodRows.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Wire the overrides query into SimpleMethodPage**

In `SimpleMethodPage` (after the `exclusions` query, ~line 859), add:
```ts
  const { data: cnOverrides = [] } = useQuery({
    queryKey: ["common-name-overrides"],
    queryFn: async () => {
      const res = await api.get<CommonNameOverrideRow[]>("/common-name-overrides");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  const cnMap = useMemo(() => buildOverrideMap(cnOverrides), [cnOverrides]);
```
Then change the `rows` memo (line 861) from:
```ts
  const rows = useMemo(() => buildSimpleMethodRows(items, overrides), [items, overrides]);
```
to:
```ts
  const rows = useMemo(() => buildSimpleMethodRows(items, overrides, cnMap), [items, overrides, cnMap]);
```

- [ ] **Step 7: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: no errors
```bash
git add src/pages/MasterItems.tsx src/pages/__tests__/buildSimpleMethodRows.test.ts
git commit -m "feat(simple-method): normalize common_name via override map + dedup variants"
```

---

## Task 4: Admin UI — per-row edit dialog + overrides manager

**Files:**
- Modify: `src/pages/MasterItems.tsx` (row cell ~1208; `SimpleMethodTab` props; new `CommonNameOverrideDialog` + `CommonNameOverrideManager` components; wire callbacks in `SimpleMethodPage`)

- [ ] **Step 1: Add the edit dialog component**

Add near `ExclusionManager` (after line 1265) in `src/pages/MasterItems.tsx`:
```tsx
function CommonNameOverrideDialog({
  row,
  onClose,
  onSaved,
}: {
  row: SimpleMethodRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [canonical, setCanonical] = useState(row.commonName);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = canonical.trim();
    if (!value) {
      toast.error("กรุณาระบุชื่อมาตรฐาน");
      return;
    }
    setBusy(true);
    try {
      // apply the same canonical to every raw common_name that fell into this row
      for (const raw of row.rawCommonNames) {
        await api.post("/common-name-overrides", { raw, canonical: value, note: note.trim() });
      }
      toast.success("ตั้งชื่อมาตรฐานสำเร็จ");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ตั้งชื่อมาตรฐาน (common name)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-muted-foreground">ชื่อจากระบบ (raw)</span>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {row.rawCommonNames.map((raw) => <li key={raw}>{raw}</li>)}
            </ul>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">ชื่อมาตรฐาน</span>
            <Input value={canonical} onChange={(e) => setCanonical(e.target.value)} />
          </div>
          <div>
            <span className="text-sm text-muted-foreground">หมายเหตุ (ไม่บังคับ)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button onClick={save} disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommonNameOverrideManager({
  overrides,
  onChanged,
}: {
  overrides: CommonNameOverrideRow[];
  onChanged: () => void;
}) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const remove = async (id: string) => {
    setRemovingId(id);
    try {
      await api.delete(`/common-name-overrides/${id}`);
      onChanged();
      toast.success("ลบ override แล้ว");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRemovingId(null);
    }
  };

  if (overrides.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardContent className="p-4">
        <div className="mb-2 text-sm font-medium">ชื่อมาตรฐานที่ตั้งไว้ ({overrides.length})</div>
        <ul className="space-y-1 text-sm">
          {overrides.map((o) => (
            <li key={o._id} className="flex items-center gap-2">
              <span className="flex-1 truncate">
                <span className="text-muted-foreground">{o.raw}</span>
                {" → "}
                <span className="font-medium">{o.canonical}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={removingId === o._id}
                onClick={() => o._id && remove(o._id)}
              >
                ลบ
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```
Note: `Input`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `Card`, `CardContent`, `Button` are already imported in this file (used by the existing item-edit dialog and ExclusionManager). If `DialogFooter` is not yet imported, add it to the existing `@/components/ui/dialog` import.

- [ ] **Step 2: Add the per-row edit button**

In `SimpleMethodTab`, add an `onEditCommonName` prop to its props type (alongside `onToggleRow`, `onDraftChange`):
```ts
  onEditCommonName: (row: SimpleMethodRow) => void;
```
Then change the commonName cell (line 1208) from:
```tsx
                        <TableCell className="min-w-72 font-medium">{displayValue(row.commonName)}</TableCell>
```
to:
```tsx
                        <TableCell className="min-w-72 font-medium" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <span className="min-w-0 flex-1 truncate">{displayValue(row.commonName)}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-muted-foreground"
                              title="ตั้งชื่อมาตรฐาน"
                              onClick={() => onEditCommonName(row)}
                            >
                              ✎
                            </Button>
                          </div>
                        </TableCell>
```

- [ ] **Step 3: Wire state + callbacks in SimpleMethodPage**

In `SimpleMethodPage`, add state near the other `useState`s (~line 821):
```ts
  const [editingRow, setEditingRow] = useState<SimpleMethodRow | null>(null);
```
Pass the new prop to `<SimpleMethodTab .../>` (near line 972):
```tsx
          onEditCommonName={setEditingRow}
```
After the `<SimpleMethodTab .../>` block (and any existing `ExclusionManager`), render the manager + dialog. Add:
```tsx
        <CommonNameOverrideManager
          overrides={cnOverrides}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ["common-name-overrides"] });
          }}
        />
        {editingRow && (
          <CommonNameOverrideDialog
            row={editingRow}
            onClose={() => setEditingRow(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["common-name-overrides"] });
            }}
          />
        )}
```
(Place these inside the page's returned JSX, before `</AppLayout>`.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If `SimpleMethodTab` is called anywhere else, ensure the new required prop is supplied; it is only used in `SimpleMethodPage`.)

- [ ] **Step 5: Manual verify**

With `npm run dev` + backend up: open Master Items → Simple Method tab. Click ✎ on a malformed row (e.g. `DIURON + HEXAZINONE 46.8% + 13.2% WG`), set canonical `DIURON 13.2% + HEXAZINONE 46.8% WG`, save. Expected: row re-groups under the canonical name; the well-formed twin merges into the same row (itemNos combined); the manager panel lists the override; deleting it reverts.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MasterItems.tsx
git commit -m "feat(simple-method): admin UI to set/clear common_name overrides"
```

---

## Task 5: Apply overrides to petition lot options

**Files:**
- Modify: `src/hooks/useExternalLookups.ts` (`normalizeLotOptions` 62-104; `useLotOptions` 123-165)

- [ ] **Step 1: Add imports**

At the top of `src/hooks/useExternalLookups.ts` add:
```ts
import { api } from "@/lib/api";
import { buildOverrideMap, normalizeCommonName } from "@/lib/commonNameOverride";
import type { CommonNameOverrideRow } from "@/lib/commonNameOverride";
```

- [ ] **Step 2: Make normalizeLotOptions accept the override map**

Change the signature (line 62) from:
```ts
function normalizeLotOptions(payload: unknown, source: string): MfLotOption[] {
```
to:
```ts
function normalizeLotOptions(payload: unknown, source: string, cnMap: Map<string, string>): MfLotOption[] {
```
Then change the `commonName` line (line 75) from:
```ts
      const commonName = pickString(row, ['common_name', 'commonName', 'active_ingredient']);
```
to:
```ts
      const rawCommonName = pickString(row, ['common_name', 'commonName', 'active_ingredient']);
      const commonName = normalizeCommonName(rawCommonName, cnMap);
```
(`sampleName` is computed below this line from `commonName`, so it picks up the canonical value automatically.)

- [ ] **Step 3: Fetch the override map in useLotOptions before the lot fetch**

Replace the body of the `useEffect` in `useLotOptions` (lines 128-153) with:
```ts
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      let cnMap = new Map<string, string>();
      try {
        const res = await api.get<CommonNameOverrideRow[]>("/common-name-overrides");
        cnMap = buildOverrideMap(res.data.data);
      } catch {
        // overrides are optional — fall back to raw names
      }
      const results = await Promise.allSettled(
        MF_LOT_API_URLS.map(async ({ source, url }) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${source} HTTP ${res.status}`);
          return normalizeLotOptions(await res.json(), source, cnMap);
        }),
      );
      if (!alive) return;
      const opts = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const failed = results.filter((r) => r.status === "rejected").length;
      setOptions(opts);
      setError(failed ? "โหลดตัวเลือกจาก MF API ได้ไม่ครบทุกแหล่ง" : null);
      setLoading(false);
    })().catch((e: Error) => {
      if (alive) {
        setError(e.message);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useExternalLookups.ts
git commit -m "feat(petitions): snapshot canonical common_name in lot options"
```

---

## Task 6: Full verification + seed export

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (including the 2 new files); count ≥ prior 193 + new tests

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit`
Expected: no errors
Run: `npm run lint`
Expected: no new errors in the touched files

- [ ] **Step 3: Export seed data (override collection is recoverable)**

Run: `cd server && npm run seed:export`
Expected: `server/seed-data/commonnameoverrides.json` is created (dynamic `listCollections()` picks up the new collection). Note: this only contains rows once the user has entered them via the UI.

- [ ] **Step 4: Commit seed data (if any rows exist)**

```bash
git add server/seed-data/
git commit -m "chore(seed): export common_name overrides"
```
(If no overrides have been entered yet, the file may be empty/absent — skip this commit.)

---

## Self-Review Notes

- **Spec coverage:** Model (Task 1) ✓, route + mount (Task 1) ✓, client helper + tests (Task 2) ✓, buildSimpleMethodRows apply + dedup + count-preserved (Task 3) ✓, admin UI inline (Task 4) ✓, lot-option apply (Task 5) ✓, seed export (Task 6) ✓. Appendix A mappings are entered by the domain expert via the Task 4 UI — intentionally not hardcoded.
- **Types:** `CommonNameOverrideRow` defined in Task 2, reused in Tasks 3-5. `SimpleMethodRow.rawCommonNames: string[]` defined in Task 3, consumed in Task 4. `normalizeKey`/`buildOverrideMap`/`normalizeCommonName` signatures consistent across tasks.
- **No placeholders:** every code step shows full code; verification steps give exact commands + expected output.
