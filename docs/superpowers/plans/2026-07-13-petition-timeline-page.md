# Petition Timeline Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protected `Timeline คำร้อง` nav page that shows a Gantt-style timeline for each petition visible to the signed-in user.

**Architecture:** Keep the feature frontend-led. Extract petition visibility and timeline derivation into pure helpers with focused tests, then build a route-level React page that renders filters, summary metrics, timeline rows, and recent milestone context from `usePetitionList` data. Add the route to nav and access-control defaults, including an orphan-only existing-database backfill for `/petition-timeline`.

**Tech Stack:** React 18, Vite, TypeScript, React Router, Tailwind, shadcn/ui components, lucide-react, Vitest.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or any equivalent production/dev build command.
- For validation, prefer `npx tsc --noEmit`, `npm run test`, `npm run lint`, and focused test commands.
- Use existing petition data and avoid backend aggregation endpoints.
- Do not fabricate missing petition milestone dates.
- New route: `/petition-timeline`.
- New nav label: `Timeline คำร้อง`.
- Clicking a petition row opens `/petitions/:id`.

---

## File Structure

- Create `src/lib/petitionVisibility.ts`: shared role and petition visibility helpers moved out of `PetitionListPage`.
- Modify `src/pages/PetitionListPage.tsx`: import shared visibility helpers and preserve `canUserCreatePetition` as an exported compatibility wrapper.
- Create `src/lib/petitionTimeline.ts`: pure date, milestone, segment, scale, and summary helpers for the Gantt page.
- Create `src/lib/petitionTimeline.test.ts`: unit tests for timeline derivation and scale behavior.
- Create `src/pages/PetitionTimelinePage.tsx`: route-level page using existing app shell and UI components.
- Modify `src/App.tsx`: lazy-load and register `/petition-timeline`.
- Modify `src/lib/navItems.ts`: add the nav item and page item.
- Modify `src/lib/navItems.test.ts`: assert the new nav path exists.
- Modify `server/routes/accessControl.js`: add the path to default access groups and backfill existing groups that already own `/petitions`.
- Modify `server/lib/accessGroups.js`: expose a small reusable orphan helper that supports targeted backfills.
- Modify `server/lib/accessGroups.test.js`: cover the targeted orphan helper.

---

### Task 1: Extract Petition Visibility Helpers

**Files:**
- Create: `src/lib/petitionVisibility.ts`
- Modify: `src/pages/PetitionListPage.tsx`
- Existing tests to run: `src/pages/PetitionListPage.test.ts`, `src/pages/PetitionListPage.actions.test.tsx`

**Interfaces:**
- Consumes: `Petition`, `ParameterItem`, `matchParametersForItem`, `normalizeRoles`, `isAssignedTo`.
- Produces:
  - `isLabRole(role: string): boolean`
  - `isQcRole(role: string): boolean`
  - `isLabBatchNo(batchNo?: string | null): boolean`
  - `petitionHasLabItems(petition: Petition): boolean`
  - `petitionHasLabReadableItem(petition: Petition, labParams: ParameterItem[], membership?: Map<string, string[]>): boolean`
  - `canSeePetition(petition: Petition, user: PetitionVisibilityUser | null): boolean`
  - `canUserCreatePetition(user: { role?: string; roles?: string[] } | null | undefined, canAccessNewPetition: boolean): boolean`

- [ ] **Step 1: Create the shared helper**

Add `src/lib/petitionVisibility.ts`:

```ts
import type { ParameterItem } from "@/lib/api";
import { isAssignedTo } from "@/lib/assignment";
import { matchParametersForItem } from "@/lib/petitionTestItems";
import { normalizeRoles } from "@/lib/roles";
import type { Petition } from "@/types/petition.types";

const norm = (value?: string | null) => (value ?? "").trim().toLowerCase();

const RECEIVED_STATUSES = new Set<Petition["status"]>([
  "sampleSent",
  "pendingReview",
  "inProgress",
  "success",
]);

const LAB_BATCH_LAST_DIGITS = new Set(["1", "6"]);

export type PetitionVisibilityUser = {
  email?: string;
  name?: string;
  employeeId?: string;
  role?: string;
  roles?: string[];
};

export const isLabBatchNo = (batchNo?: string | null) => {
  const trimmed = String(batchNo ?? "").trim();
  return trimmed.length > 0 && LAB_BATCH_LAST_DIGITS.has(trimmed.slice(-1));
};

export const petitionHasLabItems = (petition: Petition) =>
  petition.items.some((item) => isLabBatchNo(item.batchNo));

export const petitionHasLabReadableItem = (
  petition: Petition,
  labParams: ParameterItem[],
  membership?: Map<string, string[]>,
) =>
  petition.items.some(
    (item) =>
      isLabBatchNo(item.batchNo) &&
      matchParametersForItem(
        item,
        labParams,
        membership?.get(String(item.sampleId ?? "").trim()) ?? [],
      ).length > 0,
  );

export function isOwnSubmission(
  petition: Petition,
  user: Pick<PetitionVisibilityUser, "employeeId" | "name" | "email"> | null,
): boolean {
  if (!user) return false;
  const userName = norm(user.name);
  const submitterName = norm(petition.submittedBy?.name);
  return !!(userName && submitterName && userName === submitterName);
}

export function isLabRole(role: string): boolean {
  return role === "lab" || role.startsWith("lab-") || role.startsWith("lab_");
}

export function isQcRole(role: string): boolean {
  return role === "qc" || role.startsWith("qc-") || role.startsWith("qc_");
}

export function canSeePetition(
  petition: Petition,
  user: PetitionVisibilityUser | null,
): boolean {
  if (!user) return false;
  const roles = normalizeRoles(user);
  if (isOwnSubmission(petition, user)) return true;
  if (isAssignedTo(petition.assignedTo, user)) return true;
  if (RECEIVED_STATUSES.has(petition.status)) {
    if (roles.some(isLabRole) && petitionHasLabItems(petition)) return true;
    if (roles.some(isQcRole)) return true;
  }
  return false;
}

export function canUserCreatePetition(
  user: { role?: string; roles?: string[] } | null | undefined,
  canAccessNewPetition: boolean,
): boolean {
  if (!canAccessNewPetition) return false;
  const roles = normalizeRoles(user).map((role) => role.toLowerCase());
  return roles.length > 0 && roles.some((role) => role !== "viewer");
}
```

- [ ] **Step 2: Replace local visibility code in `PetitionListPage`**

In `src/pages/PetitionListPage.tsx`, remove local definitions for `norm`, `RECEIVED_STATUSES`, `LAB_BATCH_LAST_DIGITS`, `isLabBatchNo`, `petitionHasLabItems`, `petitionHasLabReadableItem`, `isOwnSubmission`, `isLabRole`, `isQcRole`, `canSeePetition`, and the local `canUserCreatePetition` body. Add this import:

```ts
import {
  canSeePetition,
  canUserCreatePetition as canUserCreatePetitionShared,
  isLabRole,
  isLabBatchNo,
  petitionHasLabReadableItem,
} from "@/lib/petitionVisibility";
```

Keep the existing public export used by tests:

```ts
export function canUserCreatePetition(
  user: { role?: string; roles?: string[] } | null | undefined,
  canAccessNewPetition: boolean,
): boolean {
  return canUserCreatePetitionShared(user, canAccessNewPetition);
}
```

- [ ] **Step 3: Run focused tests for the refactor**

Run:

```powershell
npx vitest run src/pages/PetitionListPage.test.ts src/pages/PetitionListPage.actions.test.tsx
```

Expected: existing petition list tests pass. If a test imports `canUserCreatePetition` from `PetitionListPage`, it continues to resolve through the wrapper.

- [ ] **Step 4: Commit Task 1**

```powershell
git add src/lib/petitionVisibility.ts src/pages/PetitionListPage.tsx
git commit -m "refactor: share petition visibility rules"
```

---

### Task 2: Build Pure Timeline Derivation

**Files:**
- Create: `src/lib/petitionTimeline.ts`
- Create: `src/lib/petitionTimeline.test.ts`

**Interfaces:**
- Consumes: `Petition` and `isLabBatchNo` from `src/lib/petitionVisibility.ts`.
- Produces:
  - `buildPetitionTimelineRow(petition: Petition, now?: Date): PetitionTimelineRow`
  - `buildTimelineWindow(rows: PetitionTimelineRow[], now?: Date): TimelineWindow`
  - `buildTimelineTicks(window: TimelineWindow): TimelineTick[]`
  - `timelinePercent(at: string | null | undefined, window: TimelineWindow): number | null`
  - `buildTimelineSummary(rows: PetitionTimelineRow[], now?: Date): PetitionTimelineSummary`

- [ ] **Step 1: Write failing tests**

Create `src/lib/petitionTimeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildPetitionTimelineRow,
  buildTimelineSummary,
  buildTimelineTicks,
  buildTimelineWindow,
  timelinePercent,
} from "./petitionTimeline";
import type { Petition } from "@/types/petition.types";

function petition(overrides: Partial<Petition> = {}): Petition {
  return {
    _id: "p1",
    petitionNo: "P-2607-0001",
    dept: "production",
    status: "inProgress",
    submittedBy: {
      name: "Requester",
      department: "Production",
      submittedAt: "2026-07-01T01:00:00.000Z",
    },
    items: [{ seq: 1, sampleName: "Sample A", batchNo: "B-001" }],
    createdAt: "2026-07-01T01:00:00.000Z",
    updatedAt: "2026-07-03T04:00:00.000Z",
    ...overrides,
  } as Petition;
}

describe("buildPetitionTimelineRow", () => {
  it("builds ordered milestones and active segments from petition timestamps", () => {
    const row = buildPetitionTimelineRow(
      petition({
        sampleSentAt: "2026-07-01T02:00:00.000Z",
        qcReceivedAt: "2026-07-01T03:00:00.000Z",
        assignedTo: {
          employeeId: "E1",
          name: "Analyst",
          assignedAt: "2026-07-01T04:00:00.000Z",
        },
        firstResultAt: "2026-07-01T05:00:00.000Z",
        qcCompletedAt: "2026-07-01T06:00:00.000Z",
      }),
      new Date("2026-07-02T00:00:00.000Z"),
    );

    expect(row.startAt).toBe("2026-07-01T01:00:00.000Z");
    expect(row.lastAt).toBe("2026-07-01T06:00:00.000Z");
    expect(row.milestones.map((item) => item.key)).toEqual([
      "submitted",
      "sample-sent",
      "qc-received",
      "assigned",
      "first-result",
      "qc-completed",
    ]);
    expect(row.segments.map((item) => item.key)).toEqual([
      "intake",
      "receive-assign",
      "testing",
      "final",
    ]);
  });

  it("includes lab milestones only when the petition has a lab track", () => {
    const row = buildPetitionTimelineRow(
      petition({
        items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "LAB-016" }],
        labReceivedAt: "2026-07-01T03:30:00.000Z",
        labCompletedAt: "2026-07-02T03:30:00.000Z",
        labApprovedAt: "2026-07-02T07:30:00.000Z",
      }),
      new Date("2026-07-03T00:00:00.000Z"),
    );

    expect(row.hasLabTrack).toBe(true);
    expect(row.milestones.map((item) => item.key)).toContain("lab-received");
    expect(row.milestones.map((item) => item.key)).toContain("lab-approved");
    expect(row.segments.map((item) => item.key)).toContain("lab-approval");
  });

  it("keeps rows with only a submitted date readable", () => {
    const row = buildPetitionTimelineRow(
      petition({ status: "deliveringQC", updatedAt: "2026-07-01T01:30:00.000Z" }),
      new Date("2026-07-01T12:00:00.000Z"),
    );

    expect(row.startAt).toBe("2026-07-01T01:00:00.000Z");
    expect(row.segments.length).toBeGreaterThanOrEqual(1);
    expect(row.milestones[0]).toMatchObject({ key: "submitted", done: true });
  });

  it("marks final result rows as closed", () => {
    const row = buildPetitionTimelineRow(
      petition({
        status: "approved",
        completedAt: "2026-07-02T01:00:00.000Z",
        approvedAt: "2026-07-02T04:00:00.000Z",
      }),
      new Date("2026-07-03T00:00:00.000Z"),
    );

    expect(row.isClosed).toBe(true);
    expect(row.milestones.at(-1)).toMatchObject({ key: "final-result", done: true });
  });
});

describe("timeline scale helpers", () => {
  it("pads a single-date window so percentages are usable", () => {
    const row = buildPetitionTimelineRow(petition(), new Date("2026-07-01T12:00:00.000Z"));
    const window = buildTimelineWindow([row], new Date("2026-07-01T12:00:00.000Z"));

    expect(new Date(window.endAt).getTime()).toBeGreaterThan(new Date(window.startAt).getTime());
    expect(timelinePercent(row.startAt, window)).not.toBeNull();
  });

  it("creates readable ticks for the computed window", () => {
    const row = buildPetitionTimelineRow(
      petition({ approvedAt: "2026-07-10T00:00:00.000Z", status: "approved" }),
      new Date("2026-07-10T12:00:00.000Z"),
    );
    const ticks = buildTimelineTicks(buildTimelineWindow([row], new Date("2026-07-10T12:00:00.000Z")));

    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.some((tick) => tick.major)).toBe(true);
  });

  it("summarizes visible petition rows", () => {
    const rows = [
      buildPetitionTimelineRow(petition({ status: "inProgress" }), new Date("2026-07-04T00:00:00.000Z")),
      buildPetitionTimelineRow(petition({ _id: "p2", status: "approved", approvedAt: "2026-07-02T00:00:00.000Z" }), new Date("2026-07-04T00:00:00.000Z")),
    ];

    expect(buildTimelineSummary(rows, new Date("2026-07-04T00:00:00.000Z"))).toMatchObject({
      total: 2,
      inProgress: 1,
      closed: 1,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npx vitest run src/lib/petitionTimeline.test.ts
```

Expected: FAIL because `src/lib/petitionTimeline.ts` does not exist.

- [ ] **Step 3: Implement the timeline helper**

Create `src/lib/petitionTimeline.ts`:

```ts
import { isLabBatchNo } from "@/lib/petitionVisibility";
import type { Petition } from "@/types/petition.types";

export type TimelineTone =
  | "intake"
  | "receive"
  | "testing"
  | "lab"
  | "final"
  | "closed"
  | "blocked";

export type PetitionTimelineMilestone = {
  key: string;
  label: string;
  at: string | null;
  done: boolean;
  tone: TimelineTone;
};

export type PetitionTimelineSegment = {
  key: string;
  label: string;
  startAt: string;
  endAt: string;
  tone: TimelineTone;
  current?: boolean;
};

export type PetitionTimelineRow = {
  petition: Petition;
  startAt: string;
  endAt: string;
  lastAt: string;
  hasLabTrack: boolean;
  isClosed: boolean;
  isIdle: boolean;
  milestones: PetitionTimelineMilestone[];
  segments: PetitionTimelineSegment[];
};

export type TimelineWindow = {
  startAt: string;
  endAt: string;
  todayAt: string | null;
};

export type TimelineTick = {
  key: string;
  at: string;
  label: string;
  major: boolean;
};

export type PetitionTimelineSummary = {
  total: number;
  inProgress: number;
  closed: number;
  waiting: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = new Set<Petition["status"]>(["approved", "rejected"]);

function validDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(value: Date): string {
  return value.toISOString();
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function maxDate(...values: Array<string | null | undefined>): string | null {
  const dates = values.map(validDate).filter((date): date is Date => !!date);
  if (dates.length === 0) return null;
  return iso(new Date(Math.max(...dates.map((date) => date.getTime()))));
}

function firstDate(...values: Array<string | null | undefined>): string | null {
  const dates = values.map(validDate).filter((date): date is Date => !!date);
  if (dates.length === 0) return null;
  return iso(new Date(Math.min(...dates.map((date) => date.getTime()))));
}

function submittedAt(petition: Petition): string {
  return (
    firstDate(petition.submittedBy?.submittedAt, petition.createdAt) ??
    iso(new Date(0))
  );
}

function hasLabTrack(petition: Petition): boolean {
  return Boolean(
    petition.labReceivedAt ||
      petition.labCompletedAt ||
      petition.labApprovedAt ||
      petition.items.some((item) => isLabBatchNo(item.batchNo)),
  );
}

function compactMilestones(items: PetitionTimelineMilestone[]): PetitionTimelineMilestone[] {
  return items
    .filter((item) => item.done || item.key === "submitted")
    .sort((a, b) => {
      const aTime = validDate(a.at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = validDate(b.at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
}

function segment(
  key: string,
  label: string,
  startAt: string | null,
  endAt: string | null,
  tone: TimelineTone,
  current = false,
): PetitionTimelineSegment | null {
  const start = validDate(startAt);
  const end = validDate(endAt);
  if (!start || !end) return null;
  if (end.getTime() < start.getTime()) return null;
  return { key, label, startAt: iso(start), endAt: iso(end), tone, current };
}

export function buildPetitionTimelineRow(
  petition: Petition,
  now: Date = new Date(),
): PetitionTimelineRow {
  const hasLab = hasLabTrack(petition);
  const startAt = submittedAt(petition);
  const firstReceivedAt = firstDate(petition.qcReceivedAt, petition.labReceivedAt, petition.receivedAt);
  const assignedAt = petition.assignedTo?.assignedAt ?? null;
  const testingStartAt = firstDate(assignedAt, firstReceivedAt, petition.sampleSentAt, startAt);
  const testingEndAt = maxDate(
    petition.qcCompletedAt,
    petition.labCompletedAt,
    petition.labApprovedAt,
    petition.completedAt,
    petition.approvedAt,
    petition.rejectedAt,
  );
  const finalAt = maxDate(petition.approvedAt, petition.rejectedAt);
  const isClosed = CLOSED_STATUSES.has(petition.status);
  const activeEnd = isClosed ? finalAt : iso(now);
  const lastAt = maxDate(
    startAt,
    petition.sampleSentAt,
    petition.receivedAt,
    petition.qcReceivedAt,
    petition.labReceivedAt,
    assignedAt,
    petition.firstResultAt,
    petition.qcCompletedAt,
    petition.labCompletedAt,
    petition.labApprovedAt,
    petition.completedAt,
    petition.approvedAt,
    petition.rejectedAt,
    petition.updatedAt,
  ) ?? startAt;
  const idleSince = validDate(lastAt);
  const isIdle = !isClosed && !!idleSince && now.getTime() - idleSince.getTime() > DAY_MS;

  const milestones = compactMilestones([
    { key: "submitted", label: "ยื่นคำขอ", at: startAt, done: true, tone: "intake" },
    { key: "sample-sent", label: "ส่งตัวอย่าง", at: petition.sampleSentAt ?? null, done: !!petition.sampleSentAt, tone: "intake" },
    { key: "qc-received", label: "QC รับ", at: petition.qcReceivedAt ?? petition.receivedAt ?? null, done: !!(petition.qcReceivedAt || petition.receivedAt), tone: "receive" },
    { key: "lab-received", label: "Lab รับ", at: petition.labReceivedAt ?? null, done: hasLab && !!petition.labReceivedAt, tone: "receive" },
    { key: "assigned", label: "Assign", at: assignedAt, done: !!assignedAt, tone: "testing" },
    { key: "first-result", label: "เริ่มบันทึกผล", at: petition.firstResultAt ?? null, done: !!petition.firstResultAt, tone: "testing" },
    { key: "qc-completed", label: "QC ครบ", at: petition.qcCompletedAt ?? null, done: !!petition.qcCompletedAt, tone: "testing" },
    { key: "lab-completed", label: "Lab ครบ", at: petition.labCompletedAt ?? null, done: hasLab && !!petition.labCompletedAt, tone: "lab" },
    { key: "lab-approved", label: "ออกผล Lab", at: petition.labApprovedAt ?? null, done: hasLab && !!petition.labApprovedAt, tone: "lab" },
    { key: petition.status === "rejected" ? "rejected" : "final-result", label: petition.status === "rejected" ? "ส่งกลับแก้ไข" : "Final Result", at: finalAt, done: !!finalAt, tone: petition.status === "rejected" ? "blocked" : "closed" },
  ]);

  const segments = [
    segment("intake", "นำส่งตัวอย่าง", startAt, firstDate(petition.sampleSentAt, firstReceivedAt, activeEnd), "intake", !petition.sampleSentAt && !firstReceivedAt && !isClosed),
    segment("receive-assign", "รับและมอบหมาย", firstReceivedAt ?? petition.sampleSentAt ?? null, assignedAt ?? firstDate(testingStartAt, activeEnd), "receive", !!firstReceivedAt && !assignedAt && !isClosed),
    segment("testing", "ตรวจวิเคราะห์", testingStartAt, testingEndAt ?? activeEnd, "testing", !testingEndAt && !isClosed),
    hasLab ? segment("lab-approval", "ออกผล Lab", petition.labCompletedAt ?? null, petition.labApprovedAt ?? activeEnd, "lab", !!petition.labCompletedAt && !petition.labApprovedAt && !isClosed) : null,
    segment("final", "ออก Final Result", testingEndAt ?? petition.completedAt ?? null, finalAt ?? activeEnd, isClosed ? "closed" : "final", !!testingEndAt && !finalAt && !isClosed),
  ].filter((item): item is PetitionTimelineSegment => !!item);

  const rowEnd = maxDate(lastAt, activeEnd, ...segments.map((item) => item.endAt)) ?? startAt;

  return {
    petition,
    startAt,
    endAt: rowEnd,
    lastAt,
    hasLabTrack: hasLab,
    isClosed,
    isIdle,
    milestones,
    segments,
  };
}

export function buildTimelineWindow(
  rows: PetitionTimelineRow[],
  now: Date = new Date(),
): TimelineWindow {
  const dates = rows.flatMap((row) => [
    row.startAt,
    row.endAt,
    row.lastAt,
    ...row.milestones.map((item) => item.at),
    ...row.segments.flatMap((item) => [item.startAt, item.endAt]),
  ]).map(validDate).filter((date): date is Date => !!date);

  const today = startOfDay(now);
  if (dates.length === 0) {
    return {
      startAt: iso(addDays(today, -7)),
      endAt: iso(addDays(today, 7)),
      todayAt: iso(today),
    };
  }

  let min = startOfDay(new Date(Math.min(...dates.map((date) => date.getTime()))));
  let max = startOfDay(new Date(Math.max(...dates.map((date) => date.getTime()))));
  min = addDays(min, -1);
  max = addDays(max, 2);
  if (max.getTime() - min.getTime() < 7 * DAY_MS) {
    const mid = new Date((min.getTime() + max.getTime()) / 2);
    min = addDays(startOfDay(mid), -3);
    max = addDays(startOfDay(mid), 4);
  }
  const todayAt = today >= min && today <= max ? iso(today) : null;
  return { startAt: iso(min), endAt: iso(max), todayAt };
}

export function timelinePercent(
  at: string | null | undefined,
  window: TimelineWindow,
): number | null {
  const date = validDate(at);
  const start = validDate(window.startAt);
  const end = validDate(window.endAt);
  if (!date || !start || !end || end.getTime() <= start.getTime()) return null;
  const raw = ((date.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
  return Math.max(0, Math.min(100, raw));
}

export function buildTimelineTicks(window: TimelineWindow): TimelineTick[] {
  const start = validDate(window.startAt);
  const end = validDate(window.endAt);
  if (!start || !end || end <= start) return [];
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
  const step = totalDays <= 14 ? 1 : totalDays <= 45 ? 3 : totalDays <= 120 ? 7 : 30;
  const ticks: TimelineTick[] = [];
  for (let offset = 0; offset <= totalDays; offset += step) {
    const at = addDays(start, offset);
    ticks.push({
      key: iso(at),
      at: iso(at),
      label: at.toLocaleDateString("th-TH", totalDays <= 45 ? { day: "2-digit", month: "short" } : { month: "short", year: "2-digit" }),
      major: at.getDate() === 1 || offset === 0,
    });
  }
  return ticks;
}

export function buildTimelineSummary(
  rows: PetitionTimelineRow[],
  now: Date = new Date(),
): PetitionTimelineSummary {
  return {
    total: rows.length,
    inProgress: rows.filter((row) => !row.isClosed && row.petition.status !== "success").length,
    closed: rows.filter((row) => row.isClosed || row.petition.status === "success").length,
    waiting: rows.filter((row) => {
      if (row.isClosed) return false;
      const idleSince = validDate(row.lastAt);
      return !!idleSince && now.getTime() - idleSince.getTime() > DAY_MS;
    }).length,
  };
}
```

- [ ] **Step 4: Run timeline tests**

Run:

```powershell
npx vitest run src/lib/petitionTimeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add src/lib/petitionTimeline.ts src/lib/petitionTimeline.test.ts
git commit -m "feat: derive petition timeline rows"
```

---

### Task 3: Add Timeline Page UI

**Files:**
- Create: `src/pages/PetitionTimelinePage.tsx`

**Interfaces:**
- Consumes: `buildPetitionTimelineRow`, `buildTimelineSummary`, `buildTimelineTicks`, `buildTimelineWindow`, `timelinePercent`.
- Consumes: `canSeePetition`, `isLabRole`, `petitionHasLabReadableItem`.
- Produces: default React page component for `/petition-timeline`.

- [ ] **Step 1: Create the page component**

Create `src/pages/PetitionTimelinePage.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { usePetitionList } from "@/hooks/usePetition";
import { api, type ParameterItem } from "@/lib/api";
import {
  buildPetitionTimelineRow,
  buildTimelineSummary,
  buildTimelineTicks,
  buildTimelineWindow,
  timelinePercent,
  type PetitionTimelineRow,
  type TimelineTone,
} from "@/lib/petitionTimeline";
import {
  canSeePetition,
  isLabRole,
  petitionHasLabReadableItem,
} from "@/lib/petitionVisibility";
import { normalizeRoles } from "@/lib/roles";
import { petitionStatusBadge } from "@/lib/statusBadge";
import { cn } from "@/lib/utils";
import {
  PETITION_DEPT_LABELS,
  PETITION_STATUS_CONFIG,
  PETITION_STATUSES,
  type Petition,
} from "@/types/petition.types";

const PAGE_SIZE = 100;

const TONE_CLASS: Record<TimelineTone, string> = {
  intake: "bg-sky-500",
  receive: "bg-emerald-500",
  testing: "bg-blue-500",
  lab: "bg-violet-500",
  final: "bg-amber-500",
  closed: "bg-green-600",
  blocked: "bg-red-500",
};

const TONE_SOFT_CLASS: Record<TimelineTone, string> = {
  intake: "border-sky-200 bg-sky-50 text-sky-700",
  receive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  testing: "border-blue-200 bg-blue-50 text-blue-700",
  lab: "border-violet-200 bg-violet-50 text-violet-700",
  final: "border-amber-200 bg-amber-50 text-amber-700",
  closed: "border-green-200 bg-green-50 text-green-700",
  blocked: "border-red-200 bg-red-50 text-red-700",
};

function lower(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function sampleLine(petition: Petition) {
  const names = petition.items.map((item) => item.sampleName).filter(Boolean);
  const primary = names[0] ?? "-";
  const extra = Math.max(0, names.length - 1);
  return extra > 0 ? `${primary} +อีก ${extra}` : primary;
}

function rowMatchesSearch(row: PetitionTimelineRow, query: string) {
  const q = lower(query);
  if (!q) return true;
  const petition = row.petition;
  const haystack = [
    petition.petitionNo,
    petition.submittedBy?.name,
    petition.assignedTo?.name,
    ...petition.items.flatMap((item) => [
      item.sampleName,
      item.commonName,
      item.batchNo,
      item.lotNo,
      item.sampleId,
    ]),
  ].map(lower);
  return haystack.some((value) => value.includes(q));
}

function rowInDateRange(row: PetitionTimelineRow, from: string, to: string) {
  const start = new Date(row.startAt).getTime();
  const end = new Date(row.endAt).getTime();
  const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return end >= fromTime && start <= toTime;
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card className="border-black-50 shadow-none">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-grey-600">{label}</p>
        <p className="mt-2 text-3xl font-bold text-black-500">{value}</p>
        <p className="mt-1 text-xs text-grey-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function PetitionTimelinePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = normalizeRoles(user);
  const isAdmin = roles.includes("admin");
  const isLabUser = roles.some(isLabRole);
  const groupMembership = useItemGroupMembership();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const serverSearch = search.trim();

  const { data, loading, error, refresh } = usePetitionList(
    {
      page: isAdmin ? page : 1,
      limit: isAdmin ? PAGE_SIZE : 500,
      status: status || undefined,
      search: serverSearch || undefined,
    },
    { refetchOnFocus: true },
  );

  useEffect(() => {
    setPage(1);
  }, [serverSearch, status]);

  useEffect(() => {
    if (!isLabUser) {
      setParamsLoaded(true);
      return;
    }
    let alive = true;
    setParamsLoaded(false);
    api.getParameters()
      .then((items) => {
        if (alive) setParameters(items);
      })
      .catch(() => {
        if (alive) setParameters([]);
      })
      .finally(() => {
        if (alive) setParamsLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [isLabUser]);

  const displayParameters = useMemo(
    () =>
      isLabUser
        ? parameters.filter((p) => p.scope === "lab" || (p.scope === "qc" && p.shareWithLab === true))
        : parameters,
    [isLabUser, parameters],
  );

  const visiblePetitions = useMemo(() => {
    const items = data?.items ?? [];
    if (isAdmin) return items;
    let visible = items.filter((petition) => canSeePetition(petition, user));
    if (isLabUser && paramsLoaded) {
      visible = visible.filter((petition) =>
        petitionHasLabReadableItem(petition, displayParameters, groupMembership),
      );
    }
    return visible;
  }, [data?.items, displayParameters, groupMembership, isAdmin, isLabUser, paramsLoaded, user]);

  const rows = useMemo(
    () => visiblePetitions.map((petition) => buildPetitionTimelineRow(petition)),
    [visiblePetitions],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        rowMatchesSearch(row, search) && rowInDateRange(row, from, to),
      ),
    [from, rows, search, to],
  );

  const timelineWindow = useMemo(() => buildTimelineWindow(filteredRows), [filteredRows]);
  const ticks = useMemo(() => buildTimelineTicks(timelineWindow), [timelineWindow]);
  const summary = useMemo(() => buildTimelineSummary(filteredRows), [filteredRows]);
  const totalCount = isAdmin ? data?.total ?? filteredRows.length : filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const recent = useMemo(
    () =>
      filteredRows
        .flatMap((row) =>
          row.milestones
            .filter((milestone) => milestone.done && milestone.at)
            .map((milestone) => ({ row, milestone })),
        )
        .sort((a, b) => new Date(b.milestone.at!).getTime() - new Date(a.milestone.at!).getTime())
        .slice(0, 5),
    [filteredRows],
  );

  const hasFilters = !!search || !!status || !!from || !!to;
  const showLoading = loading || (isLabUser && !paramsLoaded);

  return (
    <AppLayout title="Timeline คำร้อง">
      <div className="space-y-4">
        <PageHeader
          title="Timeline คำร้อง"
          description="ดูช่วงเวลาการดำเนินงานของคำร้องแต่ละใบจากข้อมูลที่มีในระบบ"
          actions={
            <Button variant="primary-outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
              รีเฟรช
            </Button>
          }
        />

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500">
            <span>โหลด timeline ไม่สำเร็จ: {error}</span>
            <Button variant="danger-outline" size="sm" onClick={refresh}>
              ลองใหม่
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="คำร้องที่เห็น" value={summary.total} hint="ตามสิทธิ์และตัวกรองปัจจุบัน" />
          <StatCard label="กำลังดำเนินการ" value={summary.inProgress} hint="ยังไม่ปิดงานหรือยังรอยืนยัน" />
          <StatCard label="เสร็จสิ้น/ปิดงาน" value={summary.closed} hint="ทดสอบครบ ออกผล หรือส่งกลับแล้ว" />
          <StatCard label="รอเกิน 24 ชม." value={summary.waiting} hint="ไม่มี milestone ใหม่เกินหนึ่งวัน" />
        </div>

        <form className="grid gap-3 rounded-2xl border border-black-50 bg-white p-4 lg:grid-cols-[minmax(260px,1fr)_180px_150px_150px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="ค้นหาเลขคำร้อง ผู้ยื่น ตัวอย่าง หรือ batch"
              className="pl-9"
            />
          </div>
          <NativeSelect value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">ทุกสถานะ</option>
            {PETITION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {PETITION_STATUS_CONFIG[item].label}
              </option>
            ))}
          </NativeSelect>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="วันที่เริ่มต้น" />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="วันที่สิ้นสุด" />
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatus("");
                setFrom("");
                setTo("");
              }}
            >
              <X className="h-4 w-4" />
              ล้าง
            </Button>
          )}
        </form>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="border-black-50 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-primary-500" />
                แผนภาพระยะเวลาคำร้อง
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showLoading ? (
                <div className="rounded-[10px] border border-dashed border-grey-200 py-12 text-center text-grey-500">
                  กำลังโหลด timeline...
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-grey-200 py-12 text-center">
                  <p className="text-sm font-medium text-black-500">
                    {hasFilters ? "ไม่พบคำร้องตามตัวกรอง" : "ยังไม่มีคำร้องที่คุณมีสิทธิ์เห็น"}
                  </p>
                  <p className="mt-1 text-xs text-grey-500">ลองเปลี่ยนคำค้นหา สถานะ หรือช่วงวันที่</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <div className="min-w-[980px]">
                      <div className="grid grid-cols-[300px_minmax(640px,1fr)] border-b border-black-50 pb-2 text-xs text-grey-500">
                        <div>คำร้อง</div>
                        <div className="relative h-8">
                          {ticks.map((tick) => {
                            const left = timelinePercent(tick.at, timelineWindow);
                            if (left == null) return null;
                            return (
                              <div
                                key={tick.key}
                                className={cn("absolute top-0 h-full border-l", tick.major ? "border-grey-300" : "border-grey-100")}
                                style={{ left: `${left}%` }}
                              >
                                <span className="ml-1 whitespace-nowrap">{tick.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="divide-y divide-black-50">
                        {filteredRows.map((row) => {
                          const statusBadge = petitionStatusBadge(row.petition);
                          const todayLeft = timelinePercent(timelineWindow.todayAt, timelineWindow);
                          return (
                            <button
                              key={row.petition._id}
                              type="button"
                              className="grid w-full grid-cols-[300px_minmax(640px,1fr)] gap-0 py-3 text-left hover:bg-grey-50/60"
                              onClick={() => navigate(`/petitions/${row.petition._id}`)}
                            >
                              <div className="min-w-0 pr-4">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-primary-500">{row.petition.petitionNo}</p>
                                  <ChevronRight className="h-4 w-4 shrink-0 text-grey-400" />
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                                  <Badge variant="blue-soft">{PETITION_DEPT_LABELS[row.petition.dept]}</Badge>
                                  {row.isIdle && <Badge variant="yellow-soft">รอเกิน 24 ชม.</Badge>}
                                </div>
                                <p className="mt-1 truncate text-xs text-grey-600">{sampleLine(row.petition)}</p>
                                <p className="truncate text-xs text-grey-500">
                                  ผู้ยื่น {row.petition.submittedBy?.name ?? "-"} · ผู้รับงาน {row.petition.assignedTo?.name ?? "ยังไม่มี"}
                                </p>
                              </div>
                              <div className="relative h-16">
                                <div className="absolute inset-x-0 top-7 h-px bg-grey-100" />
                                {todayLeft != null && (
                                  <div className="absolute inset-y-0 border-l border-red-300" style={{ left: `${todayLeft}%` }} />
                                )}
                                {row.segments.map((segment, index) => {
                                  const left = timelinePercent(segment.startAt, timelineWindow);
                                  const right = timelinePercent(segment.endAt, timelineWindow);
                                  if (left == null || right == null) return null;
                                  return (
                                    <div
                                      key={segment.key}
                                      className={cn("absolute h-3 rounded-full", TONE_CLASS[segment.tone], segment.current && "animate-pulse")}
                                      style={{
                                        left: `${left}%`,
                                        width: `${Math.max(1, right - left)}%`,
                                        top: `${18 + index * 8}px`,
                                      }}
                                      title={`${segment.label}: ${formatDateTime(segment.startAt)} - ${formatDateTime(segment.endAt)}`}
                                    />
                                  );
                                })}
                                {row.milestones.map((milestone) => {
                                  const left = timelinePercent(milestone.at, timelineWindow);
                                  if (left == null) return null;
                                  return (
                                    <span
                                      key={milestone.key}
                                      className={cn(
                                        "absolute top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white shadow-sm",
                                        TONE_CLASS[milestone.tone],
                                      )}
                                      style={{ left: `${left}%` }}
                                      title={`${milestone.label}: ${formatDateTime(milestone.at)}`}
                                    />
                                  );
                                })}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {isAdmin && data && totalCount > PAGE_SIZE && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-grey-500">
                        หน้า {page} / {totalPages} · ทั้งหมด {totalCount} รายการ
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary-outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                          ก่อนหน้า
                        </Button>
                        <Button
                          variant="primary-outline"
                          size="sm"
                          disabled={page >= totalPages}
                          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        >
                          ถัดไป
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-black-50 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">กิจกรรมล่าสุด</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-grey-500">ยังไม่มีกิจกรรมจากคำร้องที่แสดง</p>
                ) : (
                  recent.map(({ row, milestone }) => (
                    <button
                      key={`${row.petition._id}-${milestone.key}-${milestone.at}`}
                      type="button"
                      className="flex w-full gap-3 rounded-lg p-2 text-left hover:bg-grey-50"
                      onClick={() => navigate(`/petitions/${row.petition._id}`)}
                    >
                      <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", TONE_CLASS[milestone.tone])} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-black-500">
                          {row.petition.petitionNo} · {milestone.label}
                        </span>
                        <span className="block text-xs text-grey-500">{formatDateTime(milestone.at)}</span>
                      </span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-black-50 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Legend</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries({
                  intake: "นำส่ง",
                  receive: "รับ/Assign",
                  testing: "ตรวจวิเคราะห์",
                  lab: "ออกผล Lab",
                  final: "รอ Final",
                  closed: "ปิดงาน",
                  blocked: "ส่งกลับ",
                } satisfies Record<TimelineTone, string>).map(([tone, label]) => (
                  <span
                    key={tone}
                    className={cn("inline-flex items-center rounded-full border px-2 py-1 text-xs", TONE_SOFT_CLASS[tone as TimelineTone])}
                  >
                    {label}
                  </span>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Run TypeScript on the new page path**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS. If `CalendarClock` is unavailable in the installed `lucide-react`, replace it with `Clock` and import `Clock` instead.

- [ ] **Step 3: Commit Task 3**

```powershell
git add src/pages/PetitionTimelinePage.tsx
git commit -m "feat: add petition timeline page"
```

---

### Task 4: Wire Route, Nav, and Access Control

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/navItems.ts`
- Modify: `src/lib/navItems.test.ts`
- Modify: `server/routes/accessControl.js`
- Modify: `server/lib/accessGroups.js`
- Modify: `server/lib/accessGroups.test.js`

**Interfaces:**
- Consumes: `PetitionTimelinePage` default export from Task 3.
- Produces: protected route `/petition-timeline` and visible nav item for authorized users.

- [ ] **Step 1: Add the nav item test**

Modify `src/lib/navItems.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./navItems";

describe("NAV_ITEMS", () => {
  it("does not expose separate lab or qc dashboard links in the main nav", () => {
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain("/dashboard/lab");
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain("/dashboard/qc");
  });

  it("exposes the petition timeline page in the main nav", () => {
    expect(NAV_ITEMS.map((item) => item.path)).toContain("/petition-timeline");
  });
});
```

- [ ] **Step 2: Run nav test to verify it fails**

Run:

```powershell
npx vitest run src/lib/navItems.test.ts
```

Expected: FAIL because `/petition-timeline` is not in `NAV_ITEMS`.

- [ ] **Step 3: Add nav item**

Modify `src/lib/navItems.ts`:

```ts
export const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "หน้าแรก", path: "/home" },
  { icon: FileText, label: "รายการคำร้อง", path: "/petitions" },
  { icon: Clock, label: "Timeline คำร้อง", path: "/petition-timeline" },
  { icon: ClipboardList, label: "ผลวิเคราะห์", path: "/record-results" },
  // keep the remaining existing items in their current order after this insertion
];
```

Do not remove the existing `Clock` import, because it is already used by `Standard Time`.

- [ ] **Step 4: Register the route**

Modify `src/App.tsx` near the petition lazy imports:

```ts
const PetitionTimelinePage = lazy(() => import("./pages/PetitionTimelinePage"));
```

Add the protected route near `/petitions`:

```tsx
<Route path="/petition-timeline" element={<PrivateRoute><PetitionTimelinePage /></PrivateRoute>} />
```

- [ ] **Step 5: Add targeted access-group backfill tests**

Modify `server/lib/accessGroups.test.js` to include:

```js
test('findOrphanBackfillPaths detects a new petition timeline path only when unclaimed', () => {
  const groups = [{ id: 'samples', paths: ['/petitions'] }];
  assert.deepStrictEqual(findOrphanBackfillPaths(groups, ['/petition-timeline']), ['/petition-timeline']);
});

test('findGroupForBackfill prefers a group id and falls back to an anchor path owner', () => {
  const groups = [
    { id: 'legacy-home', paths: ['/home', '/petitions'] },
    { id: 'stock', paths: ['/stock'] },
  ];
  assert.strictEqual(findGroupForBackfill(groups, 'samples', '/petitions'), 'legacy-home');
  assert.strictEqual(findGroupForBackfill(groups, 'stock', '/petitions'), 'stock');
});
```

- [ ] **Step 6: Run access helper test to verify it fails**

Run:

```powershell
node --test server/lib/accessGroups.test.js
```

Expected: FAIL because `findGroupForBackfill` is not exported.

- [ ] **Step 7: Implement targeted access helper**

Modify `server/lib/accessGroups.js`:

```js
const BACKFILL_PATHS = ['/simple-method', '/machines'];

function findOrphanBackfillPaths(groups, candidatePaths = BACKFILL_PATHS) {
  const assigned = new Set(
    (groups || []).flatMap((group) => (group && group.paths) || []),
  );
  return candidatePaths.filter((path) => !assigned.has(path));
}

function findGroupForBackfill(groups, preferredGroupId, anchorPath) {
  const safeGroups = groups || [];
  const preferred = safeGroups.find((group) => group && group.id === preferredGroupId);
  if (preferred) return preferred.id;
  const anchored = safeGroups.find((group) => (group && group.paths || []).includes(anchorPath));
  return anchored ? anchored.id : null;
}

module.exports = { BACKFILL_PATHS, findOrphanBackfillPaths, findGroupForBackfill };
```

- [ ] **Step 8: Wire `/petition-timeline` into access-control defaults and orphan backfill**

Modify imports in `server/routes/accessControl.js`:

```js
const { findOrphanBackfillPaths, findGroupForBackfill } = require('../lib/accessGroups');
```

Modify `defaultGroups` `samples` paths:

```js
{ id: 'samples', name: 'งานตัวอย่าง', description: 'รับ ส่ง และตรวจกายภาพตัวอย่าง', paths: ['/petitions', '/petition-timeline', '/petitions/new', '/petitions/production/new', '/petitions/ProductionIntegrationPetitionNewPage', '/petitions/:id', '/petitions/:id/edit', '/physical-inspection'], locked: false, sortOrder: 20 },
```

Inside `ensureGroups()`, after `const existingGroups = await AccessGroup.find().lean();`, keep the stock backfill and add petition timeline backfill:

```js
  const existingGroups = await AccessGroup.find().lean();
  const orphanPaths = findOrphanBackfillPaths(existingGroups);
  if (orphanPaths.length) {
    await AccessGroup.updateOne(
      { id: 'stock' },
      { $addToSet: { paths: { $each: orphanPaths } } },
    );
  }

  const petitionTimelinePaths = findOrphanBackfillPaths(existingGroups, ['/petition-timeline']);
  const petitionTimelineGroupId = findGroupForBackfill(existingGroups, 'samples', '/petitions');
  if (petitionTimelinePaths.length && petitionTimelineGroupId) {
    await AccessGroup.updateOne(
      { id: petitionTimelineGroupId },
      { $addToSet: { paths: { $each: petitionTimelinePaths } } },
    );
  }
```

- [ ] **Step 9: Run focused nav and access tests**

Run:

```powershell
npx vitest run src/lib/navItems.test.ts
node --test server/lib/accessGroups.test.js
```

Expected: PASS.

- [ ] **Step 10: Commit Task 4**

```powershell
git add src/App.tsx src/lib/navItems.ts src/lib/navItems.test.ts server/routes/accessControl.js server/lib/accessGroups.js server/lib/accessGroups.test.js
git commit -m "feat: route petition timeline nav"
```

---

### Task 5: Final Validation and UI Sanity Check

**Files:**
- Verify only. Do not modify files unless validation exposes a concrete issue.

**Interfaces:**
- Consumes all task outputs.
- Produces confidence that the page compiles and core tests pass without running a build.

- [ ] **Step 1: Run TypeScript**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend tests**

Run:

```powershell
npx vitest run src/lib/petitionTimeline.test.ts src/lib/navItems.test.ts src/pages/PetitionListPage.test.ts src/pages/PetitionListPage.actions.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run focused backend access helper tests**

Run:

```powershell
node --test server/lib/accessGroups.test.js
```

Expected: PASS.

- [ ] **Step 4: Start the dev server for manual inspection**

Run:

```powershell
npm run dev
```

Expected: Vite prints a local URL such as `http://localhost:5173/`. Open `/petition-timeline` in that dev server and confirm:

- The new nav item appears for an authorized account.
- The page shows summary cards.
- Timeline rows render without overlapping text at desktop width.
- Horizontal overflow works on narrow viewports.
- Clicking a row navigates to the petition detail page.

- [ ] **Step 5: Stop the dev server**

Stop the Vite process from the terminal session after inspection.

- [ ] **Step 6: Commit validation fixes if any were needed**

If no files changed during validation, do not create a commit. If a concrete validation fix was needed:

```powershell
git add <changed-files>
git commit -m "fix: polish petition timeline validation"
```

---

## Self-Review

**Spec coverage:** The plan covers the route, nav item, access defaults, existing data source, timeline model, summary cards, filters, Gantt grid, recent activity panel, empty/error states, helper tests, nav/access tests, and no-build validation.

**Red-flag scan:** The plan has no unspecified work markers, and each code-producing step includes concrete code or exact edits.

**Type consistency:** `PetitionTimelineRow`, `TimelineWindow`, `TimelineTick`, `timelinePercent`, `buildTimelineWindow`, and shared visibility helper names are defined before the page consumes them.
