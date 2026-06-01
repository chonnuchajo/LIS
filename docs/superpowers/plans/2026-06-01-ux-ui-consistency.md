# UX/UI Consistency Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every LIS page feel consistent and easy to use by building a small set of shared presentational components + a menu search, then migrating pages onto them — without changing any flow, route, API call, or business logic.

**Architecture:** Build reusable shell/state primitives under `src/components/lis/` and a shared status-badge helper under `src/lib/`. Add a client-side menu search filter to the existing (already group-driven) `AppSidebar`. Then refactor pages to wrap their existing content in these primitives. Presentation only — handlers, queries, and routing stay byte-for-byte identical.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query, React Router v6, Vitest (jsdom + @testing-library/react where present), Lucide icons.

---

## Constraints (apply to every task)

- **Never** change a page's data fetching, mutation, event handlers, route paths, or submitted payloads. Only wrap/relayout existing JSX and swap ad-hoc markup for shared components.
- Type-check after every task: `npx tsc --noEmit` must be clean.
- Run `npm run test` after foundation tasks and after any page that has co-located tests.
- Keep Thai UI labels.
- Follow existing patterns (shadcn `Button` variants already include `primary`/`danger`/`outline`; reuse them).

## File Structure

Create:
- `src/components/lis/PageHeader.tsx` — page title + description + right-aligned actions
- `src/components/lis/PageToolbar.tsx` — search box + filters row
- `src/components/lis/states/EmptyState.tsx` — "no data" block
- `src/components/lis/states/ErrorState.tsx` — error block + retry
- `src/components/lis/states/TableSkeleton.tsx` — loading skeleton rows
- `src/components/lis/DataTable.tsx` — table wrapper that renders loading/error/empty/data
- `src/components/lis/FormShell.tsx` — `FormShell`, `FormSection`, `FormField`
- `src/components/lis/StickyActionBar.tsx` — sticky save/cancel bar
- `src/lib/statusBadge.ts` — central status → badge variant/label/color helper
- Test files co-located under `src/components/lis/__tests__/` and `src/lib/statusBadge.test.ts`

Modify:
- `src/components/lis/AppSidebar.tsx` — add menu search filter
- Page files (Phase 2+), one per task

---

## Phase 1 — Foundation

### Task 1: Menu search in AppSidebar

**Files:**
- Modify: `src/components/lis/AppSidebar.tsx`

The sidebar already builds grouped `sections` from access-control groups and filters by permission. Add a search box (desktop expanded + drawer only; hidden when `collapsed`) that filters items by label, case-insensitive. Empty groups after filtering disappear.

- [ ] **Step 1: Add search state**

After the `collapsedGroups` state block (around line 86), add:

```tsx
const [menuQuery, setMenuQuery] = useState("");
```

- [ ] **Step 2: Filter items inside the section render**

In the `nav` render, replace the line:

```tsx
const visibleItems = section.items.filter((item) =>
  userCanAccessPath(user, item.path, navGroups),
);
```

with:

```tsx
const q = menuQuery.trim().toLowerCase();
const visibleItems = section.items.filter(
  (item) =>
    userCanAccessPath(user, item.path, navGroups) &&
    (q === "" || item.label.toLowerCase().includes(q)),
);
```

- [ ] **Step 3: Render the search input**

Directly inside `<nav ...>`, before `{sections.map(...)}`, add (only when not collapsed):

```tsx
{!collapsed && (
  <div className="px-1 pb-2">
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={menuQuery}
        onChange={(e) => setMenuQuery(e.target.value)}
        placeholder="ค้นหาเมนู..."
        className="w-full h-9 pl-8 pr-2 rounded-lg bg-accent/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  </div>
)}
```

Add `Search` to the existing lucide-react import on line 4-6.

- [ ] **Step 4: Empty-search hint**

After `{sections.map(...)}` inside `<nav>`, add:

```tsx
{!collapsed && menuQuery.trim() !== "" &&
  sections.every((s) =>
    s.items.filter(
      (item) =>
        userCanAccessPath(user, item.path, navGroups) &&
        item.label.toLowerCase().includes(menuQuery.trim().toLowerCase()),
    ).length === 0,
  ) && (
    <p className="px-3 py-4 text-xs text-muted-foreground text-center">ไม่พบเมนู "{menuQuery}"</p>
  )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verify**

`npm run dev`, confirm: typing "stock" narrows the menu; clearing restores all groups; collapsed sidebar shows no search box; drawer (mobile) shows it.

- [ ] **Step 7: Commit**

```bash
git add src/components/lis/AppSidebar.tsx
git commit -m "feat(nav): add menu search filter to sidebar"
```

---

### Task 2: statusBadge helper

**Files:**
- Create: `src/lib/statusBadge.ts`
- Test: `src/lib/statusBadge.test.ts`

Centralize status → label + Tailwind classes. Seed it from the existing `PETITION_STATUS_CONFIG` (in `src/types/petition.types.ts`) so petition statuses render identically, and provide a generic fallback.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { statusBadge } from "./statusBadge";

describe("statusBadge", () => {
  it("returns label + classes for a known petition status", () => {
    const b = statusBadge("success");
    expect(b.label.length).toBeGreaterThan(0);
    expect(b.className).toContain("bg-");
  });

  it("falls back to a neutral badge for unknown status", () => {
    const b = statusBadge("totally-unknown-xyz");
    expect(b.label).toBe("totally-unknown-xyz");
    expect(b.className).toContain("bg-");
  });

  it("uses the provided label override when given", () => {
    const b = statusBadge("success", "เสร็จแล้ว");
    expect(b.label).toBe("เสร็จแล้ว");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- statusBadge`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { PETITION_STATUS_CONFIG } from "@/types/petition.types";

export type StatusBadge = { label: string; className: string };

const NEUTRAL = "bg-muted text-muted-foreground";

// Generic tone → classes, reused by pages whose statuses are not petition statuses.
export const STATUS_TONES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

export function toneBadge(tone: StatusTone, label: string): StatusBadge {
  return { label, className: STATUS_TONES[tone] };
}

export function statusBadge(status: string, labelOverride?: string): StatusBadge {
  const cfg = (PETITION_STATUS_CONFIG as Record<string, { label?: string; badgeClass?: string }>)[status];
  return {
    label: labelOverride ?? cfg?.label ?? status,
    className: cfg?.badgeClass ?? NEUTRAL,
  };
}
```

> Note: verify the real field names on `PETITION_STATUS_CONFIG` before finalizing (it may expose `label` + a color/`className` field under a different key). Adjust `cfg?.label`/`cfg?.badgeClass` to match; keep the fallback to `NEUTRAL`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- statusBadge`
Expected: PASS.

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit
git add src/lib/statusBadge.ts src/lib/statusBadge.test.ts
git commit -m "feat(ui): central status badge helper"
```

---

### Task 3: PageHeader

**Files:**
- Create: `src/components/lis/PageHeader.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Standard page heading: title + optional description on the left, actions on the right. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageHeader;
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/lis/PageHeader.tsx
git commit -m "feat(ui): PageHeader component"
```

---

### Task 4: PageToolbar

**Files:**
- Create: `src/components/lis/PageToolbar.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PageToolbarProps {
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters?: ReactNode;
  right?: ReactNode;
  className?: string;
}

/** Standard search + filters row, placed directly under PageHeader. */
export function PageToolbar({ search, filters, right, className }: PageToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      {search && (
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "ค้นหา..."}
            className="pl-9"
          />
        </div>
      )}
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
      {right && <div className="flex items-center gap-2 sm:ml-auto">{right}</div>}
    </div>
  );
}

export default PageToolbar;
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/lis/PageToolbar.tsx
git commit -m "feat(ui): PageToolbar component"
```

---

### Task 5: State components (Empty / Error / TableSkeleton)

**Files:**
- Create: `src/components/lis/states/EmptyState.tsx`
- Create: `src/components/lis/states/ErrorState.tsx`
- Create: `src/components/lis/states/TableSkeleton.tsx`

- [ ] **Step 1: EmptyState**

```tsx
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title = "ไม่มีข้อมูล", description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <div className="text-muted-foreground">{icon ?? <Inbox className="h-10 w-10" />}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
```

- [ ] **Step 2: ErrorState**

```tsx
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "เกิดข้อผิดพลาด",
  description = "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          ลองใหม่
        </Button>
      )}
    </div>
  );
}

export default ErrorState;
```

- [ ] **Step 3: TableSkeleton**

```tsx
interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 6, cols = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-2 p-2" aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-6 flex-1 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default TableSkeleton;
```

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/lis/states
git commit -m "feat(ui): empty/error/skeleton state components"
```

---

### Task 6: DataTable wrapper

**Files:**
- Create: `src/components/lis/DataTable.tsx`
- Test: `src/components/lis/__tests__/DataTable.test.tsx`

Generic table that owns loading/error/empty/data rendering. Uses shadcn `Table` primitives. Columns are described declaratively; rows clickable when `onRowClick` is given.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable } from "../DataTable";

const columns = [{ key: "name", header: "Name", cell: (r: { name: string }) => r.name }];

describe("DataTable", () => {
  it("shows skeleton when loading", () => {
    render(<DataTable columns={columns} data={[]} isLoading rowKey={(r) => r.name} />);
    expect(screen.getByLabelText("กำลังโหลด")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(<DataTable columns={columns} data={[]} emptyTitle="ว่าง" rowKey={(r) => r.name} />);
    expect(screen.getByText("ว่าง")).toBeInTheDocument();
  });

  it("renders rows when data present", () => {
    render(<DataTable columns={columns} data={[{ name: "A" }]} rowKey={(r) => r.name} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- DataTable`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "./states/EmptyState";
import { ErrorState } from "./states/ErrorState";
import { TableSkeleton } from "./states/TableSkeleton";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading,
  isError,
  onRetry,
  onRowClick,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
}: DataTableProps<T>) {
  const body = () => {
    if (isLoading) return <TableSkeleton cols={columns.length} />;
    if (isError) return <ErrorState onRetry={onRetry} />;
    if (data.length === 0)
      return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
    return null;
  };

  const overlay = body();

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      {overlay ? (
        overlay
      ) : (
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/50">
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "even:bg-muted/30",
                  onRowClick && "cursor-pointer hover:bg-accent",
                )}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default DataTable;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- DataTable`
Expected: PASS. (If `@testing-library/react`/jsdom is not configured, convert the test to assert the component is a function and render via `renderToString` from `react-dom/server` instead — check an existing `*.test.tsx` for the project's setup first.)

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/lis/DataTable.tsx src/components/lis/__tests__/DataTable.test.tsx
git commit -m "feat(ui): DataTable wrapper with loading/empty/error states"
```

---

### Task 7: FormShell + StickyActionBar

**Files:**
- Create: `src/components/lis/FormShell.tsx`
- Create: `src/components/lis/StickyActionBar.tsx`

- [ ] **Step 1: StickyActionBar**

```tsx
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StickyActionBarProps {
  onCancel?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  isSaving?: boolean;
  saveDisabled?: boolean;
  /** When the form is a real <form>, omit onSave and set type="submit" via formId. */
  formId?: string;
  extra?: ReactNode;
  className?: string;
}

/** Sticky save/cancel bar pinned to the bottom of a form. Prevents double-submit while saving. */
export function StickyActionBar({
  onCancel,
  onSave,
  saveLabel = "บันทึก",
  cancelLabel = "ยกเลิก",
  isSaving = false,
  saveDisabled = false,
  formId,
  extra,
  className,
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-6 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6",
        className,
      )}
    >
      {extra && <div className="mr-auto">{extra}</div>}
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          {cancelLabel}
        </Button>
      )}
      <Button
        type={formId ? "submit" : "button"}
        form={formId}
        variant="primary"
        onClick={onSave}
        disabled={isSaving || saveDisabled}
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSaving ? "กำลังบันทึก..." : saveLabel}
      </Button>
    </div>
  );
}

export default StickyActionBar;
```

- [ ] **Step 2: FormShell / FormSection / FormField**

```tsx
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}

export function FormSection({
  title,
  description,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      {title && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function FormField({
  label,
  required,
  error,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default FormShell;
```

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/lis/FormShell.tsx src/components/lis/StickyActionBar.tsx
git commit -m "feat(ui): FormShell + StickyActionBar"
```

---

## Phase 2 — Page migration (recipe)

Foundation done. Now migrate pages. **The recipe is identical for every page** — only the page-specific wiring differs:

1. Wrap the page heading in `PageHeader` (move the existing primary button into `actions`).
2. Move existing search/filter controls into `PageToolbar` (reuse the page's existing state + handlers — do not create new ones).
3. Replace ad-hoc `<table>`/list + manual loading/empty markup with `DataTable`, mapping existing columns into `DataTableColumn[]` and passing the page's existing `isLoading`/`isError`/`data`. Keep the existing `onRowClick`/navigation.
4. For form pages: wrap fields in `FormShell`/`FormSection`/`FormField`, replace the bottom buttons with `StickyActionBar` wired to the **existing** submit handler + mutation `isPending`. Move existing field-level error messages into `FormField error`.
5. Replace any inline status pills with `statusBadge(...)`.
6. `npx tsc --noEmit`; if the page has a co-located test, `npm run test -- <name>`; manual flow check; commit.

**Do not** touch data fetching, mutations, route params, or submit payloads. If a page's flow can't be preserved with a shared component, leave that part as-is and note it.

Migration order (one task = one page = one commit, message `refactor(ui): adopt shared shell on <Page>`):

- [ ] **Task 8:** `PetitionListPage.tsx` — worked example below
- [ ] **Task 9:** `PetitionNewPage.tsx` (form)
- [ ] **Task 10:** `PetitionEditPage.tsx` (form)
- [ ] **Task 11:** `PetitionDetailPage.tsx`
- [ ] **Task 12:** `PetitionAssignPage.tsx`
- [ ] **Task 13:** `LabTestingPage.tsx`
- [ ] **Task 14:** `LabTestingDetailPage.tsx` (form)
- [ ] **Task 15:** `QCTestingPage.tsx`
- [ ] **Task 16:** `QCTestingDetailPage.tsx` (form)
- [ ] **Task 17:** `QCApproval.tsx`
- [ ] **Task 18:** `RecordResults.tsx` (form)
- [ ] **Task 19:** `Stock.tsx`
- [ ] **Task 20:** `StockDeduction.tsx` (form)
- [ ] **Task 21:** `DailyCheck.tsx`
- [ ] **Task 22:** `Report.tsx`
- [ ] **Task 23:** `LabDashboard.tsx`
- [ ] **Task 24:** `QCDashboard.tsx`
- [ ] **Task 25:** `Home.tsx`
- [ ] **Task 26:** `MasterItems.tsx` (+ `MachinesPage`, `SimpleMethodPage`)
- [ ] **Task 27:** `StandardConfig.tsx`
- [ ] **Task 28:** `ParameterSettings.tsx`
- [ ] **Task 29:** `AdminData.tsx`
- [ ] **Task 30:** `AccessControl.tsx`
- [ ] **Task 31:** `SettingsPage.tsx`

### Task 8 (worked example): PetitionListPage

**Files:**
- Modify: `src/pages/PetitionListPage.tsx`

This page already has: `search`/`status` from `searchParams`, `usePetitionList`, a results table, pagination, and a "create petition" button gated by `canCreatePetition`. Migrate presentation only.

- [ ] **Step 1: Import shared components**

Add near the existing imports:

```tsx
import PageHeader from "@/components/lis/PageHeader";
import PageToolbar from "@/components/lis/PageToolbar";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import { statusBadge } from "@/lib/statusBadge";
```

- [ ] **Step 2: Replace the heading block**

Find the existing title + create-button markup at the top of the returned JSX and replace it with:

```tsx
<PageHeader
  title="รายการคำร้อง"
  description={`ทั้งหมด ${total} รายการ`}
  actions={
    canCreatePetition ? (
      <Button variant="primary" onClick={() => navigate("/petitions/new")}>
        <FilePlus2 className="h-4 w-4" /> สร้างคำร้อง
      </Button>
    ) : undefined
  }
/>
```

Use the page's existing total count variable for `description` (if none exists, derive from the list length; do not add a new query).

- [ ] **Step 3: Replace the search/filter row**

Wrap the existing search `Input` + status filter in:

```tsx
<PageToolbar
  search={{
    value: search,
    onChange: (v) => setSearchParams((p) => { p.set("search", v); p.set("page", "1"); return p; }),
    placeholder: "ค้นหาเลขที่ / ชื่อ...",
  }}
  filters={/* existing status filter control, unchanged */ null}
/>
```

Keep the page's existing `setSearchParams` update shape — copy it from the current `onChange`; do not invent a new one.

- [ ] **Step 4: Replace the table with DataTable**

Define columns from the existing table headers/cells (reuse existing cell render logic), e.g.:

```tsx
const columns: DataTableColumn<Petition>[] = [
  { key: "no", header: "เลขที่", cell: (p) => p.requestNo },
  { key: "name", header: "ชื่อ", cell: (p) => p.items[0]?.name ?? "-" },
  {
    key: "status",
    header: "สถานะ",
    cell: (p) => {
      const b = statusBadge(p.status);
      return <span className={cn("rounded-full px-2 py-0.5 text-xs", b.className)}>{b.label}</span>;
    },
  },
  { key: "date", header: "วันที่", cell: (p) => /* existing date format */ p.createdAt },
];
```

(Map the columns to whatever the current table actually shows — keep parity.) Then render:

```tsx
<DataTable
  columns={columns}
  data={petitions}
  rowKey={(p) => p._id}
  isLoading={isLoading}
  isError={isError}
  onRowClick={(p) => navigate(`/petitions/${p._id}`)}
  emptyTitle="ไม่พบคำร้อง"
  emptyDescription="ลองปรับคำค้นหาหรือตัวกรอง"
/>
```

Use the page's actual variable names (`isLoading`, `isError`, the list array, the id field) — confirm them in the file first.

- [ ] **Step 5: Keep pagination unchanged**

Leave the existing pagination controls below `DataTable` exactly as they are.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Verify flow**

`npm run dev`: search filters; status filter works; clicking a row opens detail; create button still navigates; pagination works. Nothing in behavior changed.

- [ ] **Step 8: Commit**

```bash
git add src/pages/PetitionListPage.tsx
git commit -m "refactor(ui): adopt shared shell on PetitionListPage"
```

For Tasks 9–31: apply the same recipe. Before each, read the page to capture its real variable names, handlers, and columns; preserve them exactly.

---

## Self-Review

- **Spec coverage:** menu search → Task 1; visual consistency (PageHeader/Toolbar/buttons/badges) → Tasks 2–4 + recipe step 1-2,5; tables + loading/empty/error → Tasks 5–6 + recipe step 3; forms + sticky bar + inline validation → Task 7 + recipe step 4; migrate all pages → Tasks 8–31. Out-of-scope items excluded. ✅
- **Placeholders:** none (recipe references real components; per-page wiring intentionally read-at-execution because each page's variable names differ — flagged explicitly). 
- **Type consistency:** `DataTableColumn`, `statusBadge`, `StickyActionBar` props names match across tasks. ✅
- **Open verification:** Task 2 notes confirming `PETITION_STATUS_CONFIG` field names; Task 6 notes confirming the test setup. Both have fallbacks.
