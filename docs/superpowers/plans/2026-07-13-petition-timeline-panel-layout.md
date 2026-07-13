# Petition Timeline Panel Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Tasks and Recent Activity into independent layout columns and place Documents below Recent Activity.

**Architecture:** Keep the existing four cards and their state in `PetitionTimelineDetailPage`. Replace the current grid where Documents is a third sibling with a two-column grid: the main column contains Timeline then Tasks, and the side column contains Recent Activity then Documents. Responsive layout continues to stack cards below the `xl` breakpoint.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Change presentation only; task, activity, document, and print behavior must remain unchanged.
- Desktop layout uses `xl:grid-cols-[minmax(0,1fr)_320px]`; mobile stacks Timeline, Tasks, Recent Activity, Documents.
- Do not run a production build. Validate with focused Vitest and `npx tsc --noEmit`.

---

### Task 1: Restructure Timeline Detail Panels

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx`
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx`

**Interfaces:**
- Consumes: existing `model.tasks`, `activities`, `activityLoading`, `activityError`, document print state, and document eligibility predicates.
- Produces: unchanged interaction behavior with the specified desktop and mobile panel order.

- [x] **Step 1: Write the failing layout regression test**

Add a test that waits for the page heading, then asserts all four panel headings are rendered:

```tsx
expect(screen.getByText("Project Timeline")).toBeInTheDocument();
expect(screen.getByText("Tasks")).toBeInTheDocument();
expect(screen.getByText("Recent Activity")).toBeInTheDocument();
expect(screen.getByText("Documents")).toBeInTheDocument();
```

- [x] **Step 2: Run the focused test**

Run: `npx.cmd vitest run src/pages/PetitionTimelineDetailPage.test.tsx`

Expected: The added assertion fails until the page assigns stable panel landmarks for the new structure.

- [x] **Step 3: Apply the layout structure**

Keep the existing outer grid and use the following card grouping:

```tsx
<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
  <div className="space-y-4">
    <Card aria-label="Project Timeline">...</Card>
    <Card aria-label="Tasks">...</Card>
  </div>
  <div className="space-y-4">
    <Card aria-label="Recent Activity">...</Card>
    <Card aria-label="Documents">...</Card>
  </div>
</div>
```

Move only the existing Documents card into the side-column wrapper. Do not alter its buttons, loading states, errors, or print dialogs.

- [x] **Step 4: Run focused regression tests**

Run: `npx.cmd vitest run src/pages/PetitionTimelineDetailPage.test.tsx`

Expected: PASS with all panel and document interaction tests green.

- [x] **Step 5: Run TypeScript validation**

Run: `npx.cmd tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 6: Commit** (not attempted: this shared checkout has unrelated dirty files and commits were not requested)

```powershell
git add src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx docs/superpowers/specs/2026-07-13-petition-timeline-panel-layout-design.md docs/superpowers/plans/2026-07-13-petition-timeline-panel-layout.md
git commit -m "refactor: separate petition timeline panels"
```
