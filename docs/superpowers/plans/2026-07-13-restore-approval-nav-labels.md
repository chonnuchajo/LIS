# Restore Approval Navigation Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the sidebar labels for the QC and Lab approval queues without changing routes, permissions, or workflow copy.

**Architecture:** `NAV_ITEMS` is the single source of truth for main sidebar labels. Add a focused unit test that indexes the two approval items by path, then restore only their `label` values in `src/lib/navItems.ts`. The existing sidebar retains the same active-state behavior because its routes are unchanged.

**Tech Stack:** TypeScript, React, Vitest, Vite.

## Global Constraints

- Change only the `label` values for `/qc-approval` and `/lab-approval` in `NAV_ITEMS`.
- `/qc-approval` must display `อนุมัติผล QC`; `/lab-approval` must display `อนุมัติผล Lab`.
- Do not change URLs, authorization, page headings, buttons, workflow/status copy, or sidebar active-state logic.
- Do not run a Vite or npm build command; use focused Vitest and TypeScript checks only.

---

### Task 1: Restore the two approval labels and prevent regression

**Files:**
- Modify: `src/lib/navItems.test.ts`
- Modify: `src/lib/navItems.ts:42-43`

**Interfaces:**
- Consumes: `NAV_ITEMS: NavItem[]` exported by `src/lib/navItems.ts`.
- Produces: Main navigation entries at `/qc-approval` and `/lab-approval` with the restored Thai labels.

- [ ] **Step 1: Add a failing label regression test**

Append this test to `src/lib/navItems.test.ts`:

    it("restores the prior labels for the approval queues", () => {
      const labelsByPath = Object.fromEntries(
        NAV_ITEMS.map((item) => [item.path, item.label]),
      );

      expect(labelsByPath["/qc-approval"]).toBe("อนุมัติผล QC");
      expect(labelsByPath["/lab-approval"]).toBe("อนุมัติผล Lab");
    });

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run src/lib/navItems.test.ts`

Expected: FAIL because the current labels are `ออก Final Result` and `ออกผล Lab`.

- [ ] **Step 3: Restore only the two `NAV_ITEMS` labels**

In `src/lib/navItems.ts`, replace the two entries with:

    { icon: ShieldCheck, label: "อนุมัติผล QC", path: "/qc-approval" },
    { icon: ShieldCheck, label: "อนุมัติผล Lab", path: "/lab-approval" },

Leave every other property and entry unchanged.

- [ ] **Step 4: Verify the focused test passes**

Run: `npx vitest run src/lib/navItems.test.ts`

Expected: PASS with all three `NAV_ITEMS` tests passing.

- [ ] **Step 5: Run the type check and scope review**

Run: `npx tsc --noEmit --project tsconfig.app.json`

Expected: exits with code 0.

Run: `git diff --check -- src/lib/navItems.ts src/lib/navItems.test.ts`

Expected: no output.

Run: `git diff -- src/lib/navItems.ts src/lib/navItems.test.ts`

Expected: only the two label values and the focused regression test are changed.

- [ ] **Step 6: Commit the implementation**

Run: `git add src/lib/navItems.ts src/lib/navItems.test.ts` followed by `git commit -m "fix: restore approval nav labels"`.
