# Project Timeline 17:00 Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make petition detail Project Timeline default to 17:00, expand after 17:00 only when data requires it, and show per-day tabs for multi-day timelines.

**Architecture:** Keep date/window logic in `src/lib/petitionTimelineDetail.ts` so it can be unit tested outside React. Extend the existing timeline model with day slices, then render those slices in `src/pages/PetitionTimelineDetailPage.tsx` with local tab state.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing shadcn-style UI components.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or equivalent build commands.
- Keep existing task, activity, document, header, and permission behavior unchanged.
- Use 17:00 as the default same-day end time.
- Preserve after-hours timestamps by expanding the affected timeline day.

---

## File Structure

- Modify `src/lib/petitionTimelineDetail.ts`: timeline end-time policy, day-slice type, day-slice builder, tick generation.
- Modify `src/lib/petitionTimelineDetail.test.ts`: model tests for 17:00 default, after-hours expansion, and multi-day slices.
- Modify `src/pages/PetitionTimelineDetailPage.tsx`: render active day slice and tabs when multiple days exist.
- Modify `src/pages/PetitionTimelineDetailPage.test.tsx`: UI test for multi-day tabs.

### Task 1: Timeline Model Day Windows

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts`
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: `buildTimelineDetailModel(input: TimelineDetailInput, now?: Date): TimelineDetailModel`
- Produces: `TimelineDetailModel.timeline.days: TimelineDetailDay[]`
- Produces type: `TimelineDetailDay = { key: string; label: string; startAt: string; endAt: string; ticks: TimelineDetailTick[]; stages: TimelineDetailStage[] }`

- [ ] **Step 1: Write failing model tests**

Add tests to `src/lib/petitionTimelineDetail.test.ts`:

```ts
it("defaults same-day open timeline estimates to 17:00", () => {
  const result = model(petition({ qcReceivedAt: at(13, 10, 15) }), [], [], [], new Date(2026, 6, 13, 12));

  expect(result.header.endAt).toBe(at(13, 17));
  expect(result.timeline.endAt).toBe(at(13, 17));
  expect(result.timeline.ticks.map((tick) => tick.label)).toContain("17:00");
  expect(result.timeline.ticks.map((tick) => tick.label)).not.toContain("20:00");
});

it("expands a same-day completed timeline after 17:00 when actual data is later", () => {
  const result = model(petition({
    status: "approved",
    qcReceivedAt: at(13, 10),
    approvedAt: at(13, 18, 30),
  }));

  expect(result.header.endAt).toBe(at(13, 18, 30));
  expect(result.timeline.endAt).toBe(at(13, 18, 30));
  expect(result.timeline.ticks.at(-1)).toMatchObject({ at: at(13, 18, 30), label: "18:30" });
});

it("splits multi-day timelines into local day windows", () => {
  const result = model(petition({
    qcReceivedAt: at(12, 10),
    firstResultAt: at(13, 9),
  }), [], [], [], new Date(2026, 6, 13, 12));

  expect(result.timeline.days.map((day) => day.label)).toEqual(["12 ก.ค.", "13 ก.ค."]);
  expect(result.timeline.days[0]).toMatchObject({ startAt: at(12, 8), endAt: at(12, 17) });
  expect(result.timeline.days[1]).toMatchObject({ startAt: at(13, 8), endAt: at(13, 17) });
  expect(result.timeline.days[0].stages.map((stage) => stage.key)).toContain("received");
  expect(result.timeline.days[1].stages.map((stage) => stage.key)).toContain("results");
});
```

- [ ] **Step 2: Verify model tests fail**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`

Expected: FAIL because same-day open work still ends at 20:00 and `timeline.days` does not exist.

- [ ] **Step 3: Implement model changes**

In `src/lib/petitionTimelineDetail.ts`:

```ts
const WORK_END_HOUR = 17;
```

Add `TimelineDetailDay`, add helpers that build day windows from the overall start/end, make `buildTicks` include the exact end when it is not on an hour boundary, and return `timeline.days` from `buildTimelineDetailModel`.

- [ ] **Step 4: Verify model tests pass**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`

Expected: PASS.

### Task 2: Project Timeline Day Tabs

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx`
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx`

**Interfaces:**
- Consumes: `model.timeline.days`
- Produces: visible day tab buttons only when `model.timeline.days.length > 1`

- [ ] **Step 1: Write failing page test**

Add test to `src/pages/PetitionTimelineDetailPage.test.tsx`:

```tsx
it("shows day tabs for project timelines that span multiple days", async () => {
  Object.assign(mocks.petition, {
    qcReceivedAt: "2026-07-12T03:00:00.000Z",
    firstResultAt: "2026-07-13T02:00:00.000Z",
  });
  renderDetail();

  expect(await screen.findByRole("tab", { name: "12 ก.ค." })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "13 ก.ค." }));
  expect(screen.getByRole("tab", { name: "13 ก.ค." })).toHaveAttribute("aria-selected", "true");
});
```

- [ ] **Step 2: Verify page test fails**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`

Expected: FAIL because Project Timeline does not render day tabs.

- [ ] **Step 3: Implement page tabs**

In `src/pages/PetitionTimelineDetailPage.tsx`, add active-day state, reset it when the petition changes, choose `activeTimelineDay`, and render tab buttons above the timeline only when multiple days exist. Use `activeTimelineDay.startAt`, `activeTimelineDay.endAt`, `activeTimelineDay.ticks`, and `activeTimelineDay.stages` for percent calculations.

- [ ] **Step 4: Verify page tests pass**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`

Expected: PASS.

### Task 3: Focused Validation

**Files:**
- Validate: `src/lib/petitionTimelineDetail.ts`
- Validate: `src/pages/PetitionTimelineDetailPage.tsx`

- [ ] **Step 1: Run focused tests**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts src/pages/PetitionTimelineDetailPage.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: PASS.
