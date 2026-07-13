# Assign: Hide Non-Lab Status Bubble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the status bubble on Assign cards for petitions that do not have a Lab track, without changing statuses anywhere else.

**Architecture:** Promote the existing Lab-track predicate in the shared status helper so it remains the single definition of a Lab petition. The Assign card consumes that predicate to decide whether to render its existing status badge; the badge's label and style logic stay unchanged.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tailwind UI components.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or any script that triggers the build workflow.
- Preserve the current status badge content and colour for petitions with a Lab track.
- A Lab track is present when `labReceivedAt`, `labCompletedAt`, `labApprovedAt`, or an item `batchNo` ending in `1` or `6` is present.
- Do not alter status badge rendering on pages other than Assign.

---

### Task 1: Reuse the Lab-track predicate to control Assign badge visibility

**Files:**
- Modify: `src/lib/statusBadge.ts:57-65`
- Modify: `src/lib/statusBadge.test.ts:1, 88-111`
- Modify: `src/pages/PetitionAssignPage.tsx:40, 1004-1040`

**Interfaces:**
- Consumes: `Petition` from `@/types/petition.types`.
- Produces: `hasLabTrack(petition: Petition): boolean` from `@/lib/statusBadge`.
- Consumed by: `PetitionCard` in `PetitionAssignPage.tsx` to decide whether it renders the existing `Badge`.

- [ ] **Step 1: Write the failing tests for the exported Lab-track predicate**

In `src/lib/statusBadge.test.ts`, add `hasLabTrack` to the existing import and add these cases before the `petitionStatusSteps` suite:

```ts
describe("hasLabTrack", () => {
  it("returns false for a QC-only petition", () => {
    expect(
      hasLabTrack({
        status: "inProgress",
        items: [{ seq: 1, sampleName: "S", batchNo: "B-2" }],
      } as Petition),
    ).toBe(false);
  });

  it("returns true for a petition with a Lab batch", () => {
    expect(
      hasLabTrack({
        status: "inProgress",
        items: [{ seq: 1, sampleName: "S", batchNo: "B-1" }],
      } as Petition),
    ).toBe(true);
  });

  it("keeps legacy petitions with a Lab timestamp on the Lab track", () => {
    expect(
      hasLabTrack({ status: "inProgress", labReceivedAt: "2026-07-13T00:00:00.000Z" } as Petition),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/lib/statusBadge.test.ts`

Expected: FAIL because `hasLabTrack` is not exported from `./statusBadge`.

- [ ] **Step 3: Export the existing predicate and apply it to the Assign card**

In `src/lib/statusBadge.ts`, change the existing private helper signature only:

```ts
export function hasLabTrack(petition: Petition): boolean {
  return Boolean(
    petition.labReceivedAt ||
      petition.labCompletedAt ||
      petition.labApprovedAt ||
      petition.items?.some((item) => /[16]$/.test(String(item.batchNo ?? "").trim())),
  );
}
```

In `src/pages/PetitionAssignPage.tsx`, import it beside `petitionStatusBadge`, derive the boolean in `PetitionCard`, and conditionally render the existing badge:

```tsx
import { hasLabTrack, petitionStatusBadge } from "@/lib/statusBadge";

function PetitionCard(/* existing props */) {
  const statusCfg = petitionStatusBadge(petition);
  const showStatusBadge = hasLabTrack(petition);
  // existing card setup

  return (
    // existing card markup
    <div className="flex items-center gap-2">
      {/* existing petition-number button */}
      {showStatusBadge && (
        <Badge variant={statusCfg.variant} className="ml-auto shrink-0">
          {statusCfg.label}
        </Badge>
      )}
    </div>
  );
}
```

Do not change `petitionStatusBadge`, existing status labels, or the card layout beyond omitting the badge.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx vitest run src/lib/statusBadge.test.ts`

Expected: PASS, including all three `hasLabTrack` cases.

- [ ] **Step 5: Run type checking and inspect the diff**

Run: `npx tsc --noEmit`

Expected: exit code 0 with no TypeScript diagnostics.

Run: `git diff --check -- src/lib/statusBadge.ts src/lib/statusBadge.test.ts src/pages/PetitionAssignPage.tsx`

Expected: no whitespace errors. Confirm the diff only exports the predicate, adds its tests, and conditionally renders the Assign status badge.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/lib/statusBadge.ts src/lib/statusBadge.test.ts src/pages/PetitionAssignPage.tsx
git commit -m "fix: hide non-Lab status in Assign"
```
