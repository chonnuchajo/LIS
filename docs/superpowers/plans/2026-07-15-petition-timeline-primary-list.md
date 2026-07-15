# Petition Timeline → Primary "รายการคำร้อง" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้หน้า Petition Timeline กลายเป็น "รายการคำร้อง" หลักที่ `/petition` และย้ายหน้า list เดิมทั้ง tree ไป `/petitions-old/*` (ซ่อนจาก sidebar) พร้อม repoint ลิงก์ภายในและ migrate สิทธิ์ใน DB

**Architecture:** เป็นการ rename route/label/ลิงก์ + ปรับ access-control mapping ล้วน ไม่รื้อ UI/logic ภายใน component. `/petition` เป็น "ประตูเดียว" ที่ปลดล็อกงานคำร้องทั้งหมดผ่าน `IMPLIED_CHILD_PATHS`. Backend REST API (`/petitions/*`) ไม่แตะ. สิทธิ์ที่ค้างใน DB (`Role.permissions[]`, `AccessGroup.paths[]`) migrate ด้วย script.

**Tech Stack:** React 18 + React Router v6, Vitest (FE tests), Express + Mongoose, `node:test` (BE tests)

## Global Constraints

- **ห้ามแตะ backend REST API endpoint** `/petitions/*`: `src/lib/api.ts` (ทุกบรรทัด), `src/hooks/usePetition.ts:252`, `server/index.js:38`, `server/routes/petitions.js`, `server/routes/dev.js`. พวกนี้เป็น API path ไม่ใช่ route หน้าเว็บ
- Frontend test runner: `npx vitest run <file>` (ไฟล์เดียว) / `npm run test` (ทั้งชุด)
- Backend test runner: `node --test <file>` (ไฟล์ใช้ `node:test`)
- Type-check จริง: `npx tsc -p tsconfig.app.json --noEmit` (repo มี ~12 latent error อยู่ก่อนแล้ว — เกณฑ์คือ "ไม่เพิ่ม error ใหม่ในไฟล์ที่แก้")
- Commit message ลงท้ายด้วย: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Rename map มาตรฐาน (ใช้ทั้ง code และ migration):
  - exact `/petitions` → `/petition`
  - exact `/petition-timeline` → `/petition`
  - prefix `/petition-timeline/` → `/petition/`
  - prefix `/petitions/` → `/petitions-old/`
  - ยกเว้นลิงก์ไป **list** (ปุ่มย้อนกลับ/ดูทั้งหมด/drilldown/after-save) → `/petition` (ตาม rename map พอดี)
  - ลิงก์ไป **detail แบบ dashboard row** → `/petition/:id` (timeline detail) ไม่ใช่ `/petitions-old/:id`

---

## File Structure

- `src/lib/navItems.ts` — nav + page metadata (single source สำหรับ sidebar + access labels)
- `src/lib/accessControl.ts` — `IMPLIED_CHILD_PATHS` (parent path → implied sub-pages)
- `src/App.tsx` — route table
- `src/pages/PetitionTimelinePage.tsx` — thin wrapper รอบ PetitionListPage
- `src/pages/PetitionTimelineDetailPage.tsx` — timeline detail (back button)
- `src/lib/dashboardProfiles.ts`, `src/lib/execSummary.ts`, `src/pages/RoleDashboard.tsx`, `src/components/lis/PetitionDashboardTable.tsx`, `src/components/lis/WaitingSamplesCard.tsx` — dashboard/summary links
- `src/pages/PetitionDetailPage.tsx` + petition pages — navigate() ภายใน
- `server/routes/accessControl.js` — default groups + backfill
- `server/lib/accessGroups.js` (+`.test.js`) — orphan backfill helpers
- `server/seed-access-control.js` — seed groups/roles
- `server/scripts/rename-petition-paths.js` (+`.test.js`) — DB migration (ใหม่)

---

## Task 1: Nav items + frontend access-control mapping

**เหตุผลที่รวมกัน:** `accessControl.ts` ใช้ `isOwnNavPage()` อ่าน `NAV_ITEMS` จริง — เปลี่ยน `navItems.ts`
โดยไม่แก้ `accessControl.ts` + test พร้อมกันจะทำให้ `accessControl.test.ts` แดง (assign ที่ไม่ใช่ nav page
อีกต่อไปจะโดน implied `:id` กลืน) ทั้งสองไฟล์จึงต้องเปลี่ยนใน task เดียว

**Files:**
- Modify: `src/lib/navItems.ts`
- Test: `src/lib/navItems.test.ts`
- Modify: `src/lib/accessControl.ts:16-38` (IMPLIED_CHILD_PATHS)
- Test: `src/lib/accessControl.test.ts`
- Test: `src/lib/accessNav.test.ts` (แมป permission → NAV_ITEMS จริง)
- Test: `src/lib/accessDerive.test.ts` (แมป path → NAV_ITEMS label)

**Interfaces:**
- Produces: `NAV_ITEMS` มี `{ label: "รายการคำร้อง", path: "/petition" }` และ nav "Assign คำร้อง" ที่ `/petitions-old/assign`; ไม่มี `/petitions` (bare) และ `/petition-timeline`
- Produces: `IMPLIED_CHILD_PATHS["/petition"]` grant `/petition/:id` + `/petitions-old` + sub-routes classic ทั้งหมด (ยกเว้น assign)

- [ ] **Step 1: แก้ test `navItems.test.ts` ให้คาดพฤติกรรมใหม่**

แทนที่ `it("exposes the petition timeline page in the main nav", ...)` (บรรทัด 10-12) ด้วย:

```ts
  it("exposes the petition list page in the main nav", () => {
    expect(NAV_ITEMS.map((item) => item.path)).toContain("/petition");
  });

  it("no longer exposes the retired /petitions list or timeline path in the main nav", () => {
    const paths = NAV_ITEMS.map((item) => item.path);
    expect(paths).not.toContain("/petitions");
    expect(paths).not.toContain("/petition-timeline");
  });
```

- [ ] **Step 2: รัน test ให้เห็น fail**

Run: `npx vitest run src/lib/navItems.test.ts`
Expected: FAIL (NAV_ITEMS ยังมี `/petition-timeline`, ยังมี `/petitions`)

- [ ] **Step 3: แก้ `navItems.ts` — NAV_ITEMS**

ลบบรรทัด `{ icon: FileText, label: "รายการคำร้อง", path: "/petitions" },` และเปลี่ยนบรรทัด timeline
เป็นรายการคำร้องใหม่ + เปลี่ยน path ของ "Assign คำร้อง":

```ts
export const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "หน้าแรก", path: "/home" },
  { icon: FileText, label: "รายการคำร้อง", path: "/petition" },
  { icon: ClipboardList, label: "ผลวิเคราะห์", path: "/record-results" },
  { icon: ClipboardList, label: "ผลวิเคราะห์ Lab", path: "/lab-results" },
  { icon: ClipboardList, label: "การเบิก stock", path: "/stock-deduction" },
  { icon: Scale, label: "Daily Check", path: "/daily-check" },
  { icon: Network, label: "Virtual Lab", path: "/virtual-lab" },
  { icon: Clock, label: "Standard Time", path: "/standard-time" },
  { icon: FileBarChart, label: "รายงานสรุป", path: "/report" },
  { icon: ShieldCheck, label: "อนุมัติผล QC", path: "/qc-approval" },
  { icon: ShieldCheck, label: "อนุมัติผล Lab", path: "/lab-approval" },
  { icon: FlaskConical, label: "การทดสอบ QC", path: "/qc-testing" },
  { icon: FlaskConical, label: "การทดสอบ Lab", path: "/lab-testing" },
  { icon: Gauge, label: "ผล Density", path: "/density-results" },
  { icon: UserCheck, label: "Assign คำร้อง", path: "/petitions-old/assign" },
  { icon: Package, label: "Stock Management", path: "/stock" },
  { icon: Database, label: "Master Item", path: "/master-items" },
  { icon: FlaskConical, label: "Simple Method", path: "/simple-method" },
  { icon: Wrench, label: "รายการเครื่อง", path: "/machines" },
  { icon: Database, label: "Admin Data", path: "/admin-data" },
  { icon: SlidersHorizontal, label: "พารามิเตอร์ตรวจสอบ", path: "/parameter-settings" },
  { icon: LockKeyhole, label: "Access Control", path: "/access-control" },
  { icon: Settings, label: "ตั้งค่าระบบ", path: "/settings" },
];
```

- [ ] **Step 4: แก้ `navItems.ts` — PAGE_ITEMS (sub-routes → /petitions-old + เพิ่มหน้า list เก่า)**

```ts
export const PAGE_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  { icon: FileText, label: "รายการคำร้อง (เดิม)", path: "/petitions-old" },
  { icon: FileText, label: "New Petition", path: "/petitions-old/new" },
  { icon: FileText, label: "Petition Detail", path: "/petitions-old/:id" },
  { icon: Pencil, label: "Edit Petition", path: "/petitions-old/:id/edit" },
  { icon: ClipboardList, label: "Analysis Result Detail", path: "/record-results/:id" },
  { icon: ClipboardList, label: "รายละเอียดผล Lab", path: "/lab-results/:id" },
  { icon: ScanLine, label: "Scanner", path: "/scanner" },
  { icon: FlaskConical, label: "QC Testing Detail", path: "/qc-testing/:id" },
  { icon: FlaskConical, label: "Lab Testing Detail", path: "/lab-testing/:id" },
  { icon: Monitor, label: "Lab Queue TV", path: "/queue/lab" },
  { icon: Monitor, label: "QC Queue TV", path: "/queue/qc" },
];
```

- [ ] **Step 5: รัน navItems test → pass**

Run: `npx vitest run src/lib/navItems.test.ts`
Expected: PASS

- [ ] **Step 6: แก้ test `accessControl.test.ts` — describe "implied sub-pages"**

แทน `navGroups` (บรรทัด 91-96) และ 3 เคสที่อ้าง `/petitions`/`/petition-timeline`:

```ts
    const navGroups = [
      { id: "petitions", paths: ["/petition"] },
      { id: "results", paths: ["/record-results"] },
      { id: "lab", paths: ["/petitions-old/assign", "/lab-testing"] },
      { id: "others", paths: [] },
    ];

    it("grants the classic petition detail page when /petition is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/petition"] };
      expect(userCanAccessPath(user, "/petitions-old/123", navGroups)).toBe(true);
    });

    it("grants new/edit petition sub-pages when /petition is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/petition"] };
      expect(userCanAccessPath(user, "/petitions-old/new", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/petitions-old/123/edit", navGroups)).toBe(true);
    });

    it("grants sub-pages through a legacy group-id entry", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["petitions"] };
      expect(userCanAccessPath(user, "/petitions-old/123", navGroups)).toBe(true);
    });

    it("does NOT grant /petitions-old/assign (a separately-managed nav page) via /petition", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/petition"] };
      expect(userCanAccessPath(user, "/petitions-old/assign", navGroups)).toBe(false);
    });

    it("does NOT grant /petitions-old/assign through the dynamic petition detail route", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/petitions-old/:id"] };
      expect(userCanAccessPath(user, "/petitions-old/assign", navGroups)).toBe(false);
    });

    it("grants the lab testing detail page when /lab-testing is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/lab-testing"] };
      expect(userCanAccessPath(user, "/lab-testing/abc", navGroups)).toBe(true);
    });

    it("grants the petition timeline detail page when /petition is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/petition"] };
      expect(userCanAccessPath(user, "/petition/abc", navGroups)).toBe(true);
    });

    it("grants result detail from /record-results without granting petition detail", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/record-results"] };
      expect(userCanAccessPath(user, "/record-results/abc", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/petitions-old/abc", navGroups)).toBe(false);
    });

    it("'others' does not grant a sub-page already covered by its parent's group", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["others"] };
      expect(userCanAccessPath(user, "/petitions-old/123", navGroups)).toBe(false);
    });
```

> หมายเหตุ: fixture `groups` ด้านบนสุดของไฟล์ (บรรทัด 4-8) ที่มี `/petitions`, `/petitions/:id`
> เป็น fixture ทดสอบ "กลไก" pattern-matching (เคสบรรทัด 16-84, 167-201) ไม่ผูกกับ nav จริง —
> **ปล่อยไว้ไม่ต้องแก้** (ยังเขียว เพราะ `/petitions/123` ไม่ใช่ nav page แล้ว)

- [ ] **Step 7: รัน accessControl test → fail**

Run: `npx vitest run src/lib/accessControl.test.ts`
Expected: FAIL (IMPLIED_CHILD_PATHS ยังใช้ key เดิม)

- [ ] **Step 8: แก้ `accessControl.ts` — IMPLIED_CHILD_PATHS**

แทน block บรรทัด 16-38 (คงคอมเมนต์เดิม) — ลบ key `/petitions` และ `/petition-timeline` รวมเป็น `/petition`:

```ts
const IMPLIED_CHILD_PATHS: Record<string, string[]> = {
  "/petition": [
    "/petition/:id",
    "/petitions-old",
    "/petitions-old/new",
    "/petitions-old/production/new",
    "/petitions-old/ProductionIntegrationPetitionNewPage",
    "/petitions-old/:id",
    "/petitions-old/:id/edit",
  ],
  "/record-results": ["/record-results/:id"],
  "/qc-testing": ["/qc-testing/:id"],
  "/qc-approval": ["/qc-approval/:id"],
  "/lab-testing": ["/lab-testing/:id"],
  "/daily-check": [
    "/daily-check/environment",
    "/daily-check/balance",
    "/daily-check/sample-prep",
    "/daily-check/analysis",
    "/daily-check/extraction",
    "/daily-check/records",
    "/daily-check/documents",
  ],
};
```

- [ ] **Step 9: รัน accessControl test → pass**

Run: `npx vitest run src/lib/accessControl.test.ts`
Expected: PASS

- [ ] **Step 10: แก้ test `accessNav.test.ts` (แมป permission → NAV_ITEMS จริง)**

สองเคสนี้ป้อน `/petitions` เป็น permission แล้วคาดว่าออกมาเป็น nav — เปลี่ยนเป็น `/petition`:

เคส 1 (บรรทัด 6-18):
```ts
    const items = getAccessibleNavItemsForRoles(["lab", "qc"], {
      groups: [{ id: "work", paths: ["/petition", "/lab-testing"] }],
      permissions: {
        lab: ["work"],
        qc: ["/petition", "/qc-testing"],
      },
    });

    expect(items.map((item) => item.path)).toEqual([
      "/petition",
      "/qc-testing",
      "/lab-testing",
    ]);
```
เคส 2 (บรรทัด 22-27):
```ts
    const items = getAccessibleNavItemsForRoles(["viewer"], {
      groups: [],
      permissions: { viewer: ["/home", "/petition"] },
    });

    expect(items.map((item) => item.path)).toEqual(["/petition"]);
```

- [ ] **Step 11: แก้ test `accessDerive.test.ts` (บรรทัด 72-74)**

```ts
    const mods = accessibleModules({ r: ["g-qc", "/petition", "g-qc"] }, "r", groups);
    expect(mods).toContain("QC");
    expect(mods).toContain("รายการคำร้อง"); // NAV_ITEMS label for /petition
```

- [ ] **Step 12: รัน 4 ไฟล์ test ของ Task นี้ → pass ทั้งหมด**

Run: `npx vitest run src/lib/navItems.test.ts src/lib/accessControl.test.ts src/lib/accessNav.test.ts src/lib/accessDerive.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 13: Commit**

```bash
git add src/lib/navItems.ts src/lib/navItems.test.ts src/lib/accessControl.ts src/lib/accessControl.test.ts src/lib/accessNav.test.ts src/lib/accessDerive.test.ts
git commit -m "feat: nav + access-control for /petition primary list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: App routes + Timeline pages

**Files:**
- Modify: `src/App.tsx:145-155` (petition route block)
- Modify: `src/pages/PetitionTimelinePage.tsx`
- Test: `src/pages/PetitionTimelinePage.test.tsx`
- Modify: `src/pages/PetitionTimelineDetailPage.tsx:426`
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx:98-99`
- Test: `src/pages/PetitionListPage.actions.test.tsx:157,161`

**Interfaces:**
- Consumes: PetitionTimelinePage/DetailPage components (ไม่เปลี่ยน API)
- Produces: route `/petition`, `/petition/:id`, `/petitions-old`, `/petitions-old/assign|new|production/new|:id|:id/edit`

- [ ] **Step 1: แก้ test `PetitionTimelinePage.test.tsx` (บรรทัด 20, 23)**

```ts
    expect(mocks.props).toMatchObject({
      title: "รายการคำร้อง",
      description: "เลือกคำร้องเพื่อติดตามเวลา ความคืบหน้า กิจกรรม และเอกสาร",
    });
    expect((mocks.props as { petitionDetailPath: (petition: { _id: string }) => string }).petitionDetailPath({ _id: "petition-1" })).toBe("/petition/petition-1");
```

และแก้ชื่อ `it(...)` เป็น `"uses the petition list with รายการคำร้อง copy and timeline detail destinations"`

- [ ] **Step 2: รัน → fail**

Run: `npx vitest run src/pages/PetitionTimelinePage.test.tsx`
Expected: FAIL

- [ ] **Step 3: แก้ `PetitionTimelinePage.tsx`**

```tsx
import PetitionListPage from "./PetitionListPage";

export default function PetitionTimelinePage() {
  return (
    <PetitionListPage
      title="รายการคำร้อง"
      description="เลือกคำร้องเพื่อติดตามเวลา ความคืบหน้า กิจกรรม และเอกสาร"
      petitionDetailPath={(petition) => `/petition/${petition._id}`}
    />
  );
}
```

- [ ] **Step 4: รัน → pass**

Run: `npx vitest run src/pages/PetitionTimelinePage.test.tsx`
Expected: PASS

- [ ] **Step 5: แก้ test `PetitionTimelineDetailPage.test.tsx` (บรรทัด 98-99)**

```tsx
    <MemoryRouter initialEntries={["/petition/petition-1"]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes><Route path="/petition/:id" element={<PetitionTimelineDetailPage />} /></Routes>
```

- [ ] **Step 6: รัน → pass** (route ในไฟล์ test อัปเดตแล้ว; back-button ยังไม่ได้แตะ)

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS (ไฟล์ test เดิมไม่ได้เช็คปุ่ม back — Step 7 เป็นการแก้ให้สอดคล้อง route ใหม่ ตรวจจริงใน Task 7 runtime)

- [ ] **Step 7: แก้ `PetitionTimelineDetailPage.tsx:426`** — back button

เปลี่ยน `onBack={() => navigate("/petition-timeline")}` เป็น `onBack={() => navigate("/petition")}`

- [ ] **Step 8: รัน → pass**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS

- [ ] **Step 9: แก้ test `PetitionListPage.actions.test.tsx` (บรรทัด 157, 161)**

```tsx
    renderPage({ petitionDetailPath: (petition) => `/petition/${petition._id}` });

    fireEvent.click(await screen.findByText('P-2607-0001'));

    expect(screen.getByTestId('location')).toHaveTextContent('/petition/P-2607-0001');
```

- [ ] **Step 10: แก้ `App.tsx` — petition route block (แทนบรรทัด 145-147 และ 150-155)**

แทน 2 บรรทัด `/petitions` + `/petition-timeline` (145-147) และ block sub-routes (150-155) ด้วย:

```tsx
              <Route path="/petitions-old" element={<PrivateRoute><PetitionListPage /></PrivateRoute>} />
              <Route path="/petition" element={<PrivateRoute><PetitionTimelinePage /></PrivateRoute>} />
              <Route path="/petition/:id" element={<PrivateRoute><PetitionTimelineDetailPage /></PrivateRoute>} />
              <Route path="/adutuilog" element={<PrivateRoute><PetitionAuditLogPage /></PrivateRoute>} />
              <Route path="/auditlog" element={<PrivateRoute><PetitionAuditLogPage /></PrivateRoute>} />
              <Route path="/petitions-old/assign" element={<PrivateRoute><PetitionAssignPage /></PrivateRoute>} />
              <Route path="/petitions-old/new" element={<PrivateRoute><PetitionNewPage /></PrivateRoute>} />
              <Route path="/petitions-old/production/new" element={<PrivateRoute><ProductionIntegrationPetitionNewPage /></PrivateRoute>} />
              <Route path="/petitions-old/ProductionIntegrationPetitionNewPage" element={<ProductionIntegrationPetitionNewPage />} />
              <Route path="/petitions-old/:id" element={<PrivateRoute><PetitionDetailPage /></PrivateRoute>} />
              <Route path="/petitions-old/:id/edit" element={<PrivateRoute><PetitionEditPage /></PrivateRoute>} />
```

> ต้องคงลำดับ: `assign`, `new`, `production/new`, `ProductionIntegration...` ก่อน `:id` (กัน param กลืน).
> บรรทัด `/adutuilog`, `/auditlog` เดิมอยู่ระหว่าง block นี้ — วางไว้ตำแหน่งเดิมได้ (ไม่กระทบ)

- [ ] **Step 11: Type-check + รัน test ที่เกี่ยว**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ในไฟล์ที่แก้ (เทียบกับ baseline ~12 latent)

Run: `npx vitest run src/pages/PetitionTimelinePage.test.tsx src/pages/PetitionTimelineDetailPage.test.tsx src/pages/PetitionListPage.actions.test.tsx`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/App.tsx src/pages/PetitionTimelinePage.tsx src/pages/PetitionTimelinePage.test.tsx src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx src/pages/PetitionListPage.actions.test.tsx
git commit -m "feat: route /petition (list) + /petitions-old/* (classic pages)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Dashboard & summary links → /petition

**Files:**
- Modify: `src/lib/dashboardProfiles.ts:44-69` (KPI_META)
- Modify: `src/lib/execSummary.ts:70-72`
- Test: `src/lib/execSummary.test.ts:46-54`
- Modify: `src/pages/RoleDashboard.tsx:101-107,397`
- Modify: `src/components/lis/PetitionDashboardTable.tsx:48-49`
- Modify: `src/components/lis/WaitingSamplesCard.tsx:31,59,80`

- [ ] **Step 1: แก้ test `execSummary.test.ts` (บรรทัด 48, 52)**

```ts
    expect(highlightPath(["a", "b"])).toBe("/petition?highlight=a,b");
```
```ts
    expect(highlightPath([])).toBe("/petition");
```

- [ ] **Step 2: รัน → fail**

Run: `npx vitest run src/lib/execSummary.test.ts`
Expected: FAIL

- [ ] **Step 3: แก้ `execSummary.ts:71`**

```ts
export function highlightPath(ids: string[]): string {
  return ids.length ? `/petition?highlight=${ids.join(",")}` : "/petition";
}
```

- [ ] **Step 4: รัน → pass**

Run: `npx vitest run src/lib/execSummary.test.ts`
Expected: PASS

- [ ] **Step 5: แก้ `dashboardProfiles.ts` KPI_META** — เปลี่ยนทีละบรรทัด:

- L46: `drilldownPath: "/petitions"` → `drilldownPath: "/petition"`
- L47: `"/petitions?status=inProgress"` → `"/petition?status=inProgress"`
- L48: `"/petitions?status=sampleSent"` → `"/petition?status=sampleSent"`
- L49: `"/petitions/assign"` → `"/petitions-old/assign"`
- L50: `"/petitions?status=pendingReview"` → `"/petition?status=pendingReview"`
- L52: `"/petitions?status=success"` → `"/petition?status=success"`
- L56: `drilldownPath: "/petitions"` → `drilldownPath: "/petition"`
- L57: `drilldownPath: "/petitions"` → `drilldownPath: "/petition"`
- L58: `drilldownPath: "/petitions"` → `drilldownPath: "/petition"`
- L65: `drilldownPath: "/petitions"` → `drilldownPath: "/petition"`

- [ ] **Step 6: แก้ `RoleDashboard.tsx`** — LAB_HEAD_ACTION_PATH_PREFIX (บรรทัด 102-106) + fallback (397)

L102: `all: "/petitions",` → `all: "/petition",`
L103: `waitingReceive: "/petitions",` → `waitingReceive: "/petition",`
L104: `pendingAssign: "/petitions",` → `pendingAssign: "/petition",`
L106: `completedToday: "/petitions",` → `completedToday: "/petition",`
L397: `... : isQcStaff ? "/qc-testing" : "/petitions"` → `... : isQcStaff ? "/qc-testing" : "/petition"`

- [ ] **Step 7: แก้ `PetitionDashboardTable.tsx` (บรรทัด 48-49)** — default props

```tsx
  actionPathPrefix = "/petition",
  viewAllPath = "/petition",
```

- [ ] **Step 8: แก้ `WaitingSamplesCard.tsx` (บรรทัด 31, 59, 80)**

- L31: `navigate("/petitions?status=sampleSent")` → `navigate("/petition?status=sampleSent")`
- L59: `navigate(\`/petitions/${petition._id}\`)` → `navigate(\`/petition/${petition._id}\`)` (dashboard row → timeline detail)
- L80: `navigate("/petitions?status=sampleSent")` → `navigate("/petition?status=sampleSent")`

- [ ] **Step 9: Type-check + รัน test dashboard**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

Run: `npx vitest run src/lib/execSummary.test.ts src/pages/RoleDashboard.test.tsx src/components/dashboard`
Expected: PASS (ถ้าไฟล์ไหน assert path เดิม ให้แก้เป็น `/petition` แบบเดียวกัน)

- [ ] **Step 10: Commit**

```bash
git add src/lib/dashboardProfiles.ts src/lib/execSummary.ts src/lib/execSummary.test.ts src/pages/RoleDashboard.tsx src/components/lis/PetitionDashboardTable.tsx src/components/lis/WaitingSamplesCard.tsx
git commit -m "feat: repoint dashboard/summary list links to /petition

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Petition page navigations

ลิงก์ **list** (ปุ่มย้อนกลับ/after-save) → `/petition`; ลิงก์ **detail/new/edit/assign classic** → `/petitions-old/*`

**Files:**
- Modify: `src/pages/PetitionDetailPage.tsx:226,289,300,350,440,449`
- Modify: `src/pages/PetitionListPage.tsx:407`
- Modify: `src/pages/PetitionEditPage.tsx:277,308`
- Modify: `src/pages/PetitionAssignPage.tsx:732,750`
- Modify: `src/pages/PetitionAuditLogPage.tsx:218`
- Modify: `src/pages/QCTestingDetailPage.tsx:1060`
- Modify: `src/pages/AdminData.tsx:296`
- Modify: `src/pages/petitions/ProductionPetitionNewPage.tsx:612,621,645,803,817`

- [ ] **Step 1: แก้ `PetitionDetailPage.tsx`**

- L226: `navigate('/petitions', { replace: true })` → `navigate('/petition', { replace: true })` (list)
- L289: `navigate(\`/petitions/new?revisionOf=${data._id}\`)` → `navigate(\`/petitions-old/new?revisionOf=${data._id}\`)`
- L300: `navigate(isResultMode ? '/record-results' : '/petitions')` → `navigate(isResultMode ? '/record-results' : '/petition')` (list)
- L350: `navigate(\`/petitions/${data._id}/edit\`)` → `navigate(\`/petitions-old/${data._id}/edit\`)`
- L440: `navigate('/petitions/assign')` → `navigate('/petitions-old/assign')`
- L449: `navigate(\`/petitions/${data._id}/edit\`)` → `navigate(\`/petitions-old/${data._id}/edit\`)`

- [ ] **Step 2: แก้ `PetitionListPage.tsx:407`**

`navigate('/petitions/new')` → `navigate('/petitions-old/new')`

- [ ] **Step 3: แก้ `PetitionEditPage.tsx` (277, 308)**

- L277: `navigate(\`/petitions/${id}\`)` → `navigate(\`/petitions-old/${id}\`)`
- L308: `onBack={() => navigate(\`/petitions/${id}\`)}` → `navigate(\`/petitions-old/${id}\`)`

- [ ] **Step 4: แก้ `PetitionAssignPage.tsx` (732, 750)**

ทั้งสอง: `onPetitionClick={(id) => navigate(\`/petitions/${id}\`)}` → `navigate(\`/petitions-old/${id}\`)`

- [ ] **Step 5: แก้ `PetitionAuditLogPage.tsx:218`**

`navigate(\`/petitions/${entry.petitionId}\`)` → `navigate(\`/petitions-old/${entry.petitionId}\`)`

- [ ] **Step 6: แก้ `QCTestingDetailPage.tsx:1060`**

`navigate(\`/petitions/${implicitPredecessorNo}\`)` → `navigate(\`/petitions-old/${implicitPredecessorNo}\`)`

- [ ] **Step 7: แก้ `AdminData.tsx:296`**

`navigate(\`/petitions/${entry.petitionId}\`)` → `navigate(\`/petitions-old/${entry.petitionId}\`)`

- [ ] **Step 8: แก้ `ProductionPetitionNewPage.tsx` (612,621,645,803,817)**

- L612,621,645,817: `navigate('/petitions')` → `navigate('/petition')` (list หลัง cancel/error/save)
- L803: `navigate(\`/petitions/${created._id}\`)` → `navigate(\`/petitions-old/${created._id}\`)` (ไปดู detail classic ที่เพิ่งสร้าง)

- [ ] **Step 9: Type-check + grep ยืนยันไม่มีลิงก์หน้าเว็บ `/petitions` ตกค้าง**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

Run (grep): `rg -n "['\"\`]/petitions(['\"?/\`]|$)" src --glob '!src/lib/api.ts' --glob '!src/hooks/usePetition.ts' --glob '!**/*.test.ts' --glob '!**/*.test.tsx'`
Expected: เหลือเฉพาะ `/petitions-old...` เท่านั้น (ไม่มี `/petitions` เดี่ยว หรือ `/petitions/` ที่ไม่ตามด้วย -old) — ถ้าเจอให้แก้
(ยกเว้น test fixture ที่เป็น MemoryRouter `initialEntries` สมมติ — ปล่อยไว้ได้ จึง exclude `*.test.*`)

- [ ] **Step 10: Commit**

```bash
git add src/pages/PetitionDetailPage.tsx src/pages/PetitionListPage.tsx src/pages/PetitionEditPage.tsx src/pages/PetitionAssignPage.tsx src/pages/PetitionAuditLogPage.tsx src/pages/QCTestingDetailPage.tsx src/pages/AdminData.tsx src/pages/petitions/ProductionPetitionNewPage.tsx
git commit -m "feat: repoint petition detail/edit links to /petitions-old, list links to /petition

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Backend default groups + backfill + seed

**สำคัญ:** backfill (accessControl.js บรรทัด 153) รันทุก boot — ถ้าไม่เปลี่ยน candidate จาก
`/petition-timeline` เป็น `/petition` มันจะ **เติม `/petition-timeline` กลับเข้า group** หลัง migrate

**Files:**
- Modify: `server/routes/accessControl.js:26,29,153-163`
- Test: `server/lib/accessGroups.test.js:40-63`
- Modify: `server/seed-access-control.js:23,31,33`

- [ ] **Step 1: แก้ test `accessGroups.test.js` (บรรทัด 40-63)**

```js
test('findOrphanBackfillPaths detects petition list paths only when unclaimed', () => {
  const groups = [{ id: 'samples', paths: ['/petitions-old'] }];
  assert.deepStrictEqual(findOrphanBackfillPaths(groups, ['/petition', '/petition/:id']), [
    '/petition',
    '/petition/:id',
  ]);
});

test('findOrphanBackfillPaths adds only the missing list detail path', () => {
  const groups = [{ id: 'samples', paths: ['/petition'] }];
  assert.deepStrictEqual(findOrphanBackfillPaths(groups, ['/petition', '/petition/:id']), [
    '/petition/:id',
  ]);
});

test('findGroupForBackfill prefers the anchor path owner and falls back to a group id', () => {
  const groups = [
    { id: 'legacy-home', paths: ['/home', '/petition'] },
    { id: 'stock', paths: ['/stock'] },
    { id: 'samples', paths: ['/physical-inspection'] },
  ];
  assert.strictEqual(findGroupForBackfill(groups, 'samples', '/petition'), 'legacy-home');
  assert.strictEqual(findGroupForBackfill(groups, 'stock', '/missing-anchor'), 'stock');
});
```

- [ ] **Step 2: รัน → fail**

Run: `node --test server/lib/accessGroups.test.js`
Expected: FAIL (2 เคสแรกยัง assert `/petition-timeline`)

> `accessGroups.js` เป็น helper generic (รับ candidatePaths เป็น argument) — **ไม่ต้องแก้** logic
> ตัวมันเอง test ผ่านได้ทันทีที่ปรับ fixture เพราะ helper ไม่ hardcode timeline path

- [ ] **Step 3: รัน → pass** (ยืนยัน helper ไม่ต้องแก้)

Run: `node --test server/lib/accessGroups.test.js`
Expected: PASS

- [ ] **Step 4: แก้ `accessControl.js` DEFAULT_GROUPS (บรรทัด 26, 29)**

L26 (samples):
```js
  { id: 'samples', name: 'งานตัวอย่าง', description: 'รับ ส่ง และตรวจกายภาพตัวอย่าง', paths: ['/petition', '/petition/:id', '/petitions-old', '/petitions-old/new', '/petitions-old/production/new', '/petitions-old/ProductionIntegrationPetitionNewPage', '/petitions-old/:id', '/petitions-old/:id/edit', '/physical-inspection'], locked: false, sortOrder: 20 },
```
L29 (qc):
```js
  { id: 'qc', name: 'ควบคุมคุณภาพ', description: 'อนุมัติหรือปฏิเสธผลและ Assign คำร้อง', paths: ['/dashboard/qc', '/qc-approval', '/petitions-old/assign', '/petitions-old/:id'], locked: false, sortOrder: 40 },
```

- [ ] **Step 5: แก้ `accessControl.js` backfill (บรรทัด 153-163)**

```js
  const petitionListPaths = findOrphanBackfillPaths(existingGroups, ['/petition', '/petition/:id']);
  const petitionListGroupId = findGroupForBackfill(existingGroups, 'samples', '/petition');
  if (petitionListPaths.length && petitionListGroupId) {
    await AccessGroup.updateOne(
      { id: petitionListGroupId },
      { $addToSet: { paths: { $each: petitionListPaths } } },
    );
  }
```

- [ ] **Step 6: แก้ `seed-access-control.js` (บรรทัด 23, 31, 33)**

- L23: `'/petitions/assign'` → `'/petitions-old/assign'` (ใน paths ของ group lab)
- L31: `'/petitions/assign'` → `'/petitions-old/assign'` (ใน permissions ของ role lab)
- L33: `'/petitions'` → `'/petition'` (ใน permissions ของ role viewer — ให้เห็น list หลักที่มองเห็น)

- [ ] **Step 7: รัน backend test อีกครั้ง + ยืนยันไม่มี frontend path ตกค้างใน server**

Run: `node --test server/lib/accessGroups.test.js`
Expected: PASS

Run (grep): `rg -n "/petition-timeline|['\"]/petitions['\"]|/petitions/" server/routes/accessControl.js server/seed-access-control.js`
Expected: ไม่เจอ (เหลือเฉพาะ `/petition`, `/petition/:id`, `/petitions-old/*`)

> API mount `mountApi('/petitions', ...)` ใน `server/index.js` **ต้องยังอยู่** — นั่นคือ REST endpoint

- [ ] **Step 8: Commit**

```bash
git add server/routes/accessControl.js server/lib/accessGroups.test.js server/seed-access-control.js
git commit -m "feat: backend default groups + backfill use /petition scheme

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: DB migration script

migrate `Role.permissions[]` (collection `roles`) + `AccessGroup.paths[]` (collection `accessgroups`)
ตาม rename map — idempotent, dry-run เป็นค่าเริ่มต้น

**Files:**
- Create: `server/scripts/rename-petition-paths.js`
- Create: `server/scripts/rename-petition-paths.test.js`

**Interfaces:**
- Produces: `renamePath(entry: string): string`, `renamePaths(arr: string[]): string[]` (exported)

- [ ] **Step 1: เขียน test `rename-petition-paths.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const { renamePath, renamePaths } = require('./rename-petition-paths');

test('renames the bare list path', () => {
  assert.strictEqual(renamePath('/petitions'), '/petition');
});

test('renames the timeline list + detail to /petition', () => {
  assert.strictEqual(renamePath('/petition-timeline'), '/petition');
  assert.strictEqual(renamePath('/petition-timeline/:id'), '/petition/:id');
});

test('renames /petitions sub-routes to /petitions-old', () => {
  assert.strictEqual(renamePath('/petitions/assign'), '/petitions-old/assign');
  assert.strictEqual(renamePath('/petitions/new'), '/petitions-old/new');
  assert.strictEqual(renamePath('/petitions/:id'), '/petitions-old/:id');
  assert.strictEqual(renamePath('/petitions/:id/edit'), '/petitions-old/:id/edit');
});

test('leaves group ids and unrelated paths untouched', () => {
  assert.strictEqual(renamePath('samples'), 'samples');
  assert.strictEqual(renamePath('others'), 'others');
  assert.strictEqual(renamePath('/report'), '/report');
  assert.strictEqual(renamePath('deny:/report/oee'), 'deny:/report/oee');
});

test('is idempotent (re-running does not double-rename)', () => {
  assert.strictEqual(renamePath('/petition'), '/petition');
  assert.strictEqual(renamePath('/petitions-old/:id'), '/petitions-old/:id');
  assert.strictEqual(renamePath('/petition/:id'), '/petition/:id');
});

test('renamePaths maps and dedupes preserving order', () => {
  assert.deepStrictEqual(renamePaths(['/petitions', '/petition-timeline']), ['/petition']);
  assert.deepStrictEqual(
    renamePaths(['/petitions/:id', '/petitions', '/petition-timeline/:id']),
    ['/petitions-old/:id', '/petition', '/petition/:id'],
  );
});

test('renamePaths tolerates null/undefined', () => {
  assert.deepStrictEqual(renamePaths(null), []);
  assert.deepStrictEqual(renamePaths(undefined), []);
});
```

- [ ] **Step 2: รัน → fail** (module ยังไม่มี)

Run: `node --test server/scripts/rename-petition-paths.test.js`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: เขียน `rename-petition-paths.js`**

```js
// Migrate access-control paths after the /petition rename:
//   /petitions          -> /petition            (main list moved to timeline)
//   /petition-timeline   -> /petition
//   /petition-timeline/* -> /petition/*
//   /petitions/*         -> /petitions-old/*     (classic pages, hidden)
// Targets Role.permissions[] (collection `roles`) and AccessGroup.paths[]
// (collection `accessgroups`). Idempotent — safe to re-run.
//
// Usage:
//   node scripts/rename-petition-paths.js          # dry-run (พิมพ์ diff อย่างเดียว)
//   node scripts/rename-petition-paths.js --commit  # เขียนจริง
'use strict';

const mongoose = require('mongoose');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

function renamePath(entry) {
  if (typeof entry !== 'string') return entry;
  if (entry === '/petitions') return '/petition';
  if (entry === '/petition-timeline') return '/petition';
  if (entry.startsWith('/petition-timeline/')) {
    return '/petition/' + entry.slice('/petition-timeline/'.length);
  }
  if (entry.startsWith('/petitions/')) {
    return '/petitions-old/' + entry.slice('/petitions/'.length);
  }
  return entry;
}

function renamePaths(arr) {
  const out = [];
  const seen = new Set();
  for (const entry of arr || []) {
    const renamed = renamePath(entry);
    if (!seen.has(renamed)) {
      seen.add(renamed);
      out.push(renamed);
    }
  }
  return out;
}

async function migrateCollection(colName, field) {
  const col = mongoose.connection.collection(colName);
  const docs = await col.find({}).toArray();
  let changed = 0;
  for (const doc of docs) {
    const before = doc[field] || [];
    const after = renamePaths(before);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changed += 1;
      console.log(`  ${colName}/${doc.id || doc._id}:`);
      console.log(`    - ${JSON.stringify(before)}`);
      console.log(`    + ${JSON.stringify(after)}`);
      if (COMMIT) {
        await col.updateOne({ _id: doc._id }, { $set: { [field]: after } });
      }
    }
  }
  return changed;
}

async function main() {
  await mongoose.connect(URI);
  console.log(COMMIT ? 'COMMIT mode — เขียนจริง' : 'DRY-RUN — ยังไม่เขียน (ใส่ --commit เพื่อเขียนจริง)');
  const roles = await migrateCollection('roles', 'permissions');
  const groups = await migrateCollection('accessgroups', 'paths');
  console.log(`roles ที่ต้องแก้: ${roles}, accessgroups ที่ต้องแก้: ${groups}`);
  if (COMMIT) {
    console.log('เสร็จ. รัน `npm run seed:export` เพื่อ backup ลง git');
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { renamePath, renamePaths };
```

- [ ] **Step 4: รัน → pass**

Run: `node --test server/scripts/rename-petition-paths.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Dry-run กับ DB (local ถ้ามี)**

Run: `cd server && node scripts/rename-petition-paths.js`
Expected: พิมพ์ diff ของ roles/accessgroups ที่จะเปลี่ยน โดยไม่เขียน (ถ้าไม่มี local DB จะ error connect — ข้ามได้ ให้ผู้ใช้รันบน prod)

- [ ] **Step 6: Commit**

```bash
git add server/scripts/rename-petition-paths.js server/scripts/rename-petition-paths.test.js
git commit -m "feat: DB migration script for /petition path rename

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Final verification sweep

- [ ] **Step 1: grep ยืนยันไม่มี frontend route `/petitions` (ที่ไม่ใช่ API / ไม่ใช่ -old) ตกค้าง**

Run: `rg -n "/petition-timeline" src`
Expected: ไม่เจอ (0 ผลลัพธ์ — refs ทั้งหมดใน src ถูกอัปเดตแล้วใน Task 1-2)

Run: `rg -n "['\"\`]/petitions(['\"?/\`]|$)" src --glob '!src/lib/api.ts' --glob '!src/hooks/usePetition.ts' --glob '!**/*.test.ts' --glob '!**/*.test.tsx'`
Expected: เหลือเฉพาะ `/petitions-old...` — ไม่มี `/petitions` เดี่ยว หรือ `/petitions/` (ไม่ใช่ -old)

> ถ้าเจอใน `src/lib/api.ts` หรือ `src/hooks/usePetition.ts` ถือว่าถูกต้อง (API) — อย่าแก้
> test fixture (`*.test.*`) ที่ใช้ `/petitions` เป็น URL สมมติใน MemoryRouter ปล่อยได้ (ไม่กระทบ runtime)

- [ ] **Step 2: Full FE test suite**

Run: `npm run test`
Expected: PASS ทั้งหมด (ถ้ามี test ตกที่ assert path เดิม ให้แก้เป็น scheme ใหม่แล้วรันซ้ำ)

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: error เท่ากับ baseline (~12 latent) — ไม่มี error ใหม่ในไฟล์ที่แก้

- [ ] **Step 4: Backend tests**

Run: `node --test server/lib/accessGroups.test.js server/scripts/rename-petition-paths.test.js`
Expected: PASS

- [ ] **Step 5: ตรวจ runtime จริง (verify skill)**

รัน dev (frontend + `cd server && npm run dev`) แล้วลอง:
- sidebar โชว์ "รายการคำร้อง" ชี้ `/petition` (คลิกแถว → `/petition/:id` timeline detail)
- ไม่มี nav "Timeline คำร้อง" / "รายการคำร้อง" ตัวเก่าที่ชี้ `/petitions`
- เปิด `/petitions-old` ตรงๆ ได้ (หน้า list เดิม) และ `/petitions-old/:id` (classic detail) ทำงาน
- drilldown จากแดชบอร์ด + ปุ่มย้อนกลับหลังลบ/บันทึก ไป `/petition` ไม่ 404

- [ ] **Step 6: Commit (ถ้ามีการแก้ stragglers)**

```bash
git add -A
git commit -m "test: fix straggler path assertions after /petition rename

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## หลัง merge (ผู้ใช้ทำบน prod)

1. `cd server && node scripts/rename-petition-paths.js` — ดู diff (dry-run)
2. `node scripts/rename-petition-paths.js --commit` — เขียนจริง
3. `npm run seed:export` แล้ว commit `seed-data/` (auto-sync ก็จะทำให้เองในรอบถัดไป)
4. รีสตาร์ท server (boot จะ backfill `/petition`,`/petition/:id` ถ้ายังขาด — ไม่เติม `/petition-timeline` กลับ)

## Notes / ข้อจำกัดที่รู้

- Migration ไม่แปลง `deny:` token (เช่น `deny:/petitions...`) — ปัจจุบันไม่มี deny token สำหรับ petition
  (tabRegistry ใช้ deny กับ tab ใน `/report`, `/settings` เท่านั้น) จึงปลอดภัย ถ้าอนาคตมีให้ขยาย `renamePath`
- ไม่ทำ redirect `/petitions` → `/petition` (bare `/petitions` จะ 404) — ยอมรับได้เพราะลิงก์ภายใน repoint หมดแล้ว
