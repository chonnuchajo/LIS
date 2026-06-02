# Daily Check 5-Page Room Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single `/daily-check` page into a hub + four room pages (one per `Forms/` folder), moving the existing balance calibration into its room and scaffolding the other three.

**Architecture:** React Router nested routes under `/daily-check`. A shared `DailyCheckLayout` renders the app shell, page header, and a room tab strip (the "submenu"), with child pages in an `<Outlet/>`. A central `dailyCheckRooms.ts` config is the single source of truth. Room sub-routes ride along with the `/daily-check` permission via `IMPLIED_CHILD_PATHS`. No backend changes.

**Tech Stack:** React 18 + TypeScript, React Router DOM v6, Tailwind + shadcn/ui, Vitest + @testing-library/react.

Spec: `docs/superpowers/specs/2026-06-02-daily-check-rooms-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/dailyCheckRooms.ts` (create) | Room config: slug, route, label, icon, form list, `ready` flag |
| `src/lib/dailyCheckRooms.test.ts` (create) | Validates config invariants |
| `src/lib/accessControl.ts` (modify) | Add `/daily-check` → room paths to `IMPLIED_CHILD_PATHS` |
| `src/lib/accessControl.test.ts` (modify) | Tests for daily-check implied children |
| `src/pages/daily-check/DailyCheckLayout.tsx` (create) | Shell + PageHeader + room tab strip + `<Outlet/>` |
| `src/pages/daily-check/DailyCheckSummary.tsx` (create) | Hub: one card per room |
| `src/pages/daily-check/BalanceRoomPage.tsx` (create) | Existing calibration UI, moved verbatim |
| `src/pages/daily-check/RoomPlaceholderPage.tsx` (create) | Generic placeholder driven by slug prop |
| `src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx` (create) | Tab strip render + active-state smoke test |
| `src/pages/DailyCheck.tsx` (delete) | Replaced by the room pages |
| `src/App.tsx` (modify) | Nested routes; swap imports |
| `src/components/lis/AppSidebar.tsx` (modify) | Keep "Daily Check" highlighted on sub-routes |

`src/lib/navItems.ts` is **not** changed — the sidebar keeps a single `Daily Check` entry pointing at `/daily-check`.

---

### Task 1: Room config (`dailyCheckRooms.ts`)

**Files:**
- Create: `src/lib/dailyCheckRooms.ts`
- Test: `src/lib/dailyCheckRooms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/dailyCheckRooms.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  DAILY_CHECK_BASE,
  DAILY_CHECK_ROOMS,
  getRoomBySlug,
} from "./dailyCheckRooms";

describe("dailyCheckRooms", () => {
  it("defines exactly four rooms", () => {
    expect(DAILY_CHECK_ROOMS).toHaveLength(4);
  });

  it("has unique, non-empty slugs and labels", () => {
    const slugs = DAILY_CHECK_ROOMS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const room of DAILY_CHECK_ROOMS) {
      expect(room.slug).not.toBe("");
      expect(room.label).not.toBe("");
    }
  });

  it("derives each route as the base plus the slug", () => {
    for (const room of DAILY_CHECK_ROOMS) {
      expect(room.route).toBe(`${DAILY_CHECK_BASE}/${room.slug}`);
    }
  });

  it("marks only the balance room as ready", () => {
    const ready = DAILY_CHECK_ROOMS.filter((r) => r.ready);
    expect(ready.map((r) => r.slug)).toEqual(["balance"]);
  });

  it("looks up a room by slug and returns undefined for unknown slugs", () => {
    expect(getRoomBySlug("balance")?.label).toBe("ห้องเครื่องชั่ง");
    expect(getRoomBySlug("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- dailyCheckRooms`
Expected: FAIL — cannot resolve `./dailyCheckRooms`.

- [ ] **Step 3: Write the config**

Create `src/lib/dailyCheckRooms.ts`:

```ts
import { Beaker, FlaskConical, Microscope, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DailyCheckRoom {
  /** URL segment under /daily-check */
  slug: string;
  /** Full route path */
  route: string;
  /** Thai room name (matches the Forms/ folder) */
  label: string;
  icon: LucideIcon;
  /** Form names shown as a faint "coming soon" preview on placeholder pages */
  forms: string[];
  /** true once the room has real content; false while it is a placeholder */
  ready: boolean;
}

export const DAILY_CHECK_BASE = "/daily-check";

const room = (
  slug: string,
  label: string,
  icon: LucideIcon,
  forms: string[],
  ready = false,
): DailyCheckRoom => ({
  slug,
  route: `${DAILY_CHECK_BASE}/${slug}`,
  label,
  icon,
  forms,
  ready,
});

export const DAILY_CHECK_ROOMS: DailyCheckRoom[] = [
  room(
    "balance",
    "ห้องเครื่องชั่ง",
    Scale,
    [
      "อุณหภูมิ/ความชื้น (ห้องชั่งสาร)",
      "Dry cabinet",
      "เครื่องชั่ง 2 ตำแหน่ง",
      "เครื่องชั่ง 4 ตำแหน่ง",
      "เครื่องชั่ง 5 ตำแหน่ง",
      "Hood",
    ],
    true,
  ),
  room("sample-prep", "ห้องเตรียมตัวอย่าง", Beaker, [
    "อุณหภูมิ/ความชื้น",
    "Ultrasonic / Ultrasonic Cleaner",
    "Asirator pump",
    "Desiccator",
    "Hotplate",
    "Magnetic stirrer",
    "Oven",
    "pH Meter",
    "Water bath",
    "milli-Q",
    "Hood",
    "Density",
  ]),
  room("analysis", "ห้องวิเคราะห์", Microscope, [
    "อุณหภูมิ/ความชื้น (ห้องวิเคราะห์)",
    "GC 7890A",
    "GC 8850",
    "GC 8890",
    "HPLC 1260 Infinity III",
    "HPLC Agilent 1260",
  ]),
  room("extraction", "ห้องสกัด", FlaskConical, [
    "Asirator pump",
    "Cooling",
    "Desiccator",
    "Heating mantle",
    "Magnetic stirrer",
  ]),
];

export const getRoomBySlug = (slug: string): DailyCheckRoom | undefined =>
  DAILY_CHECK_ROOMS.find((r) => r.slug === slug);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- dailyCheckRooms`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dailyCheckRooms.ts src/lib/dailyCheckRooms.test.ts
git commit -m "feat(daily-check): add room config (single source of truth)"
```

---

### Task 2: Access control — room sub-routes ride along with `/daily-check`

**Files:**
- Modify: `src/lib/accessControl.ts:14-18`
- Test: `src/lib/accessControl.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing test**

Append inside the top-level `describe("userCanAccessPath", ...)` block in `src/lib/accessControl.test.ts`, just before its closing `});` on line 128:

```ts
  describe("daily-check rooms", () => {
    const navGroups = [
      { id: "ops", paths: ["/daily-check"] },
      { id: "others", paths: [] },
    ];

    it("grants every room sub-page when /daily-check is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/daily-check"] };
      expect(userCanAccessPath(user, "/daily-check/balance", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/daily-check/sample-prep", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/daily-check/analysis", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/daily-check/extraction", navGroups)).toBe(true);
    });

    it("denies room sub-pages when /daily-check is not granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/report"] };
      expect(userCanAccessPath(user, "/daily-check/balance", navGroups)).toBe(false);
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- accessControl`
Expected: FAIL — `/daily-check/balance` returns false (no implied children yet).

- [ ] **Step 3: Add the implied children**

In `src/lib/accessControl.ts`, edit the `IMPLIED_CHILD_PATHS` object (lines 14-18) to add the `/daily-check` entry:

```ts
const IMPLIED_CHILD_PATHS: Record<string, string[]> = {
  "/petitions": ["/petitions/new", "/petitions/:id", "/petitions/:id/edit"],
  "/qc-testing": ["/qc-testing/:id"],
  "/lab-testing": ["/lab-testing/:id"],
  "/daily-check": [
    "/daily-check/balance",
    "/daily-check/sample-prep",
    "/daily-check/analysis",
    "/daily-check/extraction",
  ],
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- accessControl`
Expected: PASS (all existing + 2 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/accessControl.ts src/lib/accessControl.test.ts
git commit -m "feat(daily-check): grant room sub-routes via /daily-check permission"
```

---

### Task 3: Shared layout with room tab strip

**Files:**
- Create: `src/pages/daily-check/DailyCheckLayout.tsx`

- [ ] **Step 1: Create the layout**

Create `src/pages/daily-check/DailyCheckLayout.tsx`:

```tsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { cn } from "@/lib/utils";
import { DAILY_CHECK_BASE, DAILY_CHECK_ROOMS } from "@/lib/dailyCheckRooms";

const TABS = [
  { route: DAILY_CHECK_BASE, label: "สรุป", icon: LayoutDashboard },
  ...DAILY_CHECK_ROOMS.map((r) => ({ route: r.route, label: r.label, icon: r.icon })),
];

const DailyCheckLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <AppLayout title="Daily Check">
      <PageHeader
        className="mb-4"
        title="Daily Check"
        description="ตรวจเช็กประจำวันแยกตามห้องปฏิบัติการ"
      />

      <div
        role="tablist"
        aria-label="ห้องปฏิบัติการ"
        className="mb-6 flex flex-wrap gap-1.5 border-b border-border pb-3"
      >
        {TABS.map((tab) => {
          const active = pathname === tab.route;
          return (
            <button
              key={tab.route}
              role="tab"
              aria-selected={active}
              onClick={() => navigate(tab.route)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Outlet />
    </AppLayout>
  );
};

export default DailyCheckLayout;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (Full wiring happens in Task 7; the file compiles standalone.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/daily-check/DailyCheckLayout.tsx
git commit -m "feat(daily-check): add shared layout with room tab strip"
```

---

### Task 4: Balance room page (move existing calibration)

**Files:**
- Create: `src/pages/daily-check/BalanceRoomPage.tsx`
- Reference (copy from): `src/pages/DailyCheck.tsx`

The existing `src/pages/DailyCheck.tsx` body is moved here **verbatim** except: (a) drop the `AppLayout` and `PageHeader` imports/wrapper (the layout owns them now), (b) rename the component, (c) replace the outer wrapper with a local header that carries the room title + the two summary badges.

- [ ] **Step 1: Copy the file**

```bash
git mv src/pages/DailyCheck.tsx src/pages/daily-check/BalanceRoomPage.tsx
```

- [ ] **Step 2: Edit the imports**

In `src/pages/daily-check/BalanceRoomPage.tsx`, the current import block (old lines 1-15) keeps everything **except** remove these two lines:

```tsx
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
```

The remaining imports (`useMemo/useState`, react-query, the lucide icons, Button, Card, Input, Badge, Table, Tabs, Select, `toast`, `api`/`DailyCheckRecord`, `useAuth`) stay unchanged.

- [ ] **Step 3: Rename the component**

Change the declaration (old line 57) and the default export (old line 458):

```tsx
const BalanceRoomPage = () => {
```
```tsx
export default BalanceRoomPage;
```

- [ ] **Step 4: Replace the outer wrapper**

Old `return (` block opened with `<AppLayout title="Daily Check">` then a `<PageHeader ... actions={...}/>` then `<Tabs defaultValue="check" ...>`. Replace **only** the wrapper — from `return (` down to and including the `/>` that closes `<PageHeader ... />` (old lines 180-196) — with the following. Everything from `<Tabs defaultValue="check" className="space-y-4">` onward (old line 198) stays exactly as-is, and the final `</AppLayout>` (old line 454) becomes `</>`:

```tsx
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            ห้องเครื่องชั่ง — Calibrate เครื่องชั่ง
          </h2>
          <p className="text-sm text-muted-foreground">ประจำวัน — {todayLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="text-sm gap-1 py-1 px-3">
            <Clock className="w-3.5 h-3.5" /> ตรวจแล้ว {checkedCount}/{SCALES.length}
          </Badge>
          <Badge className="text-sm gap-1 py-1 px-3 bg-green-100 text-green-700 border-green-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> ผ่าน {passCount}/{SCALES.length}
          </Badge>
        </div>
      </div>
```

(The closing tag of the component's returned JSX — the old `</AppLayout>` on old line 454 — must be changed to `</>` to match the new `<>` opener.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `AppLayout`/`PageHeader` are reported as unused or missing, confirm Step 2 removed both imports and no other reference remains.

- [ ] **Step 6: Commit**

```bash
git add src/pages/daily-check/BalanceRoomPage.tsx src/pages/DailyCheck.tsx
git commit -m "refactor(daily-check): move balance calibration into BalanceRoomPage"
```

---

### Task 5: Summary hub page

**Files:**
- Create: `src/pages/daily-check/DailyCheckSummary.tsx`

- [ ] **Step 1: Create the page**

Create `src/pages/daily-check/DailyCheckSummary.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DAILY_CHECK_ROOMS } from "@/lib/dailyCheckRooms";

const DailyCheckSummary = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {DAILY_CHECK_ROOMS.map((room) => (
        <Card
          key={room.slug}
          role="button"
          tabIndex={0}
          onClick={() => navigate(room.route)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(room.route);
            }
          }}
          className="cursor-pointer shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <room.icon className="h-4 w-4 text-primary" />
                {room.label}
              </CardTitle>
              <Badge
                variant="outline"
                className={
                  room.ready
                    ? "border-green-300 bg-green-100 text-green-700"
                    : "text-muted-foreground"
                }
              >
                {room.ready ? "พร้อมใช้งาน" : "อยู่ระหว่างพัฒนา"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              {room.forms.length} ฟอร์มในห้องนี้
            </p>
            <div className="flex items-center gap-1 text-sm font-medium text-primary">
              เปิดห้อง <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DailyCheckSummary;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/daily-check/DailyCheckSummary.tsx
git commit -m "feat(daily-check): add summary hub page"
```

---

### Task 6: Generic placeholder room page

**Files:**
- Create: `src/pages/daily-check/RoomPlaceholderPage.tsx`

- [ ] **Step 1: Create the page**

Create `src/pages/daily-check/RoomPlaceholderPage.tsx`. It takes the room `slug` as a prop (passed per-route in `App.tsx`), looks the room up in the config, and renders an unknown-room fallback if the slug is invalid:

```tsx
import { Construction, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoomBySlug } from "@/lib/dailyCheckRooms";

interface RoomPlaceholderPageProps {
  slug: string;
}

const RoomPlaceholderPage = ({ slug }: RoomPlaceholderPageProps) => {
  const room = getRoomBySlug(slug);

  if (!room) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">ไม่พบห้องที่ระบุ</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Construction className="h-4 w-4 text-amber-500" />
            {room.label} — อยู่ระหว่างพัฒนา
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            หน้านี้กำลังจะเปิดให้บันทึกฟอร์มต่อไปนี้
          </p>
          <ul className="space-y-1.5">
            {room.forms.map((form) => (
              <li
                key={form}
                className="flex items-center gap-2 text-sm text-muted-foreground/80"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {form}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomPlaceholderPage;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/daily-check/RoomPlaceholderPage.tsx
git commit -m "feat(daily-check): add generic placeholder room page"
```

---

### Task 7: Wire nested routes in `App.tsx`

**Files:**
- Modify: `src/App.tsx:27` (import), `src/App.tsx:78` (route)

- [ ] **Step 1: Swap the import**

In `src/App.tsx`, replace the old default import (line 27):

```tsx
import DailyCheck from "./pages/DailyCheck";
```

with the four new imports:

```tsx
import DailyCheckLayout from "./pages/daily-check/DailyCheckLayout";
import DailyCheckSummary from "./pages/daily-check/DailyCheckSummary";
import BalanceRoomPage from "./pages/daily-check/BalanceRoomPage";
import RoomPlaceholderPage from "./pages/daily-check/RoomPlaceholderPage";
```

- [ ] **Step 2: Replace the route**

Replace the single daily-check route (line 78):

```tsx
              <Route path="/daily-check" element={<PrivateRoute><DailyCheck /></PrivateRoute>} />
```

with the nested route group:

```tsx
              <Route path="/daily-check" element={<PrivateRoute><DailyCheckLayout /></PrivateRoute>}>
                <Route index element={<DailyCheckSummary />} />
                <Route path="balance" element={<BalanceRoomPage />} />
                <Route path="sample-prep" element={<RoomPlaceholderPage slug="sample-prep" />} />
                <Route path="analysis" element={<RoomPlaceholderPage slug="analysis" />} />
                <Route path="extraction" element={<RoomPlaceholderPage slug="extraction" />} />
              </Route>
```

(The parent `PrivateRoute` guards every child path; `PrivateRoute` reads `location.pathname`, which the room paths satisfy via the implied children from Task 2.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors, and no remaining reference to the deleted `./pages/DailyCheck`.

- [ ] **Step 4: Manual smoke check**

Start the app (`npm run dev`, with the backend running per CLAUDE.md). In dev mode `PrivateRoute` bypasses access checks, so verify navigation directly:
- Visit `/daily-check` → summary cards for all 4 rooms render; tab strip shows `สรุป | ห้องเครื่องชั่ง | ห้องเตรียมตัวอย่าง | ห้องวิเคราะห์ | ห้องสกัด`.
- Click `ห้องเครื่องชั่ง` → calibration UI (record + history tabs) renders; URL is `/daily-check/balance`.
- Click `ห้องวิเคราะห์` → placeholder lists the analysis forms; URL is `/daily-check/analysis`.
- Active tab highlights match the current route.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(daily-check): wire nested room routes"
```

---

### Task 8: Keep "Daily Check" highlighted on sub-routes

The sidebar's `isActive` only matches exact paths, so navigating into a room leaves no nav item highlighted. Fix it with a longest-prefix match so the most specific nav item wins (preserves `/petitions/assign` vs `/petitions`).

**Files:**
- Modify: `src/components/lis/AppSidebar.tsx` (add `activePath` memo near line 174; use it at lines 286-288)

- [ ] **Step 1: Compute the active nav path**

In `src/components/lis/AppSidebar.tsx`, add this `useMemo` right after the `roleLabel` line (line 174). `NAV_ITEMS` is already imported and `useMemo`/`useLocation` are already in use:

```tsx
  // The active nav item is the one whose path is the longest prefix of the
  // current pathname — so /daily-check stays active on /daily-check/balance,
  // while /petitions/assign still wins over /petitions on its own page.
  const activePath = useMemo(() => {
    const matches = NAV_ITEMS.filter(
      (item) =>
        location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`),
    );
    matches.sort((a, b) => b.path.length - a.path.length);
    return matches[0]?.path;
  }, [location.pathname]);
```

- [ ] **Step 2: Use it in `isActive`**

Replace the `isActive` expression (lines 286-288):

```tsx
                  const isActive =
                    location.pathname === targetPath ||
                    (item.path === "/" && location.pathname.startsWith("/dashboard/"));
```

with:

```tsx
                  const isActive =
                    item.path === activePath ||
                    (item.path === "/" && location.pathname.startsWith("/dashboard/"));
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

In the running app, navigate to `/daily-check/balance` and confirm the sidebar "Daily Check" entry is highlighted. Navigate to `/petitions/assign` and confirm "Assign คำร้อง" (not "รายการคำร้อง") is highlighted.

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/AppSidebar.tsx
git commit -m "fix(sidebar): highlight parent nav item on sub-routes"
```

---

### Task 9: Layout smoke test + full verification

**Files:**
- Create: `src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`

- [ ] **Step 1: Write the test**

Create `src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`. It renders the layout inside a `MemoryRouter` and asserts the tab strip and active state. The room pages call hooks (react-query/auth) only when routed to, so render the layout with a trivial index element:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DailyCheckLayout from "../DailyCheckLayout";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/daily-check" element={<DailyCheckLayout />}>
          <Route index element={<div>summary-body</div>} />
          <Route path="analysis" element={<div>analysis-body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("DailyCheckLayout", () => {
  it("renders the five-tab room strip", () => {
    renderAt("/daily-check");
    const tablist = screen.getByRole("tablist", { name: "ห้องปฏิบัติการ" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      "สรุป",
      "ห้องเครื่องชั่ง",
      "ห้องเตรียมตัวอย่าง",
      "ห้องวิเคราะห์",
      "ห้องสกัด",
    ]);
  });

  it("marks the summary tab active on the index route", () => {
    renderAt("/daily-check");
    expect(screen.getByRole("tab", { name: "สรุป" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("summary-body")).toBeInTheDocument();
  });

  it("marks the matching room tab active on a sub-route", () => {
    renderAt("/daily-check/analysis");
    expect(screen.getByRole("tab", { name: "ห้องวิเคราะห์" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("analysis-body")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm run test -- DailyCheckLayout`
Expected: PASS (3 tests).

- [ ] **Step 3: Full verification suite**

Run each and confirm clean:
- `npm run test` — all suites pass (existing + new config/access/layout tests).
- `npx tsc --noEmit` — no type errors.
- `npm run lint` — no new lint errors in the touched files.

- [ ] **Step 4: Commit**

```bash
git add src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx
git commit -m "test(daily-check): smoke-test layout tab strip"
```

---

## Self-Review notes

- **Spec coverage:** routes (Task 7), file structure (Tasks 1,3-7), tab strip submenu (Task 3), placeholder form lists (Tasks 1,6), balance move (Task 4), access control implied children (Task 2), no-backend constraint (honored — no server files touched), testing (Tasks 1,2,9). Sidebar highlight (Task 8) is an additive UX fix implied by the single-nav-entry decision.
- **Type consistency:** `DailyCheckRoom` fields (`slug/route/label/icon/forms/ready`), `getRoomBySlug`, `DAILY_CHECK_BASE`, `DAILY_CHECK_ROOMS` are used consistently across Tasks 1, 3, 5, 6. `RoomPlaceholderPage` prop is `slug: string`, matching the `App.tsx` usage in Task 7.
- **No backend / model / seed changes** — `seed-data` stays in sync automatically.
