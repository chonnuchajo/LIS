# Lab Status Label Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two requested Lab workflow labels consistently in browser status badges and LINE status replies.

**Architecture:** Keep every existing status condition and badge tone intact. Change only the string returned by the frontend status helpers and the server-side LINE formatter, then update their focused tests.

**Tech Stack:** TypeScript, Vitest, CommonJS, Node.js test runner.

## Global Constraints

- Do not change workflow conditions, routes, permissions, notification triggers, or badge variants.
- `Lab ตรวจครบ · รอออกผล` must render as `รอออกผล`.
- `ตรวจครบแล้ว · รอหัวหน้า Lab ออกผล` must render as `รอตรวจ`.
- Do not run a production or development build; use focused tests and `npx tsc --noEmit` for validation.

---

### Task 1: Update frontend status-label contracts

**Files:**
- Modify: `src/lib/statusBadge.test.ts`
- Modify: `src/lib/receiveStatus.test.ts`
- Modify: `src/lib/statusBadge.ts`
- Modify: `src/lib/receiveStatus.ts`

**Interfaces:**
- Consumes: `petitionStatusBadge(petition: Petition): StatusBadge` and `labTrackStatusBadge(petition): StatusBadge`.
- Produces: unchanged `StatusBadge` objects, with only their `label` values updated for the two Lab-completion states.

- [ ] **Step 1: Write the failing frontend tests**

Change the expected label in the both-completed case of `src/lib/statusBadge.test.ts` to:

```ts
expect(b.label).toBe("รอตรวจ");
```

Change the expected label in the completed Lab-track case of `src/lib/receiveStatus.test.ts` to:

```ts
expect(labTrackStatusBadge(p).label).toBe('รอออกผล');
```

- [ ] **Step 2: Run the frontend tests to verify they fail**

Run:

```powershell
npm test -- src/lib/statusBadge.test.ts src/lib/receiveStatus.test.ts
```

Expected: assertions fail because the current label values still contain the longer Lab workflow copy.

- [ ] **Step 3: Apply the minimal frontend implementation**

In `src/lib/statusBadge.ts`, retain the condition and tone but return:

```ts
return toneBadge("warning", "รอตรวจ");
```

In `src/lib/receiveStatus.ts`, retain the condition and tone but return:

```ts
return toneBadge('warning', 'รอออกผล');
```

- [ ] **Step 4: Run the frontend tests to verify they pass**

Run:

```powershell
npm test -- src/lib/statusBadge.test.ts src/lib/receiveStatus.test.ts
```

Expected: both test files pass with no failures.

### Task 2: Update LINE status-reply contract

**Files:**
- Modify: `server/lib/lineNotify.test.js`
- Modify: `server/lib/lineNotify.js`

**Interfaces:**
- Consumes: `petitionStatusText(petition): string`.
- Produces: the same status selection with `รอตรวจ` for petitions whose QC and Lab testing are complete but whose Lab approval is pending.

- [ ] **Step 1: Write the failing LINE formatter test**

Change the expected value in the `both tested, lab not approved` test to:

```js
assert.strictEqual(petitionStatusText(p), 'รอตรวจ');
```

- [ ] **Step 2: Run the LINE formatter test to verify it fails**

Run:

```powershell
node --test server/lib/lineNotify.test.js
```

Expected: the test fails because the formatter still returns `ตรวจครบแล้ว · รอหัวหน้า Lab ออกผล`.

- [ ] **Step 3: Apply the minimal LINE formatter implementation**

In the `qcCompletedAt && labCompletedAt && !labApprovedAt` branch of `server/lib/lineNotify.js`, return:

```js
return 'รอตรวจ';
```

- [ ] **Step 4: Run the LINE formatter test to verify it passes**

Run:

```powershell
node --test server/lib/lineNotify.test.js
```

Expected: all Node test subtests pass.

### Task 3: Validate the complete change

**Files:**
- Verify: `src/lib/statusBadge.ts`
- Verify: `src/lib/receiveStatus.ts`
- Verify: `server/lib/lineNotify.js`

**Interfaces:**
- Consumes: the completed status-label changes from Tasks 1 and 2.
- Produces: evidence that the new labels are covered by focused tests and accepted by TypeScript.

- [ ] **Step 1: Run all focused status tests**

Run:

```powershell
npm test -- src/lib/statusBadge.test.ts src/lib/receiveStatus.test.ts
node --test server/lib/lineNotify.test.js
```

Expected: every test passes.

- [ ] **Step 2: Type-check without building**

Run:

```powershell
npx tsc --noEmit
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Review the scoped diff**

Run:

```powershell
git diff --check -- src/lib/statusBadge.ts src/lib/statusBadge.test.ts src/lib/receiveStatus.ts src/lib/receiveStatus.test.ts server/lib/lineNotify.js server/lib/lineNotify.test.js
git diff -- src/lib/statusBadge.ts src/lib/statusBadge.test.ts src/lib/receiveStatus.ts src/lib/receiveStatus.test.ts server/lib/lineNotify.js server/lib/lineNotify.test.js
```

Expected: no whitespace errors and changes limited to the requested label values plus their assertions.
