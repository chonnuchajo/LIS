# Phase 2 Retest Non-Trigger Parameters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change 2-phase behavior so the trigger parameter unlocks retesting of all other parameters in the same substance/item, excluding the trigger parameter itself.

**Architecture:** Keep the existing petition phase schema and `valuesPhase2` storage. Add a small frontend helper that decides whether a parameter participates in Phase 2, then use it consistently in QC and Lab result pages for rendering, validation, and abnormal counts.

**Tech Stack:** React, TypeScript, Vitest, Express/Mongoose. No build commands may be run on this machine.

## Global Constraints

- Do not run `npm run build`, `vite build`, `tsc -b`, or equivalent build commands.
- Prefer focused tests and static inspection for validation.
- Preserve existing `currentPhase`, `phase2DueAt`, `phase2TriggeredBy`, and `valuesPhase2` data model.

---

### Task 1: Shared Phase Visibility Helper

**Files:**
- Create: `src/lib/phaseRetest.ts`
- Test: `src/lib/phaseRetest.test.ts`

**Interfaces:**
- Consumes: `ParameterItem`, `ParameterValueField`, `PetitionPhase`
- Produces: `visibleFieldsForPhase(param, phase, triggerParameterId): ParameterValueField[]`

- [ ] **Step 1: Write tests**

```ts
expect(visibleFieldsForPhase(nonPhasedParam, 2, "trigger")).toHaveLength(1);
expect(visibleFieldsForPhase(triggerParam, 2, "trigger")).toHaveLength(0);
expect(visibleFieldsForPhase(phasedParam, 1, "trigger").map((f) => f.label)).toEqual(["ก่อน", "ทั้งคู่"]);
expect(visibleFieldsForPhase(phasedParam, 2, "other").map((f) => f.label)).toEqual(["หลัง", "ทั้งคู่"]);
```

- [ ] **Step 2: Implement helper**

```ts
export function visibleFieldsForPhase(param, phase, triggerParameterId) {
  const fields = param.valueFields ?? [];
  if (phase === 2 && triggerParameterId && String(param._id) === triggerParameterId) return [];
  if (!param.hasPhases) return fields;
  return fields.filter((field) => {
    const fieldPhase = field.phase ?? "both";
    if (fieldPhase === "both") return true;
    return phase === 1 ? fieldPhase === "before" : fieldPhase === "after";
  });
}
```

- [ ] **Step 3: Run focused test**

Run: `npx vitest run src/lib/phaseRetest.test.ts`

### Task 2: Apply Helper In Result Pages

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`
- Modify: `src/pages/LabTestingDetailPage.tsx`

**Interfaces:**
- Consumes: `visibleFieldsForPhase`
- Produces: consistent Phase 2 rendering, validation, and abnormal counting

- [ ] **Step 1: Replace local `visibleFields` logic**

```ts
const visibleFields = (param, phase) =>
  visibleFieldsForPhase(param, phase, petition.phase2TriggeredBy?.parameterId);
```

- [ ] **Step 2: Update abnormal counting**

```ts
count += countAbnormalInValues(visibleFields(param, 1), item, values[k] ?? {});
count += countAbnormalInValues(visibleFields(param, 2), item, valuesPhase2[k] ?? {});
```

- [ ] **Step 3: Run focused tests/type checks that do not build**

Run: `npx vitest run src/lib/phaseRetest.test.ts`

### Task 3: Clarify UI Copy

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`
- Modify: `src/components/lis/ParameterDetailDrawer.tsx`
- Modify: `src/components/lis/PhaseBanner.tsx`

**Interfaces:**
- Consumes: existing `hasPhases` and `triggersPhase2` flags
- Produces: Thai copy that describes retesting other parameters after trigger/timer

- [ ] **Step 1: Update labels and tooltips**

```tsx
<span>Parameter นี้เป็นตัว trigger รอบตรวจซ้ำ</span>
```

- [ ] **Step 2: Static inspect changed copy**

Run: `rg -n "ค่าหลัง|ตัวเริ่ม Phase 2|ตรวจซ้ำ|trigger" src/pages/ParameterSettings.tsx src/components/lis/ParameterDetailDrawer.tsx src/components/lis/PhaseBanner.tsx`
