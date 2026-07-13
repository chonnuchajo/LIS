# Petition Timeline Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Turn Timeline into a petition list that opens a dedicated per-petition operational timeline dashboard.

**Architecture:** Keep list behavior in PetitionListPage and make the row destination configurable. Add a pure detail-model helper for time windows, required-field progress, task rows, and activity normalization; the detail page composes that model with existing hooks and print templates.

**Tech Stack:** React, TypeScript, React Router, Tailwind, Vitest, Testing Library.

## Global Constraints

- Do not run npm run build, npm run build:dev, npm run build:watch, vite build, or scripts that trigger a build.
- Preserve every unrelated dirty file.
- Reuse usePetition, usePetitionAuditLog, useLabRequestsByPetition, api.getParameters, api.getQCProgress, print predicates, dialogs, and templates.
- Use actual lifecycle timestamps and audit events only; updatedAt is not a workflow event.
- Apply established lab role, parameter-scope, and item-group visibility rules before rendering data.

---

### Task 1: Build the pure timeline-detail model

**Files:**
- Create: src/lib/petitionTimelineDetail.ts
- Create: src/lib/petitionTimelineDetail.test.ts

**Interfaces:**
- Consumes: Petition, PetitionAuditLogEntry, ParameterItem, QCProgressEntry, matchParametersForItem, and expandFieldForItem.
- Produces: buildTimelineDetailModel(input, now), returning header, progress, tasks, activities, and timeline without React or network dependencies.

- [ ] **Step 1: Write failing model tests**

~~~ts
it("uses the first receiving timestamp as start and 20:00 as a same-day estimate", () => {
  const model = buildTimelineDetailModel(
    { petition: petition({ qcReceivedAt: "2026-07-13T03:15:00.000Z" }), parameters: [], progressEntries: [], auditLogs: [] },
    new Date("2026-07-13T05:00:00.000Z"),
  );
  expect(model.header.startAt).toBe("2026-07-13T03:15:00.000Z");
  expect(model.header.endKind).toBe("estimated");
  expect(new Date(model.header.endAt!).getHours()).toBe(20);
});

it("uses current time and daily boundaries for open work crossing dates", () => {
  const model = buildTimelineDetailModel(
    { petition: petition({ qcReceivedAt: "2026-07-12T03:15:00.000Z" }), parameters: [], progressEntries: [], auditLogs: [] },
    new Date("2026-07-13T05:00:00.000Z"),
  );
  expect(model.timeline.startAt).toBe("2026-07-12T01:00:00.000Z");
  expect(model.timeline.endAt).toBe("2026-07-13T05:00:00.000Z");
  expect(model.timeline.ticks.some((tick) => tick.label.includes("13"))).toBe(true);
});

it("counts only applicable required non-photo fields and caps pre-approval 100 at 99", () => {
  const model = buildTimelineDetailModel({
    petition: petition({ status: "success" }),
    parameters: [requiredParameter],
    progressEntries: [{ itemSeq: 1, parameterId: "p1", filledLabels: ["Viscosity", "Color"] }],
    auditLogs: [],
  });
  expect(model.tasks).toMatchObject([{ parameterName: "Required checks", total: 2, filled: 2 }]);
  expect(model.progress).toEqual({ filled: 2, total: 2, percent: 99 });
});

it("reports 100 only after approval and formats parameter result activity", () => {
  const model = buildTimelineDetailModel({
    petition: petition({ status: "approved", approvedAt: "2026-07-13T08:00:00.000Z" }),
    parameters: [requiredParameter],
    progressEntries: [{ itemSeq: 1, parameterId: "p1", filledLabels: ["Viscosity", "Color"] }],
    auditLogs: [{ _id: "a1", petitionId: "p1", petitionNo: "P-1", event: "resultEntered", actor: "Analyst", metadata: { parameterName: "Required checks" }, createdAt: "2026-07-13T06:00:00.000Z" }],
  });
  expect(model.progress.percent).toBe(100);
  expect(model.activities[0]).toMatchObject({ actor: "Analyst", label: expect.stringContaining("Required checks") });
});
~~~

- [ ] **Step 2: Run the new test to verify it fails**

Run: npx vitest run src/lib/petitionTimelineDetail.test.ts

Expected: FAIL because the module and buildTimelineDetailModel do not exist.

- [ ] **Step 3: Write the minimal model**

~~~ts
export type TimelineDetailInput = {
  petition: Petition;
  parameters: ParameterItem[];
  progressEntries: QCProgressEntry[];
  auditLogs: PetitionAuditLogEntry[];
  itemGroupIds?: Map<string, string[]>;
};

export function buildTimelineDetailModel(input: TimelineDetailInput, now = new Date()) {
  const startAt = firstValidDate(
    input.petition.qcReceivedAt,
    input.petition.labReceivedAt,
    input.petition.receivedAt,
    input.petition.submittedBy?.submittedAt,
    input.petition.createdAt,
  );
  const actualEndAt = latestValidDate(
    input.petition.approvedAt,
    input.petition.rejectedAt,
    input.petition.completedAt,
    input.petition.labApprovedAt,
    input.petition.labCompletedAt,
    input.petition.qcCompletedAt,
  );
  const tasks = buildRequiredTasks(input.petition, input.parameters, input.progressEntries, input.itemGroupIds);
  return {
    header: buildHeaderTiming(startAt, actualEndAt, input.petition.status, now),
    progress: buildRequiredProgress(tasks, input.petition.status === "approved"),
    tasks,
    activities: normalizeTimelineActivities(input.auditLogs),
    timeline: buildOperationalTimeline(input.petition, startAt, actualEndAt, now),
  };
}
~~~

buildRequiredTasks uses matchParametersForItem, retains field.required === true and field.type !== "photo", expands fields with expandFieldForItem, and matches keys from QCProgressEntry.filledLabels. buildRequiredProgress returns percent null when no required fields apply; otherwise it caps a pre-approval 100 at 99. normalizeTimelineActivities safely maps created, received, assigned, resultEntered, resultUpdated, statusChanged, reviewed, approve, and reject events. buildOperationalTimeline uses 08:00-20:00 same-day ticks, or date boundaries from 08:00 on the start date through current/actual end time for crossed days.

- [ ] **Step 4: Run the focused model test**

Run: npx vitest run src/lib/petitionTimelineDetail.test.ts

Expected: PASS.

- [ ] **Step 5: Commit the model**

~~~powershell
git add -- src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat: derive petition timeline detail model"
~~~

### Task 2: Reuse the petition list for Timeline navigation

**Files:**
- Modify: src/pages/PetitionListPage.tsx
- Modify: src/pages/PetitionTimelinePage.tsx
- Modify: src/pages/PetitionTimelinePage.test.tsx

**Interfaces:**
- Consumes: current petition-list behavior.
- Produces: PetitionListPage({ petitionDetailPath?, title?, description? }), preserving the default destination.

- [ ] **Step 1: Write failing navigation tests**

~~~tsx
it("opens the Timeline detail route when its list row is selected", () => {
  renderPage();
  fireEvent.click(screen.getByText("P-LAB-1"));
  expect(mockNavigate).toHaveBeenCalledWith("/petition-timeline/petition-lab-1");
});

it("does not expose lab-only rows while readable parameters are loading", () => {
  mocks.getParameters.mockReturnValue(new Promise(() => {}));
  renderPage();
  expect(screen.queryByText("P-LAB-1")).not.toBeInTheDocument();
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: npx vitest run src/pages/PetitionTimelinePage.test.tsx

Expected: FAIL because Timeline still renders the cross-petition Gantt.

- [ ] **Step 3: Add a configurable destination and make Timeline a wrapper**

~~~tsx
export type PetitionListPageProps = {
  petitionDetailPath?: (petition: Petition) => string;
  title?: string;
  description?: string;
};

export default function PetitionListPage({
  petitionDetailPath = (petition) => "/petitions/" + petition._id,
  title = "รายการคำร้อง",
  description = "ดูคำร้องทั้งหมดและงานที่ต้องดำเนินการต่อ",
}: PetitionListPageProps) {
  // Retain current query, filtering, visibility, paging, and actions.
  // Replace the card handler with:
  // onOpen={() => navigate(petitionDetailPath(petition))}
}
~~~

~~~tsx
export default function PetitionTimelinePage() {
  return (
    <PetitionListPage
      title="Timeline คำร้อง"
      description="เลือกคำร้องเพื่อติดตามเวลา ความคืบหน้า กิจกรรม และเอกสาร"
      petitionDetailPath={(petition) => "/petition-timeline/" + petition._id}
    />
  );
}
~~~

Remove the old Timeline summary cards, filters, cross-petition Gantt, and activity panel. Do not copy list logic.

- [ ] **Step 4: Run list regressions**

Run: npx vitest run src/pages/PetitionListPage.test.ts src/pages/PetitionListPage.actions.test.tsx src/pages/PetitionTimelinePage.test.tsx

Expected: PASS; normal rows still open /petitions/:id and Timeline rows open /petition-timeline/:id.

- [ ] **Step 5: Commit the list reuse**

~~~powershell
git add -- src/pages/PetitionListPage.tsx src/pages/PetitionTimelinePage.tsx src/pages/PetitionTimelinePage.test.tsx
git commit -m "feat: use petition list for timeline navigation"
~~~

### Task 3: Implement the protected per-petition Timeline dashboard

**Files:**
- Create: src/pages/PetitionTimelineDetailPage.tsx
- Create: src/pages/PetitionTimelineDetailPage.test.tsx
- Modify: src/App.tsx

**Interfaces:**
- Consumes: usePetition, usePetitionAuditLog, useAuth, useItemGroupMembership, api.getParameters, api.getQCProgress, and buildTimelineDetailModel.
- Produces: the protected /petition-timeline/:id dashboard.

- [ ] **Step 1: Write failing dashboard tests**

~~~tsx
it("renders one petition's header, required progress, and same-day 08:00 to 20:00 timeline", async () => {
  renderDetail();
  expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
  expect(screen.getByText("50%")).toBeInTheDocument();
  expect(screen.getByText("08:00")).toBeInTheDocument();
  expect(screen.getByText("20:00")).toBeInTheDocument();
});

it("retries an activity failure without blanking the header or task panels", async () => {
  renderDetail({ auditError: "network" });
  expect(await screen.findByText(/โหลดกิจกรรมไม่สำเร็จ/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
  expect(mockRefreshAudit).toHaveBeenCalled();
});

it("does not render Lab-only tasks before parameter visibility is resolved", () => {
  renderDetail({ parameterPromise: new Promise(() => {}) });
  expect(screen.queryByText("Lab-only required parameter")).not.toBeInTheDocument();
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx

Expected: FAIL because the page and route do not exist.

- [ ] **Step 3: Implement data loading, dashboard layout, and route**

~~~tsx
const { id } = useParams<{ id: string }>();
const { data: petition, loading, error, refresh } = usePetition(id);
const { data: auditLogs, loading: activityLoading, error: activityError, refresh: refreshActivity } =
  usePetitionAuditLog(petition?._id, 0);

const model = useMemo(
  () => petition && parametersLoaded
    ? buildTimelineDetailModel({
        petition,
        parameters: visibleParameters,
        progressEntries,
        auditLogs,
        itemGroupIds: groupMembership,
      })
    : null,
  [petition, parametersLoaded, visibleParameters, progressEntries, auditLogs, groupMembership],
);
~~~

After petition loads, request api.getParameters() and api.getQCProgress([petition._id]) together. While a Lab user is waiting for parameter visibility, render no task or activity-derived Lab data. The header contains petition number, status badge, requester, assignee, start/end cards, progress card, and a fixed neutral ImageIcon placeholder. The main two-column layout contains Project Timeline and Tasks on the left, Recent Activity on the right; the activity list shows five entries until View all is selected. The page-level retry reloads the petition; the activity retry calls refreshActivity; task-loading failure is isolated to Tasks.

~~~tsx
<Route
  path="/petition-timeline/:id"
  element={<PrivateRoute><PetitionTimelineDetailPage /></PrivateRoute>}
/>
~~~

Add the route beside /petition-timeline and before generic petition routes.

- [ ] **Step 4: Run the dashboard test**

Run: npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit the dashboard core**

~~~powershell
git add -- src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx src/App.tsx
git commit -m "feat: add petition timeline detail dashboard"
~~~

### Task 4: Add the Documents panel via existing print workflows

**Files:**
- Modify: src/pages/PetitionTimelineDetailPage.tsx
- Modify: src/pages/PetitionTimelineDetailPage.test.tsx

**Interfaces:**
- Consumes: useLabRequestsByPetition, api.getQCResults, canPrintSampleLabel, canPrintPreReport, PetitionPrintTemplate, SampleLabelPrintTemplate, ResultReportPrintTemplate, and PrintPreviewDialog.
- Produces: document buttons whose eligibility matches PetitionDetailPage.

- [ ] **Step 1: Write the failing document test**

~~~tsx
it("shows eligible document actions and hides Pre Report after approval", async () => {
  renderDetail({ petition: approvedPetition, labRequests: [labRequest] });
  expect(await screen.findByRole("button", { name: "พิมพ์ฉลาก" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "พิมพ์ใบคำขอรับบริการ" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Final Report" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Pre Report" })).not.toBeInTheDocument();
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx

Expected: FAIL because Documents is absent.

- [ ] **Step 3: Reuse the existing eligibility predicates and preview templates**

~~~tsx
const { data: labRequests } = useLabRequestsByPetition(petition?._id);
const [labelPrintOpen, setLabelPrintOpen] = useState(false);
const [servicePrintOpen, setServicePrintOpen] = useState(false);
const [preReportOpen, setPreReportOpen] = useState(false);
const [finalReportOpen, setFinalReportOpen] = useState(false);

{canPrintSampleLabel(petition) && <Button onClick={() => setLabelPrintOpen(true)}><Printer />พิมพ์ฉลาก</Button>}
{labRequests.length > 0 && <Button onClick={() => setServicePrintOpen(true)}><FileText />พิมพ์ใบคำขอรับบริการ</Button>}
{canPrintPreReport(petition) && <Button onClick={() => setPreReportOpen(true)}><FileText />Pre Report</Button>}
{petition.status === "approved" && <Button onClick={() => setFinalReportOpen(true)}><FileCheck2 />Final Report</Button>}
~~~

Load QC results and parameters only after the first document open, then render the existing templates inside PrintPreviewDialog. Do not introduce a document API or duplicate the existing printability predicates.

- [ ] **Step 4: Run the page test again**

Run: npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx

Expected: PASS including document eligibility.

- [ ] **Step 5: Commit the Documents panel**

~~~powershell
git add -- src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "feat: add timeline document panel"
~~~

### Task 5: Verify and review the feature

**Files:**
- Modify only when focused test failures reveal a feature defect.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: verified list-to-detail behavior without a build.

- [ ] **Step 1: Run TypeScript and focused tests**

~~~powershell
npx tsc --noEmit
npx vitest run src/lib/petitionTimelineDetail.test.ts src/lib/petitionTestItems.test.ts src/lib/qcProgress.test.ts src/pages/PetitionListPage.test.ts src/pages/PetitionListPage.actions.test.tsx src/pages/PetitionTimelinePage.test.tsx src/pages/PetitionTimelineDetailPage.test.tsx
~~~

Expected: TypeScript exits 0 and all focused tests pass.

- [ ] **Step 2: Smoke-test desktop and mobile against the existing dev server**

~~~powershell
npx playwright test --grep "petition timeline" --project=chromium
~~~

Expected: /LIS/petition-timeline loads on desktop and mobile, a visible row opens /LIS/petition-timeline/:id, chart labels do not overlap, activity expands only for that petition, and eligible document actions render.

- [ ] **Step 3: Review the scoped diff**

~~~powershell
git diff --check -- src/App.tsx src/pages/PetitionListPage.tsx src/pages/PetitionTimelinePage.tsx src/pages/PetitionTimelineDetailPage.tsx src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts src/pages/PetitionTimelinePage.test.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git status --short
~~~

Expected: no whitespace errors and no unrelated change is staged.
