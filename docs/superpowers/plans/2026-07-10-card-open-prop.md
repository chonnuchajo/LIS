# Card Open Prop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `Card onOpen` API so navigation-style cards open from single click, double click, and keyboard activation without changing ordinary cards.

**Architecture:** `src/components/ui/card.tsx` remains the shared primitive and owns the generic open behavior plus nested-interaction safety. Callers opt in by passing `onOpen`, then selected card-like navigation surfaces migrate from ad hoc `button`/`div` wrappers to `Card onOpen`. Tests cover the primitive behavior first, then at least one migrated card to prove callers use the new API correctly.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, React Router, shadcn-style local UI components.

## Global Constraints

- Only cards that explicitly opt in through `onOpen` become clickable.
- Existing cards without `onOpen` keep their current behavior.
- `onClick`, `onDoubleClick`, and `onKeyDown` supplied by callers run before `onOpen`; `onOpen` must not run if the caller prevented default.
- Interactive descendants and elements marked `data-card-open-ignore` must not trigger the card open action.
- Do not migrate form, configuration, report, empty, loading, or primary editing cards unless a caller explicitly has a navigation/open-detail action.
- Use project-local components and existing import aliases.
- Do not revert unrelated working-tree changes.

---

## File Structure

- Modify `src/components/ui/card.tsx`: define `CardProps`, add `onOpen`, implement click/double-click/keyboard handling, and add helper functions for descendant ignore checks.
- Create `src/components/ui/card.test.tsx`: unit-test the primitive behavior in isolation.
- Modify `src/components/lis/StatCard.tsx`: render the visual stat tile through `Card onOpen` instead of a raw `button`/`div` wrapper.
- Create or modify `src/components/lis/StatCard.test.tsx`: prove click, double-click, and keyboard activation call the supplied open handler.
- Modify `src/components/dashboard/GenericMenuGrid.tsx`: use `Card onOpen` for dashboard menu tiles.
- Modify `src/pages/PetitionListPage.tsx`: use `Card onOpen` for summary filter cards and petition result cards.
- Modify `src/pages/PetitionAssignPage.tsx`: use `Card onOpen` for draggable petition cards while preserving drag behavior and the nested title button.

---

### Task 1: Add `Card onOpen` Primitive Behavior

**Files:**
- Modify: `src/components/ui/card.tsx`
- Create: `src/components/ui/card.test.tsx`

**Interfaces:**
- Produces: `CardProps extends React.HTMLAttributes<HTMLDivElement> { onOpen?: () => void }`
- Produces: `<Card onOpen={() => void}>...</Card>` with click, double-click, `Enter`, and `Space` activation
- Produces: descendant opt-out via `data-card-open-ignore`

- [ ] **Step 1: Write the failing primitive tests**

Create `src/components/ui/card.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { Card } from "./card";

describe("Card onOpen", () => {
  it("calls onOpen on click", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen}>Open me</Card>);

    fireEvent.click(screen.getByRole("button", { name: "Open me" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls onOpen on double click", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen}>Open me</Card>);

    fireEvent.doubleClick(screen.getByRole("button", { name: "Open me" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls onOpen on Enter and Space", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen}>Open me</Card>);
    const card = screen.getByRole("button", { name: "Open me" });

    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("does not call onOpen from interactive children", () => {
    const onOpen = vi.fn();
    const onChildClick = vi.fn();
    render(
      <Card onOpen={onOpen}>
        <button type="button" onClick={onChildClick}>Child action</button>
      </Card>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Child action" }));

    expect(onChildClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not call onOpen from data-card-open-ignore children", () => {
    const onOpen = vi.fn();
    render(
      <Card onOpen={onOpen}>
        <span data-card-open-ignore>Ignore me</span>
      </Card>,
    );

    fireEvent.click(screen.getByText("Ignore me"));

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("runs caller onClick first and skips onOpen when default is prevented", () => {
    const onOpen = vi.fn();
    const onClick = vi.fn((event: MouseEvent<HTMLDivElement>) => event.preventDefault());
    render(<Card onOpen={onOpen} onClick={onClick}>Open me</Card>);

    fireEvent.click(screen.getByRole("button", { name: "Open me" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the primitive test and verify RED**

Run:

```bash
npm test -- src/components/ui/card.test.tsx
```

Expected: FAIL because the current `Card` does not accept `onOpen`, does not expose `role="button"`, and does not call `onOpen`.

- [ ] **Step 3: Implement minimal `Card onOpen` behavior**

Replace `src/components/ui/card.tsx` with this structure while preserving the existing exported component names:

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  onOpen?: () => void;
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='menuitem']",
  "[role='option']",
  "[contenteditable='true']",
  "[data-card-open-ignore]",
].join(",");

function isIgnoredOpenTarget(target: EventTarget | null, currentTarget: HTMLElement) {
  if (!(target instanceof HTMLElement)) return false;
  const match = target.closest(INTERACTIVE_SELECTOR);
  return Boolean(match && currentTarget.contains(match) && match !== currentTarget);
}

function shouldOpenFromKey(key: string) {
  return key === "Enter" || key === " ";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      onOpen,
      onClick,
      onDoubleClick,
      onKeyDown,
      role,
      tabIndex,
      ...props
    },
    ref,
  ) => {
    const interactive = typeof onOpen === "function";

    return (
      <div
        ref={ref}
        role={interactive ? role ?? "button" : role}
        tabIndex={interactive ? tabIndex ?? 0 : tabIndex}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          interactive && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!interactive || event.defaultPrevented || isIgnoredOpenTarget(event.target, event.currentTarget)) return;
          onOpen();
        }}
        onDoubleClick={(event) => {
          onDoubleClick?.(event);
          if (!interactive || event.defaultPrevented || isIgnoredOpenTarget(event.target, event.currentTarget)) return;
          onOpen();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!interactive || event.defaultPrevented || !shouldOpenFromKey(event.key)) return;
          if (isIgnoredOpenTarget(event.target, event.currentTarget)) return;
          event.preventDefault();
          onOpen();
        }}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-4 sm:p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-4 sm:p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

- [ ] **Step 4: Run the primitive test and verify GREEN**

Run:

```bash
npm test -- src/components/ui/card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/components/ui/card.tsx src/components/ui/card.test.tsx
git commit -m "feat(ui): add card open action"
```

---

### Task 2: Migrate Stat and Dashboard Menu Cards

**Files:**
- Modify: `src/components/lis/StatCard.tsx`
- Create: `src/components/lis/StatCard.test.tsx`
- Modify: `src/components/dashboard/GenericMenuGrid.tsx`

**Interfaces:**
- Consumes: `<Card onOpen={() => void}>...</Card>` from Task 1
- Preserves: `StatCardProps.onClick?: () => void`
- Produces: stat tiles that open on click, double click, `Enter`, and `Space`
- Produces: dashboard menu tiles rendered as `Card onOpen`

- [ ] **Step 1: Write the failing StatCard behavior test**

Create `src/components/lis/StatCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { FlaskConical } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import StatCard from "./StatCard";

describe("StatCard", () => {
  it("opens from click, double click, Enter, and Space when interactive", () => {
    const onClick = vi.fn();
    render(
      <StatCard
        icon={FlaskConical}
        value={7}
        label="Waiting"
        variant="blue"
        onClick={onClick}
      />,
    );

    const card = screen.getByRole("button", { name: /Waiting/i });
    fireEvent.click(card);
    fireEvent.doubleClick(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onClick).toHaveBeenCalledTimes(4);
  });

  it("does not expose a button role without an open action", () => {
    render(<StatCard icon={FlaskConical} value={7} label="Waiting" variant="blue" />);

    expect(screen.queryByRole("button", { name: /Waiting/i })).not.toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the StatCard test and verify RED**

Run:

```bash
npm test -- src/components/lis/StatCard.test.tsx
```

Expected: FAIL because the current `StatCard` handles click only through a raw wrapper and does not use the new `Card onOpen` behavior.

- [ ] **Step 3: Migrate `StatCard` to `Card onOpen`**

In `src/components/lis/StatCard.tsx`, add the `Card` import:

```tsx
import { Card } from "@/components/ui/card";
```

Replace the current dynamic `Wrapper` block with:

```tsx
  return (
    <Card
      onOpen={onClick}
      aria-pressed={interactive ? Boolean(active) : undefined}
      className={cn(
        "relative w-full overflow-hidden rounded-xl p-4 text-left",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_-2px_rgba(15,23,42,0.06)]",
        "border border-border/70 transition-all",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        classes.bar,
        interactive && "hover:-translate-y-0.5 hover:shadow-md",
        active && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <div className="flex items-start gap-3 pl-2">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", classes.iconBg)}>
          <Icon className={cn("h-4 w-4", classes.iconFg)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">{value}</p>
          {sublabel ? (
            <div className="mt-2 text-xs text-muted-foreground">{sublabel}</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
```

Remove the unused `Wrapper` constant.

- [ ] **Step 4: Migrate `GenericMenuGrid` tiles**

In `src/components/dashboard/GenericMenuGrid.tsx`, replace the accessible menu tile `button` with `Card onOpen` plus `CardContent`:

```tsx
              <Card
                key={item.path}
                onOpen={() => navigate(item.path)}
                className="transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <CardContent className="flex items-center gap-3 p-4 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.path}</p>
                  </div>
                </CardContent>
              </Card>
```

Keep the existing `Card, CardContent` import unchanged.

- [ ] **Step 5: Run Task 2 tests**

Run:

```bash
npm test -- src/components/lis/StatCard.test.tsx src/components/ui/card.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/components/lis/StatCard.tsx src/components/lis/StatCard.test.tsx src/components/dashboard/GenericMenuGrid.tsx
git commit -m "refactor(dashboard): use card open for navigation tiles"
```

---

### Task 3: Migrate Petition List and Assignment Cards

**Files:**
- Modify: `src/pages/PetitionListPage.tsx`
- Modify: `src/pages/PetitionAssignPage.tsx`

**Interfaces:**
- Consumes: `<Card onOpen={() => void}>...</Card>` from Task 1
- Produces: petition list result cards that open on click, double-click, and keyboard activation
- Produces: summary filter cards that activate on click, double-click, and keyboard activation
- Produces: assignment petition cards that open from the card body while preserving `draggable`

- [ ] **Step 1: Write a focused regression test for `Card` with nested child controls**

Extend `src/components/ui/card.test.tsx` with this test before migrating the more complex petition cards:

```tsx
  it("keeps draggable and nested title actions independent", () => {
    const onOpen = vi.fn();
    const onTitleClick = vi.fn();
    render(
      <Card onOpen={onOpen} draggable>
        <button type="button" onClick={onTitleClick}>PET-001</button>
        <span>Card body</span>
      </Card>,
    );

    fireEvent.click(screen.getByText("Card body"));
    fireEvent.click(screen.getByRole("button", { name: "PET-001" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onTitleClick).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the regression test before migration**

Run:

```bash
npm test -- src/components/ui/card.test.tsx
```

Expected: PASS. If it fails, fix Task 1 before touching page code.

- [ ] **Step 3: Migrate petition summary cards in `PetitionListPage`**

In `src/pages/PetitionListPage.tsx`, the file already imports `Card`. Replace the summary card `button` inside `summaryCards.map` with:

```tsx
            <Card
              key={card.label}
              onOpen={() => updateParams({ status: card.key || undefined, page: undefined })}
              className={cn(
                "rounded-2xl p-4 text-left transition-all",
                card.active
                  ? "border-primary-300 bg-primary-50 shadow-sm ring-1 ring-primary-100"
                  : "border-black-50 hover:border-primary-200 hover:bg-grey-50/50",
              )}
            >
              <p className="text-sm font-medium text-grey-600">{card.label}</p>
              <p className="mt-2 text-3xl font-bold text-black-500">{card.count}</p>
              <p className="mt-1 text-xs text-grey-500">{card.hint}</p>
            </Card>
```

- [ ] **Step 4: Migrate petition result cards in `PetitionListPage`**

Replace the petition result `button` returned from `visibleItems.map((petition) => { ... })` with this exact `Card` wrapper and keep the existing card body:

```tsx
                  <Card
                    key={petition._id}
                    onOpen={() => navigate(`/petitions/${petition._id}`)}
                    className="w-full rounded-2xl border-black-50 p-4 text-left transition hover:border-primary-200 hover:bg-grey-50/40"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-primary-500">{petition.petitionNo}</p>
                          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          <Badge variant="blue-soft">{PETITION_DEPT_LABELS[petition.dept]}</Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-black-500">{primarySample}</p>
                            {extraSamples > 0 && <Badge variant="gray-soft">+อีก {extraSamples}</Badge>}
                            <span className="text-xs text-grey-500">{petition.items.length} รายการ</span>
                          </div>
                          {testItems.length > 0 && (
                            <p className="line-clamp-2 text-sm text-grey-600">
                              {testItems.slice(0, 4).join(" • ")}
                              {testItems.length > 4 ? ` • +อีก ${testItems.length - 4}` : ""}
                            </p>
                          )}
                          <p className="text-xs text-grey-500">{petitionMetaLine(petition)}</p>
                        </div>

                        <div className="rounded-xl bg-grey-50 px-3 py-2 text-sm text-grey-700">
                          {petitionNextStepText(petition)}
                        </div>

                        <PetitionStatusTimeline petition={petition} />
                      </div>

                      <div className="flex items-center gap-2 self-start lg:pl-4">
                        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-primary-200 bg-white px-3 text-sm font-medium text-primary-600">
                          {petitionActionLabel(petition)}
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Card>
```

Remove `type="button"` and the `onClick` from the old wrapper. Keep the existing surrounding variables: `statusBadge`, `sampleNames`, `primarySample`, `extraSamples`, and `testItems`.

- [ ] **Step 5: Migrate assignment petition cards**

`src/pages/PetitionAssignPage.tsx` already imports `Card`, so only the `PetitionCard` wrapper changes.

In `PetitionCard`, replace the outer `<div draggable ...>` with:

```tsx
    <Card
      onOpen={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", petition._id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab rounded-lg border-grey-200 bg-white p-2.5 shadow-sm transition active:cursor-grabbing hover:border-primary-200 hover:shadow",
        dragging && "opacity-40",
      )}
    >
```

Replace the closing outer `</div>` for `PetitionCard` with `</Card>`. Keep the nested petition number `button` unchanged so it remains an explicit link target and is ignored by the parent `Card onOpen`.

- [ ] **Step 6: Run focused tests and TypeScript build**

Run:

```bash
npm test -- src/components/ui/card.test.tsx src/components/lis/StatCard.test.tsx
npm run build
```

Expected: both tests PASS and build completes without TypeScript errors.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/components/ui/card.test.tsx src/pages/PetitionListPage.tsx src/pages/PetitionAssignPage.tsx
git commit -m "refactor(petitions): use card open on petition cards"
```

---

### Task 4: Final Verification

**Files:**
- No new files expected

**Interfaces:**
- Consumes: all tasks above
- Produces: verified implementation ready for user review

- [ ] **Step 1: Run the full relevant test set**

Run:

```bash
npm test -- src/components/ui/card.test.tsx src/components/lis/StatCard.test.tsx src/components/lis/__tests__/DataTable.test.tsx src/components/dashboard/DashboardHeader.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with Vite build output and no TypeScript errors.

- [ ] **Step 3: Inspect git diff for accidental unrelated edits**

Run:

```bash
git status --short
git diff -- src/components/ui/card.tsx src/components/ui/card.test.tsx src/components/lis/StatCard.tsx src/components/lis/StatCard.test.tsx src/components/dashboard/GenericMenuGrid.tsx src/pages/PetitionListPage.tsx src/pages/PetitionAssignPage.tsx
```

Expected: only files from this plan are changed in the final diff, aside from unrelated pre-existing worktree changes that remain untouched.

- [ ] **Step 4: Final commit if Task 4 revealed any fixes**

If Task 4 required fixes, commit them:

```bash
git add src/components/ui/card.tsx src/components/ui/card.test.tsx src/components/lis/StatCard.tsx src/components/lis/StatCard.test.tsx src/components/dashboard/GenericMenuGrid.tsx src/pages/PetitionListPage.tsx src/pages/PetitionAssignPage.tsx
git commit -m "fix(ui): verify card open interactions"
```

If no fixes were needed, do not create an empty commit.
