# Design: รวมช่องเลือกเครื่องตามประเภทเครื่องมือ (Petition Assign)

- **Date:** 2026-07-02
- **Branch:** develop
- **Area:** `src/pages/PetitionAssignPage.tsx` (Assign คำร้องให้เจ้าหน้าที่)
- **Status:** Awaiting user review

## Problem

On the Assign page, the "เครื่อง" cell renders **one machine picker per (substance × machine-backed method)**. A `commonName` with two `+`-split substances that both require the same instrument type (e.g. both GC) shows **two** GC pickers, forcing the user to pick a GC machine twice.

Desired behaviour:

- 2 substances, **same** type (A=GC, B=GC) → **one** picker → one machine covers both.
- 2 substances, **different** types (A=HPLC, B=GC) → **two** pickers, as today.

## Decisions (locked)

1. **Scope:** consolidate only within one `commonName` group's `+`-split substances — the exact place two pickers appear today. Machines persist tagged by `(sampleName, commonName)`, so cross-row (different commonName) sharing is out of scope.
2. **One machine per type:** GC+GC → a single GC picker. No escape hatch to split the same type onto two machines.
3. **Display:** picker titled by instrument type (`method.label`, e.g. GC/HPLC), with the substance names that share it listed underneath.

## Current model

- Machine selection is keyed per `(slotIndex, methodCode)` via `slotMethodKey(slotIndex, code) = \`${slotIndex}::${code}\``.
- State: `machinesByPetition[petitionId][groupKey][\`${slotIndex}::${code}\`] = machineId`.
- Rendering iterates `group.slots` (substances) and, within each, its machine-backed method codes — one `SingleMachinePicker` each.
- `assignedMachines[]` (persisted) is tagged only by `(sampleName, commonName)` at the **group** level — never per substance position.

## New model

Selection granularity moves from `(slotIndex, methodCode)` to **`methodCode`** at the group level.

| | Current | New |
|---|---|---|
| Selection key | `${slotIndex}::${code}` (`slotMethodKey`) | `code` (`groupMethodKey`) |
| State shape | `machinesByPetition[pid][groupKey][slotIndex::code]` | `machinesByPetition[pid][groupKey][code]` |
| Pickers per group | one per (substance, machine method) | one per distinct machine method code |

## Components

### New helper — `src/lib/assignMachineGrouping.ts` (pure, unit-tested)

- `groupMachineMethods(slots, methodByCode)` → `Array<{ code: string; method: MethodDoc; substanceNames: string[] }>`
  - Walks `slots` in order; for each machine-backed method code (`methodByCode.get(code)?.requiresMachine`), collect it once, accumulating the names of substances that use it.
  - Preserves first-seen order of codes so the UI is stable.
  - Non-machine (bench) codes, empty-method slots, and unknown codes are **not** returned here — they remain per-substance display concerns.

### `PetitionAssignPage.tsx` edits

- Replace `slotMethodKey(slotIndex, code)` usages with a group-level `groupMethodKey(code) = code`.
- `baselineSlotsForGroup(petition, group)`: iterate distinct machine-method codes (via `groupMachineMethods`); first-fit-match saved `assignedMachines` (filtered to this group) to each code using `machineMatchesMethod`. Result keyed by `code`. Backward compatible with existing data.
- `getSelectedSlotMachines` → returns `Record<code, machineId>` (unchanged signature, new key semantics).
- `setMachineForSlot(petitionId, groupKey, slotIndex, code, machineKey)` → `setMachineForMethod(petitionId, groupKey, code, machineKey)` (drop `slotIndex`). Single-select toggle behaviour unchanged.
- Satisfaction:
  - `isGroupSatisfied(petition, group)`: group has ≥1 substance, no empty/unknown/inactive method on any slot, and **every distinct machine-backed method code has a selected machine** (`sel[code]`).
  - The `hasUnassignableGroup` check (empty method / unknown / inactive) stays per-slot as today.
- Payload (`assignPetition`): for each `(code → machineId)` in the group's selection, push `toAssignedMachine(machine, group)`. One machine per code; existing dedupe by `${groupKey}::${id}` remains.

### Machine cell rendering

Per group, render:

1. **One picker per distinct machine-backed method** (`groupMachineMethods`): `SingleMachinePicker` titled `method.label`, sub-line = joined `substanceNames`, machines filtered by `machineMatchesMethod`. `readOnly` when locked. "ไม่พบเครื่องสำหรับ {label}" when the filtered list is empty.
2. **Per-substance non-machine signals preserved** (so Assign-blocking states stay visible):
   - Empty-method slot → amber "ยังไม่ได้ตั้ง method ในซิมเปิลเมธอด" (lists affected substance).
   - Bench method (`requiresMachine === false`) → gray "ทำที่โต๊ะ — {label}" badge.
   - Unknown code → red "method ไม่รู้จัก: {code}".

The "ชื่อสาร" column (per-substance method badges) is unchanged.

## Edge cases

- Substance A needs GC + HPLC (two machine-backed methods) and substance B needs GC → distinct codes `{GC, HPLC}` → GC picker shared by A+B, HPLC picker for A only.
- Backward-compat: a petition assigned before this change that stored two **different** GC machines in one group → baseline binds the first GC machine to the GC code; next save consolidates to one. Read-only view shows one. Rare, acceptable.
- Bench-only / all-not-set groups → no pickers, existing warnings, Assign stays blocked as today.

## Out of scope

- Cross-commonName machine sharing (different rows).
- Any server / schema / persistence-shape change.

## Testing

- **Vitest** `src/lib/assignMachineGrouping.test.ts`:
  - GC+GC → one entry `{GC, substanceNames:[A,B]}`.
  - HPLC+GC → two entries.
  - (GC+HPLC) & GC → `{GC:[A,B], HPLC:[A]}`.
  - Bench/unknown/empty codes excluded from machine-method entries.
  - First-seen order preserved.
- **Manual E2E** via DevRoleSwitcher: 2-substance same-type petition shows one picker; different-type shows two; Assign gating + save payload correct; reload of a previously-assigned petition rebinds correctly.
