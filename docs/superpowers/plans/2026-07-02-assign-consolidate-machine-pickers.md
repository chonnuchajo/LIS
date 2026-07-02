# Consolidate Machine Pickers by Instrument Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Petition Assign page, render one machine picker per distinct instrument type within a commonName group, so two substances that both need GC share a single GC picker (different types still show separate pickers).

**Architecture:** Extract a pure helper `groupMachineMethods()` that collapses a group's per-substance machine-backed methods into one entry per distinct method code. Then re-key machine selection state in `PetitionAssignPage.tsx` from `(slotIndex, methodCode)` to `methodCode` (group level), and drive rendering + satisfaction + baseline from the helper. No server/schema change — `assignedMachines[]` is already tagged only by `(sampleName, commonName)`.

**Tech Stack:** React 18 + TypeScript, Vitest, Vite.

## Global Constraints

- Path alias `@/*` → `src/*`.
- Type-check with `npx tsc -p tsconfig.app.json --noEmit` (the CLAUDE.md `npx tsc --noEmit` is a no-op because the root tsconfig has `files: []`). The repo has ~12 pre-existing latent type errors; the bar is **no new errors** in the files this plan touches.
- Do **not** run `npm run build` (its postbuild rewrites root files).
- Commit only this plan's files with explicit pathspec (a concurrent committer may touch `develop`).
- Vitest: `npm run test` (run once) / `npm run test:watch`.

---

### Task 1: Pure grouping helper `groupMachineMethods`

**Files:**
- Create: `src/lib/assignMachineGrouping.ts`
- Test: `src/lib/assignMachineGrouping.test.ts`

**Interfaces:**
- Consumes: `MethodDoc` from `src/lib/methodRegistry.ts` (fields used: `code`, `label`, `requiresMachine`, `active`).
- Produces:
  - `type SubstanceSlotLike = { name: string; methods: string[] }`
  - `type GroupMachineMethod = { code: string; method: MethodDoc; substanceNames: string[] }`
  - `function groupMachineMethods(slots: SubstanceSlotLike[], methodByCode: Map<string, MethodDoc>): GroupMachineMethod[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/assignMachineGrouping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupMachineMethods, type SubstanceSlotLike } from './assignMachineGrouping';
import type { MethodDoc } from './methodRegistry';

function method(code: string, over: Partial<MethodDoc> = {}): MethodDoc {
  return {
    _id: code,
    code,
    label: code,
    requiresMachine: true,
    machinePrefix: code,
    defaultTimes: 1,
    order: 0,
    active: true,
    builtIn: false,
    ...over,
  };
}

const registry = new Map<string, MethodDoc>([
  ['GC', method('GC')],
  ['HPLC', method('HPLC')],
  ['TITRATE', method('TITRATE', { requiresMachine: false, machinePrefix: '' })],
  ['GC_OLD', method('GC_OLD', { active: false })],
]);

describe('groupMachineMethods', () => {
  it('collapses two substances that share a type into one entry', () => {
    const slots: SubstanceSlotLike[] = [
      { name: 'PROPANIL 36%', methods: ['GC'] },
      { name: 'BUTACHLOR 50%', methods: ['GC'] },
    ];
    const result = groupMachineMethods(slots, registry);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('GC');
    expect(result[0].substanceNames).toEqual(['PROPANIL 36%', 'BUTACHLOR 50%']);
  });

  it('keeps different types as separate entries in first-seen order', () => {
    const slots: SubstanceSlotLike[] = [
      { name: 'A', methods: ['HPLC'] },
      { name: 'B', methods: ['GC'] },
    ];
    const result = groupMachineMethods(slots, registry);
    expect(result.map((r) => r.code)).toEqual(['HPLC', 'GC']);
  });

  it('handles a substance needing two machine methods plus a shared one', () => {
    const slots: SubstanceSlotLike[] = [
      { name: 'A', methods: ['GC', 'HPLC'] },
      { name: 'B', methods: ['GC'] },
    ];
    const result = groupMachineMethods(slots, registry);
    expect(result.map((r) => r.code)).toEqual(['GC', 'HPLC']);
    expect(result.find((r) => r.code === 'GC')!.substanceNames).toEqual(['A', 'B']);
    expect(result.find((r) => r.code === 'HPLC')!.substanceNames).toEqual(['A']);
  });

  it('excludes bench (non-machine), unknown, and empty codes', () => {
    const slots: SubstanceSlotLike[] = [
      { name: 'A', methods: ['TITRATE'] },
      { name: 'B', methods: ['UNKNOWN'] },
      { name: 'C', methods: [] },
    ];
    expect(groupMachineMethods(slots, registry)).toEqual([]);
  });

  it('includes inactive machine-backed methods (picker still shown; assign blocked elsewhere)', () => {
    const slots: SubstanceSlotLike[] = [{ name: 'A', methods: ['GC_OLD'] }];
    const result = groupMachineMethods(slots, registry);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('GC_OLD');
  });

  it('does not duplicate a substance name when it lists a code twice', () => {
    const slots: SubstanceSlotLike[] = [{ name: 'A', methods: ['GC', 'GC'] }];
    const result = groupMachineMethods(slots, registry);
    expect(result).toHaveLength(1);
    expect(result[0].substanceNames).toEqual(['A']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/assignMachineGrouping.test.ts`
Expected: FAIL — cannot resolve `./assignMachineGrouping` / `groupMachineMethods is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/assignMachineGrouping.ts`:

```ts
import type { MethodDoc } from './methodRegistry';

// One substance slot within a commonName group: its name + the AND-set of
// method codes required for it (positional, aligned to parseSubstances()).
export type SubstanceSlotLike = {
  name: string;
  methods: string[];
};

// A machine-backed method shared by one or more substances in a group.
export type GroupMachineMethod = {
  code: string;              // method code, e.g. "GC"
  method: MethodDoc;         // resolved registry method (requiresMachine === true)
  substanceNames: string[];  // substances in the group requiring this method
};

// Collapse a group's per-substance machine-backed methods into one entry per
// distinct method code. GC on two substances → a single entry whose
// substanceNames lists both. Bench (non-machine), unknown, and empty codes are
// excluded — the page handles those as per-substance signals. First-seen code
// order is preserved so the UI is stable.
export function groupMachineMethods(
  slots: SubstanceSlotLike[],
  methodByCode: Map<string, MethodDoc>,
): GroupMachineMethod[] {
  const order: string[] = [];
  const byCode = new Map<string, GroupMachineMethod>();
  slots.forEach((slot) => {
    slot.methods.forEach((code) => {
      const method = methodByCode.get(code);
      if (!method || !method.requiresMachine) return;
      let entry = byCode.get(code);
      if (!entry) {
        entry = { code, method, substanceNames: [] };
        byCode.set(code, entry);
        order.push(code);
      }
      if (slot.name && !entry.substanceNames.includes(slot.name)) {
        entry.substanceNames.push(slot.name);
      }
    });
  });
  return order.map((code) => byCode.get(code)!);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/assignMachineGrouping.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/assignMachineGrouping.ts src/lib/assignMachineGrouping.test.ts
git commit -m "feat(assign): groupMachineMethods helper — collapse machine methods by type" -- src/lib/assignMachineGrouping.ts src/lib/assignMachineGrouping.test.ts
```

---

### Task 2: Wire the helper into `PetitionAssignPage.tsx`

Re-key machine selection from `(slotIndex, methodCode)` to `methodCode` (group level), and drive rendering + satisfaction + baseline from `groupMachineMethods`. This is one cohesive single-file change (the file must compile as a unit), verified by type-check + lint + manual E2E.

**Files:**
- Modify: `src/pages/PetitionAssignPage.tsx`

**Interfaces:**
- Consumes: `groupMachineMethods`, `GroupMachineMethod` from `src/lib/assignMachineGrouping.ts` (Task 1); existing `machineMatchesMethod`, `MethodDoc` from `src/lib/methodRegistry.ts`.
- Produces (internal): selection state `machinesByPetition[pid][groupKey][code] = machineId`; `setMachineForMethod(petitionId, groupKey, code, machineKey)`; `AssignTableProps.onSelectMachine: (petitionId, groupKey, code, machineKey) => void`.

- [ ] **Step 1: Add the import**

In `src/pages/PetitionAssignPage.tsx`, below the `methodRegistry` import (line ~30), add:

```ts
import { groupMachineMethods } from '@/lib/assignMachineGrouping';
```

- [ ] **Step 2: Remove the now-unused `slotMethodKey` helper**

Delete this function (near line 76–79):

```ts
// Stable key for a machine selection: (substance index, machine-backed method code).
function slotMethodKey(slotIndex: number, code: string): string {
  return `${slotIndex}::${code}`;
}
```

Update the state comment (lines ~187–190) to reflect the new key:

```ts
  // machinesByPetition[petitionId][groupKey][methodCode] = machineId.
  // Keyed per (group, machine-backed method code): substances in a group that
  // share an instrument type share one machine (one picker per type).
  const [machinesByPetition, setMachinesByPetition] =
    useState<Record<string, Record<string, Record<string, string>>>>({});
```

- [ ] **Step 3: Replace `machineMethodsOfSlot` and `baselineSlotsForGroup`**

Replace the `machineMethodsOfSlot` memo (lines ~375–380) AND the `baselineSlotsForGroup` function (lines ~389–411) with this single new `baselineSlotsForGroup` (delete `machineMethodsOfSlot` entirely — it is no longer used):

```ts
  // Baseline (methodCode → machineId) mapping for a group, derived from saved
  // assignedMachines: each saved machine is first-fit matched to a distinct
  // machine-backed method it satisfies. assignedMachines carries no method tag,
  // so reload re-binds by first-fit — safe because GC/HPLC prefixes are mutually
  // exclusive and each group now holds at most one machine per method type.
  function baselineSlotsForGroup(petition: Petition, group: SubstanceGroup): Record<string, string> {
    const saved = (petition.assignedMachines ?? []).filter(
      (m) => groupKeyOf(m.sampleName ?? '', m.commonName ?? '') === group.groupKey,
    );
    const result: Record<string, string> = {};
    const used = new Set<string>();
    groupMachineMethods(group.slots, methodByCode).forEach((gm) => {
      const match = saved.find((m) => {
        if (used.has(m.machineId)) return false;
        const machine = machineById.get(m.machineId);
        return !!machine && machineMatchesMethod(machine.name, gm.method, registryMethods);
      });
      if (match) {
        result[gm.code] = match.machineId;
        used.add(match.machineId);
      }
    });
    return result;
  }
```

- [ ] **Step 4: Rename `setMachineForSlot` → `setMachineForMethod` (drop slotIndex)**

Replace the `setMachineForSlot` function (lines ~422–446) with:

```ts
  // Single-select per (group, machine-backed method): picking a machine sets that
  // type's requirement; picking the already-selected machine clears it.
  function setMachineForMethod(
    petitionId: string,
    groupKey: string,
    methodCode: string,
    machineKey: string,
  ) {
    setMachinesByPetition((prev) => {
      const petition = allPetitions.find((p) => p._id === petitionId);
      const groups = petition ? buildSubstanceGroups(petition, commonNameToSlots) : [];
      const group = groups.find((g) => g.groupKey === groupKey);
      const baselineMap: Record<string, Record<string, string>> = { ...(prev[petitionId] ?? {}) };
      if (baselineMap[groupKey] === undefined) {
        baselineMap[groupKey] = petition && group ? baselineSlotsForGroup(petition, group) : {};
      }
      const current = { ...baselineMap[groupKey] };
      if (current[methodCode] === machineKey) delete current[methodCode];
      else current[methodCode] = machineKey;
      baselineMap[groupKey] = current;
      return { ...prev, [petitionId]: baselineMap };
    });
  }
```

- [ ] **Step 5: Replace `isSlotSatisfied` + `isGroupSatisfied`**

Delete `isSlotSatisfied` (lines ~453–461) and replace `isGroupSatisfied` (lines ~464–468) with:

```ts
  // A group is assignable iff it has substances, every slot has ≥1 configured
  // method that resolves to a known + active registry method, AND every distinct
  // machine-backed method type has a selected machine. Bench methods need no
  // selection; empty/unknown/inactive method codes keep Assign blocked.
  function isGroupSatisfied(petition: Petition, group: SubstanceGroup): boolean {
    if (group.slots.length === 0) return false;
    const allSlotsConfigured = group.slots.every((slot) => {
      if (slot.methods.length === 0) return false;
      return slot.methods.every((code) => {
        const method = methodByCode.get(code);
        return !!method && method.active !== false;
      });
    });
    if (!allSlotsConfigured) return false;
    const sel = getSelectedSlotMachines(petition, group);
    return groupMachineMethods(group.slots, methodByCode).every((gm) => !!sel[gm.code]);
  }
```

- [ ] **Step 6: Update the `AssignTable` call sites**

In both `<AssignTable ... />` usages (normal tab ~line 675 and phase2 tab ~line 715), change:

```tsx
                onSelectMachine={setMachineForSlot}
```

to:

```tsx
                onSelectMachine={setMachineForMethod}
```

- [ ] **Step 7: Update `AssignTableProps.onSelectMachine` signature**

In `interface AssignTableProps` (lines ~905–911), replace:

```ts
  onSelectMachine: (
    petitionId: string,
    groupKey: string,
    slotIndex: number,
    methodCode: string,
    machineKey: string,
  ) => void;
```

with:

```ts
  onSelectMachine: (
    petitionId: string,
    groupKey: string,
    methodCode: string,
    machineKey: string,
  ) => void;
```

- [ ] **Step 8: Rewrite the machine cell rendering**

Replace the inner group `.map(...)` body in the "เครื่อง" `TableCell` — from `const slotMachines = getSelectedSlotMachines(...)` down through the closing of that group's `<div>` (lines ~1147–1253) — with the consolidated version below. It renders one `SingleMachinePicker` per distinct machine type, then preserves per-substance non-machine signals (not-set / bench / unknown):

```tsx
                      {petitionGroups.map((group) => {
                        const slotMachines = getSelectedSlotMachines(petition, group);
                        const machineMethods = groupMachineMethods(group.slots, methodByCode);
                        // per-substance non-machine signals (machine-backed methods
                        // are rendered once, consolidated, as pickers above)
                        const notSet: string[] = [];
                        const benchNotes: { key: string; label: string; substance: string }[] = [];
                        const unknownCodes: { key: string; code: string }[] = [];
                        group.slots.forEach((slot, sIdx) => {
                          if (slot.methods.length === 0) {
                            notSet.push(slot.name || `เครื่องที่ ${sIdx + 1}`);
                            return;
                          }
                          slot.methods.forEach((code) => {
                            const method = methodByCode.get(code);
                            if (!method) {
                              unknownCodes.push({ key: `${sIdx}-${code}`, code });
                            } else if (!method.requiresMachine) {
                              benchNotes.push({ key: `${sIdx}-${code}`, label: method.label, substance: slot.name });
                            }
                          });
                        });
                        return (
                          <div
                            key={group.groupKey}
                            className="flex min-h-[60px] flex-col justify-center py-1.5 first:pt-0 last:pb-0"
                          >
                            {(machineSuggestions[group.groupKey] ?? []).length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mb-1">
                                <span className="text-[11px] text-grey-400">AI แนะนำ:</span>
                                {machineSuggestions[group.groupKey].map((s) => (
                                  <span
                                    key={s.machineCode}
                                    className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 border border-blue-200"
                                    title={`ใช้ ${s.usageCount} ครั้งใน 10 batches ล่าสุด`}
                                  >
                                    {s.machineCode} ({s.usageCount}/10)
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {machineMethods.map((gm) => {
                                const filteredMachines = machines.filter((m) =>
                                  machineMatchesMethod(m.name, gm.method, registryMethods),
                                );
                                return (
                                  <div key={gm.code}>
                                    <SingleMachinePicker
                                      slotLabel={
                                        gm.substanceNames.length > 1
                                          ? `ใช้ร่วม ${gm.substanceNames.length} สาร`
                                          : ''
                                      }
                                      substanceName={gm.substanceNames.join(', ')}
                                      methodLabel={gm.method.label}
                                      readOnly={locked}
                                      machines={filteredMachines}
                                      selectedId={slotMachines[gm.code] || null}
                                      onSelect={(machineKey: string) =>
                                        onSelectMachine(petition._id, group.groupKey, gm.code, machineKey)
                                      }
                                    />
                                    {filteredMachines.length === 0 && (
                                      <div className="mt-0.5 text-[11px] text-red-500">
                                        ไม่พบเครื่องสำหรับ {gm.method.label}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {notSet.length > 0 && (
                                <div className="w-[170px] shrink-0 rounded-md border border-amber-200 bg-amber-50/50 px-2 py-1.5 text-[10px] text-amber-700">
                                  <div className="font-medium truncate" title={notSet.join(', ')}>
                                    {notSet.join(', ')}
                                  </div>
                                  ยังไม่ได้ตั้ง method ในซิมเปิลเมธอด
                                </div>
                              )}
                              {benchNotes.map((b) => (
                                <Badge
                                  key={b.key}
                                  variant="gray-soft"
                                  className="shrink-0 px-1.5 py-1 text-[10px] font-medium"
                                  title={b.substance}
                                >
                                  ทำที่โต๊ะ — {b.label}
                                </Badge>
                              ))}
                              {unknownCodes.map((u) => (
                                <Badge
                                  key={u.key}
                                  variant="red-soft"
                                  className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium"
                                >
                                  method ไม่รู้จัก: {u.code}
                                </Badge>
                              ))}
                              {group.slots.length === 0 && (
                                <span className="text-xs text-grey-500">ไม่มีสาร</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
```

- [ ] **Step 9: Type-check — no new errors**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors referencing `PetitionAssignPage.tsx` or `assignMachineGrouping.ts`. In particular, confirm no leftover references to `slotMethodKey`, `machineMethodsOfSlot`, `isSlotSatisfied`, or `setMachineForSlot` (each must report zero matches):

```bash
grep -nE "slotMethodKey|machineMethodsOfSlot|isSlotSatisfied|setMachineForSlot" src/pages/PetitionAssignPage.tsx
```

Expected: no output.

- [ ] **Step 10: Lint the changed files**

Run: `npm run lint`
Expected: no new errors/warnings for `src/pages/PetitionAssignPage.tsx` or `src/lib/assignMachineGrouping.ts`.

- [ ] **Step 11: Run the full unit test suite**

Run: `npm run test`
Expected: all pass (including Task 1's `assignMachineGrouping.test.ts`).

- [ ] **Step 12: Manual E2E (dev server + DevRoleSwitcher)**

Start backend (`cd server && npm run dev`) and frontend (`npm run dev`), open the Assign page, switch to a Lab/assigner role. Verify:
1. A petition whose commonName has **two `+` substances both needing GC** shows **one** GC picker whose sub-line reads "ใช้ร่วม 2 สาร" and whose title lists both substance names.
2. A petition with **A=HPLC, B=GC** shows **two** pickers (HPLC and GC), unchanged.
3. Picking a GC machine on the shared picker satisfies the group; the **Assign** button enables only when the employee is chosen and every distinct type has a machine.
4. Saving posts one machine per type; the success toast lists the machine code(s).
5. Reopen an already-assigned petition and click **แก้ไข**: the previously-saved machine is pre-selected on the correct type picker.
6. A substance with an unset simple-method still shows the amber "ยังไม่ได้ตั้ง method" note and keeps Assign blocked; a bench method still shows "ทำที่โต๊ะ".

- [ ] **Step 13: Commit**

```bash
git add src/pages/PetitionAssignPage.tsx
git commit -m "feat(assign): one machine picker per instrument type within a group" -- src/pages/PetitionAssignPage.tsx
```

---

## Self-Review

**Spec coverage:**
- Consolidate same-type within a commonName group → Task 1 helper + Task 2 Step 8 rendering. ✓
- One machine per type (no split) → Task 2 Steps 3–5 (code-keyed state/baseline/satisfaction). ✓
- Different types → separate pickers → helper returns per-code entries; Step 8 maps them. ✓
- Display: type label + shared substance names → Step 8 (`methodLabel`, `substanceName`, "ใช้ร่วม N สาร"). ✓
- Preserve not-set / bench / unknown per-substance signals → Step 8. ✓
- No server/schema change; backward-compat baseline → Task 2 Step 3. ✓
- Testing (Vitest + manual E2E) → Task 1 Steps 1–4, Task 2 Steps 11–12. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. ✓

**Type consistency:** `groupMachineMethods(slots, methodByCode)` and `GroupMachineMethod.{code,method,substanceNames}` are used identically in Task 1 and Task 2. `onSelectMachine(petitionId, groupKey, methodCode, machineKey)` matches between the prop type (Step 7), the call site (Step 6 → `setMachineForMethod`, Step 4), and the JSX invocation (Step 8). Selection key is `code` everywhere (Steps 3, 4, 5, 8). ✓
