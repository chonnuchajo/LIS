# Petition Timeline Active Bar Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a moving glow effect to Petition Timeline bars that are still in progress.

**Architecture:** Keep timeline data unchanged. The page already knows whether each row is a milestone or bar and whether a bar is done, so the active visual state belongs in `PetitionTimelineDetailPage.tsx` render classes. Page tests assert the active visual marker is applied only to an unfinished bar.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, React Testing Library.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or equivalent build commands.
- Prefer focused validation with `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`.
- Preserve existing uncommitted changes in `src/pages/PetitionTimelineDetailPage.tsx` and `src/pages/PetitionTimelineDetailPage.test.tsx`.
- Do not change timeline model data for this visual-only request.

---

### Task 1: Active Bar Visual State

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.test.tsx`
- Modify: `src/pages/PetitionTimelineDetailPage.tsx`

**Interfaces:**
- Consumes: `TimelineDetailRow.kind`, `TimelineDetailRow.done`, `TimelineDetailRow.segmentStartAt`, `TimelineDetailRow.segmentEndAt`
- Produces: unfinished bar elements with class `timeline-active-bar`

- [x] **Step 1: Write the failing test**

Add a page test that renders an in-progress petition, finds `QC กำลังวิเคราะห์ (ช่วงเวลา)`, and expects the element to have `timeline-active-bar`, `shadow-[0_0_14px_rgba(59,130,246,0.35)]`, and `after:animate-[timeline-shimmer_1.4s_linear_infinite]`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`

Expected: FAIL because `timeline-active-bar` is not yet applied.

- [x] **Step 3: Implement minimal JSX class changes**

In `PetitionTimelineDetailPage.tsx`, for `row.visible && row.kind === "bar" && start != null && width != null`, add active classes when `!row.done`:

```tsx
!row.done && "timeline-active-bar overflow-hidden shadow-[0_0_14px_rgba(59,130,246,0.35)] after:absolute after:inset-y-0 after:w-1/2 after:rounded-full after:bg-gradient-to-r after:from-transparent after:via-white/70 after:to-transparent after:animate-[timeline-shimmer_1.4s_linear_infinite]"
```

Keep existing `rounded-r-none` and `rounded-l-none` conditions.

- [x] **Step 4: Add keyframes**

Add a local `<style>` near the page markup:

```tsx
<style>{`@keyframes timeline-shimmer{0%{transform:translateX(-120%)}100%{transform:translateX(220%)}}`}</style>
```

- [x] **Step 5: Run focused verification**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`

Expected: PASS.

Actual: `npx.cmd vitest run src/pages/PetitionTimelineDetailPage.test.tsx -t "adds a moving glow marker"` passed. `npx.cmd tsc --noEmit` passed. The full page test file still has unrelated existing failures around timeline stage/color expectations in the current working tree.
