# Standard Requisition — Instrument Group from Simple Method — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ลบปุ่มเลือกเครื่อง GC/HPLC ออกจากฟอร์มเบิก Standard แล้วให้ระบบ resolve กลุ่มเครื่อง (gc/hplc → จำนวนน้ำหนัก default) จาก simple method ของสารเอง

**Architecture:** สร้าง pure resolver ที่ build reverse index `สาร → {gc/hplc}` จาก `/master-items` (commonName) + `/simple-methods` (method code ราย-ตำแหน่งสาร) โดย reuse pattern เดียวกับ `PetitionAssignPage`. ฟอร์มเบิกเรียก resolver: 1 กลุ่ม=auto, ≥2=ให้เลือก, 0=default 1+เลือกเอง+เตือน. group ที่ได้บันทึกลง `StockTransaction.instrumentGroup`. **ไม่มี field ที่ `StockStandard`** (source of truth = simple method).

**Tech Stack:** React 18 + TS + Vite + TanStack Query (FE) / Express + Mongoose (BE) / Vitest (FE test) / Jest (BE test)

## Global Constraints

- Type-check ด้วย `npx tsc -p tsconfig.app.json` (ไม่ใช่ `--noEmit` — root tsconfig `files:[]` ทำให้เป็น no-op). Repo มี ~12 latent error ค้างอยู่ — เกณฑ์คือ **ไม่มี error ใหม่ในไฟล์ที่แตะ**
- **ห้ามรัน `npm run build`** ระหว่าง dev (postbuild รื้อ root files). FE test = `npm run test` (vitest). BE test = `cd server && npm test` (jest)
- **ห้ามเพิ่ม field group ที่ `StockStandard` / ห้ามแตะ schema standard / ไม่มี migration** (source of truth = simple method)
- UI label เป็นภาษาไทย. Match `matchSubstanceKey` (token แรก lowercase) เป็น key มาตรฐานทั้งแอป — สารตระกูล 2,4-D ยุบ key เดียวเป็นผลข้างเคียงที่ยอมรับ
- Commit ด้วย **explicit pathspec** (repo มี concurrent committer แทรก — ห้าม `git add -A`)
- Method group mapping: GC → `machinePrefix:'GC'` `defaultTimes 3`; HPLC → `machinePrefix:'HPLC'` `defaultTimes 1` (จาก `server/routes/methods.js`); `defaultWeightCount('gc')=3` else `1`

---

### Task 1: Resolver lib `standardInstrumentGroups.ts` (pure + tests)

**Files:**
- Create: `src/lib/standardInstrumentGroups.ts`
- Test: `src/lib/standardInstrumentGroups.test.ts`

**Interfaces:**
- Consumes (มีอยู่แล้ว): `readSlotMethods` + type `MethodDoc` จาก `src/lib/methodRegistry.ts`; `parseSubstances` + `matchSubstanceKey` จาก `src/lib/substances.ts`; `getItemNo` + `getRawCommonName` จาก `src/lib/masterItemFields.ts`
- Produces:
  - `type InstrumentGroup = 'gc' | 'hplc'`
  - `methodCodeToGroup(code: string, methodByCode: Map<string, MethodDoc>): InstrumentGroup | null`
  - `buildSubstanceGroups(masterItems: Record<string,unknown>[], simpleMethods: {itemNo:string; methods?:string[][]; instruments?:string[]}[], methodByCode: Map<string, MethodDoc>): Map<string, Set<InstrumentGroup>>`
  - `resolveGroups(name: string, index: Map<string, Set<InstrumentGroup>>): InstrumentGroup[]` (คืนลำดับคงที่ gc ก่อน hplc)

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน** — `src/lib/standardInstrumentGroups.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  methodCodeToGroup,
  buildSubstanceGroups,
  resolveGroups,
} from "./standardInstrumentGroups";
import type { MethodDoc } from "./methodRegistry";

const method = (over: Partial<MethodDoc>): MethodDoc => ({
  _id: "x", code: "X", label: "X", requiresMachine: false, machinePrefix: "",
  defaultTimes: 1, order: 0, active: true, builtIn: false, ...over,
});

const methodByCode = new Map<string, MethodDoc>([
  ["GC", method({ code: "GC", machinePrefix: "GC", requiresMachine: true, defaultTimes: 3 })],
  ["HPLC", method({ code: "HPLC", machinePrefix: "HPLC", requiresMachine: true, defaultTimes: 1 })],
  ["TITRATION", method({ code: "TITRATION", machinePrefix: "", requiresMachine: false })],
]);

describe("methodCodeToGroup", () => {
  it("maps GC/HPLC by machinePrefix; non-machine/unknown → null", () => {
    expect(methodCodeToGroup("GC", methodByCode)).toBe("gc");
    expect(methodCodeToGroup("HPLC", methodByCode)).toBe("hplc");
    expect(methodCodeToGroup("TITRATION", methodByCode)).toBeNull();
    expect(methodCodeToGroup("NOPE", methodByCode)).toBeNull();
  });
});

describe("buildSubstanceGroups + resolveGroups", () => {
  it("single-substance item → one group", () => {
    const master = [{ item_no: "P1", common_name: "Abamectin 1.8% EC" }];
    const simple = [{ itemNo: "P1", methods: [["GC"]] }];
    const idx = buildSubstanceGroups(master, simple, methodByCode);
    expect(resolveGroups("Abamectin", idx)).toEqual(["gc"]);
  });

  it("same substance in a GC item and an HPLC item → two groups (gc before hplc)", () => {
    const master = [
      { item_no: "P1", common_name: "Atrazine 90% WG" },
      { item_no: "P2", common_name: "Atrazine 50% SC" },
    ];
    const simple = [
      { itemNo: "P1", methods: [["GC"]] },
      { itemNo: "P2", methods: [["HPLC"]] },
    ];
    const idx = buildSubstanceGroups(master, simple, methodByCode);
    expect(resolveGroups("Atrazine", idx)).toEqual(["gc", "hplc"]);
  });

  it("combined 'A + B' item resolves each substance by position", () => {
    const master = [{ item_no: "P1", common_name: "Atrazine + Ametryn" }];
    const simple = [{ itemNo: "P1", methods: [["GC"], ["HPLC"]] }];
    const idx = buildSubstanceGroups(master, simple, methodByCode);
    expect(resolveGroups("Atrazine", idx)).toEqual(["gc"]);
    expect(resolveGroups("Ametryn", idx)).toEqual(["hplc"]);
  });

  it("substance with no simple-method entry → empty", () => {
    const master = [{ item_no: "P1", common_name: "Abamectin 1.8% EC" }];
    const idx = buildSubstanceGroups(master, [], methodByCode);
    expect(resolveGroups("Abamectin", idx)).toEqual([]);
    expect(resolveGroups("Unknown", idx)).toEqual([]);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/lib/standardInstrumentGroups.test.ts`
Expected: FAIL — `Failed to resolve import "./standardInstrumentGroups"` (ยังไม่มีไฟล์)

- [ ] **Step 3: เขียน implementation** — `src/lib/standardInstrumentGroups.ts`

```ts
// resolve กลุ่มเครื่อง (gc/hplc) ของสาร จาก simple method — reverse index
// join master-items (commonName) + simple-methods (method code ราย-ตำแหน่งสาร).
// ไม่มี field group ที่ StockStandard: simple method เป็น source of truth ตัวเดียว.
import { readSlotMethods, type MethodDoc } from "./methodRegistry";
import { parseSubstances, matchSubstanceKey } from "./substances";
import { getItemNo, getRawCommonName } from "./masterItemFields";

export type InstrumentGroup = "gc" | "hplc";

type SimpleMethodEntry = { itemNo: string; methods?: string[][]; instruments?: string[] };
type MasterItemRaw = Record<string, unknown>;

// method code → group ผ่าน machinePrefix (machine-backed เท่านั้น). อื่น → null.
export function methodCodeToGroup(
  code: string,
  methodByCode: Map<string, MethodDoc>,
): InstrumentGroup | null {
  const method = methodByCode.get(code);
  if (!method || !method.requiresMachine) return null;
  const prefix = String(method.machinePrefix || "").trim().toUpperCase();
  if (prefix === "HPLC") return "hplc";
  if (prefix === "GC") return "gc";
  return null;
}

// build: matchSubstanceKey(สาร) → Set<group> รวมทุกสินค้า.
export function buildSubstanceGroups(
  masterItems: MasterItemRaw[],
  simpleMethods: SimpleMethodEntry[],
  methodByCode: Map<string, MethodDoc>,
): Map<string, Set<InstrumentGroup>> {
  const itemNoToEntry = new Map<string, SimpleMethodEntry>();
  simpleMethods.forEach((entry) => {
    if (entry.itemNo) itemNoToEntry.set(String(entry.itemNo).trim(), entry);
  });

  const index = new Map<string, Set<InstrumentGroup>>();
  masterItems.forEach((item) => {
    const commonName = getRawCommonName(item);
    if (!commonName) return;
    const entry = itemNoToEntry.get(getItemNo(item));
    if (!entry) return;
    const substances = parseSubstances(commonName);
    const slots = readSlotMethods(entry, substances.length);
    substances.forEach((name, i) => {
      const key = matchSubstanceKey(name);
      if (!key) return;
      (slots[i] ?? []).forEach((code) => {
        const group = methodCodeToGroup(code, methodByCode);
        if (!group) return;
        let set = index.get(key);
        if (!set) { set = new Set<InstrumentGroup>(); index.set(key, set); }
        set.add(group);
      });
    });
  });
  return index;
}

// lookup — คืน gc ก่อน hplc เพื่อความ deterministic.
export function resolveGroups(
  name: string,
  index: Map<string, Set<InstrumentGroup>>,
): InstrumentGroup[] {
  const set = index.get(matchSubstanceKey(name));
  if (!set) return [];
  return (["gc", "hplc"] as InstrumentGroup[]).filter((g) => set.has(g));
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/standardInstrumentGroups.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/standardInstrumentGroups.ts src/lib/standardInstrumentGroups.test.ts
git commit -m "feat(stock): resolver สาร→กลุ่มเครื่อง (gc/hplc) จาก simple method"
```

---

### Task 2: Backend — `StockTransaction.instrumentGroup` + thread ผ่าน deduct-mg

**Files:**
- Modify: `server/models/StockTransaction.js` (หลังบรรทัด `instrumentName: String,`)
- Modify: `server/routes/stock.js` (`deductMgFromUnit` ~บรรทัด 89-95; route `POST /units/:qrId/deduct-mg` ~บรรทัด 227-234)
- Test: `server/models/StockTransaction.test.js`

**Interfaces:**
- Produces: `StockTransaction` มี path `instrumentGroup` (String, enum รวม `'gc'`/`'hplc'`, default `null`); `POST /stock/units/:qrId/deduct-mg` รับ body field `instrumentGroup` แล้วเก็บลง transaction

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน** — `server/models/StockTransaction.test.js`

```js
const StockTransaction = require('./StockTransaction');

describe('StockTransaction schema', () => {
  test('has instrumentGroup enum path with gc/hplc + null default', () => {
    const path = StockTransaction.schema.path('instrumentGroup');
    expect(path).toBeDefined();
    expect(path.instance).toBe('String');
    expect(path.enumValues).toContain('gc');
    expect(path.enumValues).toContain('hplc');
    expect(path.defaultValue).toBeNull();
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `cd server && npx jest models/StockTransaction.test.js`
Expected: FAIL — `path` เป็น undefined (ยังไม่มี field)

- [ ] **Step 3: เพิ่ม field ใน model** — `server/models/StockTransaction.js`

หา:
```js
  instrumentId: String,
  instrumentName: String,
```
แทนด้วย (เพิ่มบรรทัด `instrumentGroup`):
```js
  instrumentId: String,
  instrumentName: String,
  instrumentGroup: { type: String, enum: ['gc', 'hplc', null], default: null },
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `cd server && npx jest models/StockTransaction.test.js`
Expected: PASS

- [ ] **Step 5: Thread `instrumentGroup` ผ่าน deduct-mg** — `server/routes/stock.js`

(5a) ใน `deductMgFromUnit` หา:
```js
    weights: meta.weights,
    instrumentId: meta.instrumentId,
    instrumentName: meta.instrumentName,
    sampleId: meta.sampleId,
```
แทนด้วย:
```js
    weights: meta.weights,
    instrumentId: meta.instrumentId,
    instrumentName: meta.instrumentName,
    instrumentGroup: meta.instrumentGroup,
    sampleId: meta.sampleId,
```

(5b) ใน route `POST /units/:qrId/deduct-mg` หา:
```js
    const { mg, weights, instrumentId, instrumentName, sampleId, petitionNo, note } = req.body || {};
    const amount = Array.isArray(weights) && weights.length ? sumWeights(weights) : mg;
    const meta = {
      weights: Array.isArray(weights) ? weights.map(Number) : undefined,
      instrumentId, instrumentName, sampleId,
```
แทนด้วย:
```js
    const { mg, weights, instrumentId, instrumentName, instrumentGroup, sampleId, petitionNo, note } = req.body || {};
    const amount = Array.isArray(weights) && weights.length ? sumWeights(weights) : mg;
    const meta = {
      weights: Array.isArray(weights) ? weights.map(Number) : undefined,
      instrumentId, instrumentName, instrumentGroup, sampleId,
```

- [ ] **Step 6: รัน BE test suite ทั้งชุด (กัน regress)**

Run: `cd server && npx jest`
Expected: PASS ทั้งหมด (รวม `models/StockTransaction.test.js` ใหม่)

- [ ] **Step 7: Commit**

```bash
git add server/models/StockTransaction.js server/models/StockTransaction.test.js server/routes/stock.js
git commit -m "feat(stock): StockTransaction.instrumentGroup + thread ผ่าน deduct-mg"
```

---

### Task 3: Frontend — รื้อฟอร์มเบิก + api type + caller

**Files:**
- Modify: `src/lib/api.ts` (`deductStockUnitMg` body type ~บรรทัด 334-341)
- Modify: `src/components/lis/stock/StandardRequisitionDialog.tsx` (แทนทั้งไฟล์)
- Modify: `src/components/lis/stock/StockRequisitionButton.tsx` (บรรทัด 59 — เลิกส่ง `instruments`)

**Interfaces:**
- Consumes: `buildSubstanceGroups`/`resolveGroups`/`InstrumentGroup` (Task 1); `api.deductStockUnitMg({ instrumentGroup })` (Task 2 backend รับแล้ว)
- Produces: `<StandardRequisitionDialog>` prop signature ใหม่ = `{ onClose, onSaved }` (ไม่มี `instruments`)

- [ ] **Step 1: เพิ่ม `instrumentGroup` ใน api body type** — `src/lib/api.ts`

หา:
```ts
  deductStockUnitMg: (
    qrId: string,
    body: { weights?: number[]; mg?: number; instrumentId?: string; instrumentName?: string; sampleId?: string; petitionNo?: string; note?: string },
  ) =>
```
แทนด้วย:
```ts
  deductStockUnitMg: (
    qrId: string,
    body: { weights?: number[]; mg?: number; instrumentGroup?: "gc" | "hplc"; instrumentId?: string; instrumentName?: string; sampleId?: string; petitionNo?: string; note?: string },
  ) =>
```

- [ ] **Step 2: แทนทั้งไฟล์ `StandardRequisitionDialog.tsx`**

เขียนทับ `src/components/lis/stock/StandardRequisitionDialog.tsx` ทั้งไฟล์ด้วย:

```tsx
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { isUsableBottle } from "@/lib/stockStatus";
import { defaultWeightCount, sumWeights, validateWeights } from "@/lib/standardRequisition";
import { buildSubstanceGroups, resolveGroups, type InstrumentGroup } from "@/lib/standardInstrumentGroups";
import { cn } from "@/lib/utils";
import type { StockUnitItem } from "@/types/stock";

const TYPES = ["primary", "working", "supplier"] as const;
type BottleType = (typeof TYPES)[number];
type MasterItemRaw = Record<string, unknown>;
const GROUP_LABEL: Record<InstrumentGroup, string> = { gc: "GC", hplc: "HPLC" };

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function StandardRequisitionDialog({ onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [bottleType, setBottleType] = useState<BottleType>("primary");
  const [qrId, setQrId] = useState("");
  const [pickedGroup, setPickedGroup] = useState<InstrumentGroup | null>(null);
  const [weights, setWeights] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: standards = [] } = useQuery({ queryKey: ["stock", "standards"], queryFn: api.getStandards });
  const { data: allUnits = [] } = useQuery({ queryKey: ["stock", "units"], queryFn: () => api.getStockUnits() });

  // สาร → กลุ่มเครื่อง (gc/hplc) จาก simple method (reuse pattern PetitionAssign)
  const { data: masterItems = [] } = useQuery<MasterItemRaw[]>({
    queryKey: ["master-items"],
    queryFn: async () => {
      const res = await api.get<unknown>("/master-items");
      const payload = res.data.data;
      if (Array.isArray(payload)) return payload as MasterItemRaw[];
      if (payload && typeof payload === "object") {
        const arr = (payload as { data?: unknown }).data ?? (payload as { items?: unknown }).items;
        if (Array.isArray(arr)) return arr as MasterItemRaw[];
      }
      return [];
    },
    staleTime: 5 * 60_000,
  });
  const { data: simpleMethods = [] } = useQuery<Array<{ itemNo: string; methods?: string[][]; instruments?: string[] }>>({
    queryKey: ["simple-methods"],
    queryFn: async () => {
      const res = await api.get<Array<{ itemNo: string; methods?: string[][]; instruments?: string[] }>>("/simple-methods");
      return (res.data.data ?? []).map((e) => ({ itemNo: e.itemNo, methods: e.methods, instruments: e.instruments }));
    },
    staleTime: 5 * 60_000,
  });
  const { data: registryMethods = [] } = useQuery({ queryKey: ["methods"], queryFn: () => api.getMethods(), staleTime: 5 * 60_000 });
  const methodByCode = useMemo(() => new Map(registryMethods.map((m) => [m.code, m])), [registryMethods]);
  const substanceGroups = useMemo(
    () => buildSubstanceGroups(masterItems, simpleMethods, methodByCode),
    [masterItems, simpleMethods, methodByCode],
  );

  // สารที่มีขวดใช้ได้จริง ≥ 1 (ทุก type)
  const usableByCode = useMemo(() => {
    const m = new Map<string, StockUnitItem[]>();
    for (const u of allUnits) {
      if (!isUsableBottle(u)) continue;
      const list = m.get(u.itemCode);
      if (list) list.push(u);
      else m.set(u.itemCode, [u]);
    }
    return m;
  }, [allUnits]);

  const inStock = useMemo(
    () => standards.filter((s) => (usableByCode.get(s.code)?.length ?? 0) > 0),
    [standards, usableByCode],
  );
  const standard = standards.find((s) => s.code === code) ?? null;

  const resolvedGroups = useMemo(
    () => (standard ? resolveGroups(standard.name, substanceGroups) : []),
    [standard, substanceGroups],
  );
  const needsGroupPick = resolvedGroups.length >= 2;
  const effectiveGroup: InstrumentGroup | null = resolvedGroups.length === 1 ? resolvedGroups[0] : pickedGroup;

  const bottlesOfType = useMemo(
    () => (usableByCode.get(code) ?? []).filter((u) => (u.type || "primary") === bottleType)
      .sort((a, b) => (a.exp ? +new Date(a.exp) : Infinity) - (b.exp ? +new Date(b.exp) : Infinity)),
    [usableByCode, code, bottleType],
  );
  const typeCounts = useMemo(() => {
    const c: Record<BottleType, number> = { primary: 0, working: 0, supplier: 0 };
    for (const u of usableByCode.get(code) ?? []) c[((u.type || "primary") as BottleType)] += 1;
    return c;
  }, [usableByCode, code]);

  const bottle = bottlesOfType.find((b) => b.qrId === qrId) ?? bottlesOfType[0] ?? null;
  const remainingMg = bottle?.volume?.remaining ?? 0;
  const nums = weights.map((w) => Number(w));
  const total = sumWeights(nums);
  const weightError = bottle ? validateWeights(nums, remainingMg) : "";
  const canSave = !!(bottle && !weightError && user?.name && (!needsGroupPick || pickedGroup));

  const defaultCount = defaultWeightCount(effectiveGroup ?? undefined);
  const isCustom = !!effectiveGroup && weights.length !== defaultCount;

  const pickStandard = (c: string) => {
    setCode(c); setPickOpen(false); setQrId(""); setPickedGroup(null);
    const counts = { primary: 0, working: 0, supplier: 0 } as Record<BottleType, number>;
    for (const u of usableByCode.get(c) ?? []) counts[((u.type || "primary") as BottleType)] += 1;
    setBottleType(TYPES.find((t) => counts[t] > 0) ?? "primary");
    const s = standards.find((x) => x.code === c) ?? null;
    const groups = s ? resolveGroups(s.name, substanceGroups) : [];
    const n = groups.length === 1 ? defaultWeightCount(groups[0]) : 1;
    setWeights(Array.from({ length: n }, () => ""));
  };
  const pickGroup = (g: InstrumentGroup) => {
    setPickedGroup(g);
    setWeights(Array.from({ length: defaultWeightCount(g) }, () => ""));
  };
  const setWeightAt = (i: number, v: string) => setWeights((prev) => { const x = [...prev]; x[i] = v; return x; });
  const setCount = (n: number) => setWeights((prev) => {
    const x = prev.slice(0, Math.max(1, n));
    while (x.length < n) x.push("");
    return x;
  });

  const submit = async () => {
    if (!bottle) return;
    setBusy(true);
    try {
      await api.deductStockUnitMg(bottle.qrId, {
        weights: nums,
        instrumentGroup: effectiveGroup ?? undefined,
        note: note || undefined,
      });
      toast.success(`เบิก ${standard?.name ?? "standard"} ${nums.length} น้ำหนัก (${total} mg)`);
      qc.invalidateQueries({ queryKey: ["stock", "units"] });
      qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
      onSaved(); onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  const groupChoices: InstrumentGroup[] = resolvedGroups.length >= 2 ? resolvedGroups : (["gc", "hplc"] as InstrumentGroup[]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เบิก Standard</DialogTitle>
          <DialogDescription>เลือกสาร ประเภทขวด แล้วกรอก mg แต่ละน้ำหนัก (กลุ่มเครื่องมาจาก simple method)</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* สาร (เฉพาะที่มีขวด) */}
          <div>
            <Label className="mb-1.5 block">Standard (มีของในสต็อก)</Label>
            <Popover open={pickOpen} onOpenChange={setPickOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{standard ? `${standard.name} (${standard.code})` : "เลือก standard..."}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="ค้นหาชื่อ/code" />
                  <CommandList>
                    <CommandEmpty>ไม่มีสารที่มีขวดใช้ได้</CommandEmpty>
                    {inStock.map((s) => (
                      <CommandItem key={s.code} value={`${s.name} ${s.code}`} onSelect={() => pickStandard(s.code)}>
                        <Check className={cn("mr-2 h-4 w-4", code === s.code ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{usableByCode.get(s.code)?.length ?? 0} ขวด</span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {code && (
            <>
              {/* วิธี / กลุ่มเครื่อง (จาก simple method) */}
              <div>
                <Label className="mb-1.5 block">วิธี / กลุ่มเครื่อง</Label>
                {resolvedGroups.length === 1 ? (
                  <div className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                    <span className="font-medium">{GROUP_LABEL[resolvedGroups[0]]}</span>
                    <span className="text-xs text-muted-foreground">· default {defaultWeightCount(resolvedGroups[0])} น้ำหนัก</span>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-1.5">
                      {groupChoices.map((g) => (
                        <Button key={g} type="button" size="sm" variant={pickedGroup === g ? "default" : "outline"}
                          className="h-8 text-xs" onClick={() => pickGroup(g)}>
                          {GROUP_LABEL[g]}
                        </Button>
                      ))}
                    </div>
                    {resolvedGroups.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        สารนี้ยังไม่มี simple method ระบุเครื่อง — ไปตั้งที่ Simple Method (เลือกเองชั่วคราวได้)
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* ประเภทขวด */}
              <div>
                <Label className="mb-1.5 block">ประเภทขวด</Label>
                <div className="flex gap-1.5">
                  {TYPES.map((t) => (
                    <Button key={t} type="button" size="sm" disabled={typeCounts[t] === 0}
                      variant={bottleType === t ? "default" : "outline"} className="h-8 text-xs"
                      onClick={() => { setBottleType(t); setQrId(""); }}>
                      {t} ({typeCounts[t]})
                    </Button>
                  ))}
                </div>
              </div>

              {/* ขวด */}
              <div>
                <Label className="mb-1.5 block">ขวด (EXP ใกล้สุดก่อน)</Label>
                {bottlesOfType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ไม่มีขวดประเภทนี้</p>
                ) : (
                  <div className="space-y-1.5">
                    {bottlesOfType.map((u) => (
                      <label key={u.qrId} className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm",
                        (bottle?.qrId === u.qrId) ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                        <input type="radio" name="bottle" checked={bottle?.qrId === u.qrId} onChange={() => setQrId(u.qrId)} />
                        <span className="text-xs text-muted-foreground">
                          Lot {u.lotNo || "-"} · เหลือ {u.volume?.remaining} {u.volume?.unit} · EXP {u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* จำนวนน้ำหนัก + mg */}
              {bottle && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      จำนวนน้ำหนัก
                      {isCustom && <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">custom</span>}
                    </Label>
                    <Input type="number" min={1} max={20} value={weights.length} className="h-8 w-20"
                      onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
                  </div>
                  <div className="space-y-1.5">
                    {weights.map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-16 text-xs text-muted-foreground">น้ำหนัก {i + 1}</span>
                        <Input type="number" step="0.0001" min="0" placeholder="mg" value={w}
                          onChange={(e) => setWeightAt(i, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    รวม {total} mg · คงเหลือหลังหัก {Math.max(0, remainingMg - total)} mg
                  </p>
                  {weightError && <p className="mt-1 text-sm text-destructive">{weightError}</p>}
                </div>
              )}

              <div>
                <Label className="mb-1.5 block">หมายเหตุ</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="button" disabled={!canSave || busy} onClick={submit}>
            {busy ? "กำลังบันทึก..." : "เบิก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: เลิกส่ง `instruments` ให้ Standard dialog** — `src/components/lis/stock/StockRequisitionButton.tsx`

หา (บรรทัด 59):
```tsx
        <StandardRequisitionDialog instruments={instruments} onClose={() => setWhich(null)} onSaved={refreshStandards} />
```
แทนด้วย:
```tsx
        <StandardRequisitionDialog onClose={() => setWhich(null)} onSaved={refreshStandards} />
```
(ไม่แตะ prop `instruments` ของ `StockRequisitionButton` เอง — `ChemicalRequisitionDialog` ยังใช้อยู่)

- [ ] **Step 4: Type-check เฉพาะไฟล์ที่แตะ (ไม่มี error ใหม่)**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่ในไฟล์ `StandardRequisitionDialog.tsx` / `StockRequisitionButton.tsx` / `api.ts` (latent error เดิม ~12 จุดในไฟล์อื่นยอมรับได้)

- [ ] **Step 5: Lint + FE test suite ทั้งชุด**

Run: `npm run lint`
Expected: ไม่มี error ใหม่ในไฟล์ที่แตะ

Run: `npm run test`
Expected: PASS ทั้งหมด (รวม `standardInstrumentGroups.test.ts` ใหม่)

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/components/lis/stock/StandardRequisitionDialog.tsx src/components/lis/stock/StockRequisitionButton.tsx
git commit -m "feat(stock): เบิก Standard — resolve กลุ่มเครื่องจาก simple method (ลบปุ่มเลือกเครื่อง)"
```

---

### Task 4: Manual E2E + seed-data backup

**Files:** ไม่แก้โค้ด (verification + backup)

- [ ] **Step 1: รัน dev ทั้ง 2 process**

```bash
# terminal 1
cd server && npm run dev
# terminal 2 (repo root)
npm run dev
```

- [ ] **Step 2: ทดสอบ 4 เคสในเบราว์เซอร์** (หน้า Stock / stock-deduction → ปุ่ม "เบิก stock" → Standard)

1. **สาร 1-กลุ่ม (GC)** เช่น สารที่ simple method เป็น GC → เห็นป้าย `GC · default 3 น้ำหนัก`, ช่องน้ำหนัก = 3; แก้เป็น 4 → เห็นป้าย `custom`; กรอก mg ครบ → กด "เบิก" ได้ → mg คงเหลือของขวดลด
2. **สาร 2-กลุ่ม** (สารที่โผล่ทั้งสินค้า GC และ HPLC) → ปุ่ม "เบิก" disabled จนกดเลือก GC/HPLC → เลือก HPLC → จำนวนน้ำหนัก = 1
3. **สารไม่มี simple method** → เห็น hint สีเหลือง + default 1 + เลือก GC/HPLC เองได้ → เบิกได้
4. **ยืนยันไม่มีแถวปุ่ม "เครื่อง" (list machines) แล้ว** ในฟอร์ม

- [ ] **Step 3: verify audit** — เปิดแท็บประวัติ (stock-deduction) หรือ query `stocktransactions` ล่าสุด ยืนยันมี `instrumentGroup` = `'gc'`/`'hplc'` ตามที่เลือก/resolve และ `weights[]` ถูก

- [ ] **Step 4: seed-data backup (DB กู้คืนได้)**

```bash
cd server && npm run seed:export
git add server/seed-data
git commit -m "chore(stock): seed:export หลังเพิ่ม instrumentGroup ใน transaction"
```

- [ ] **Step 5: บันทึกผล E2E** — จดว่าเคสไหนผ่าน/ไม่ผ่าน; ถ้าเจอบั๊ก ย้อนไป Task ที่เกี่ยวข้อง

---

## Self-Review Notes

**Spec coverage:**
- §2-3 resolver → Task 1 ✓
- §4 ฟอร์ม (1/2/0 กลุ่ม, custom, canSave) → Task 3 Step 2 ✓
- §5 audit (model + route + api) → Task 2 + Task 3 Step 1 ✓
- §6 caller เลิกส่ง instruments → Task 3 Step 3 ✓
- §7 ไม่แตะ StockStandard schema/config → ยืนยัน: ไม่มี task แตะ ✓
- §9 test plan (unit/backend/E2E) → Task 1/2/4 ✓
- **หมายเหตุ:** spec §3 เดิมเสนอ "ย้าย MASTER_*_KEYS ไป lib กลาง + refactor PetitionAssign" — ตัดออก เพราะ `masterItemFields.ts` มี `getItemNo`/`getRawCommonName` (+ key arrays) อยู่แล้ว, resolver reuse ได้ตรงๆ; การ refactor PetitionAssign เป็น churn นอกขอบเขต (ไม่กระทบฟีเจอร์)

**Type consistency:** `InstrumentGroup`, `resolveGroups`, `buildSubstanceGroups`, `methodByCode: Map<string, MethodDoc>`, `effectiveGroup`, `instrumentGroup` ใช้ชื่อ/ชนิดตรงกันทุก task ✓

**Placeholder scan:** ไม่มี TBD/TODO — โค้ดเต็มทุก step ✓
