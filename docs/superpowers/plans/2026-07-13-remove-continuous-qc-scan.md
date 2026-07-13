# Remove Continuous QC Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove continuous QC receiving and always open the received petition's QC testing page after confirmation.

**Architecture:** Keep `QrReceiveModal` as the single receive interface and preserve its existing scanner, manual entry, validation, and API calls. Remove the continuous-mode branch and its display state so the successful receive path has one outcome: refresh the queue and navigate to the received petition's existing `/qc-testing/:id` route.

**Tech Stack:** React 18, TypeScript, React Router 6, Vitest, React Testing Library, html5-qrcode.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or scripts that trigger `postbuild`.
- Preserve QR-camera scanning, manual petition-number entry, receiving validation, and the existing `/receive` API contract.
- Follow test-driven development: add and observe the focused test fail before changing production code.
- Do not include unrelated existing working-tree changes in any commit.

---

## File Structure

- `src/components/petition/QrReceiveModal.tsx` — QC receipt modal; removes the continuous-mode UI/state and makes successful receipt navigate immediately.
- `src/components/petition/__tests__/QrReceiveModal.test.tsx` — focused component coverage for the removed control and automatic successful-receipt navigation.

### Task 1: Make QC receiving navigate directly to work

**Files:**
- Modify: `src/components/petition/__tests__/QrReceiveModal.test.tsx`
- Modify: `src/components/petition/QrReceiveModal.tsx`

**Interfaces:**
- Consumes: `receivePetition(id, actor)` returning a `Petition` with `_id`; the existing `onReceived(): void` callback; React Router's `navigate(to: string)`.
- Produces: one successful receipt outcome: `onReceived()` followed by navigation to `/qc-testing/${received._id}`. No continuous-scan control, session receipt list, or success screen remains.

- [ ] **Step 1: Write and verify a failing test for the removed control**

  In `src/components/petition/__tests__/QrReceiveModal.test.tsx`, add this focused test:

  ```tsx
  it('does not render the continuous scanning control', () => {
    renderModal();

    expect(screen.queryByText('สแกนต่อเนื่อง')).not.toBeInTheDocument();
  });
  ```

  Run: `npm run test -- src/components/petition/__tests__/QrReceiveModal.test.tsx`

  Expected: FAIL because the current modal renders `สแกนต่อเนื่อง`.

- [ ] **Step 2: Remove only the visible continuous-scan control and verify the focused test passes**

  In `src/components/petition/QrReceiveModal.tsx`, remove the `Switch` import and the header label/switch block. Leave the current successful-receipt branch in place for this first red-green cycle.

  Run: `npm run test -- src/components/petition/__tests__/QrReceiveModal.test.tsx`

  Expected: PASS with the new control-removal test and all existing modal tests green.

- [ ] **Step 3: Write and verify a failing test for automatic navigation**

  In `src/components/petition/__tests__/QrReceiveModal.test.tsx`, import `useLocation`, render a small location probe alongside the modal, and add this separate test. It exercises the real manual-entry and confirmation flow rather than mocking the component's internal handlers.

  ```tsx
  import { MemoryRouter, useLocation } from 'react-router-dom';

  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}</output>;
  }

  function renderModal(onReceived = vi.fn()) {
    return render(
      <MemoryRouter>
        <QrReceiveModal open onClose={() => {}} onReceived={onReceived} />
        <LocationProbe />
      </MemoryRouter>,
    );
  }

  it('opens QC work after a receipt succeeds', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: qcPetition },
    });
    (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: qcPetition },
    });
    const onReceived = vi.fn();
    renderModal(onReceived);

    const input = await screen.findByPlaceholderText(/พิมพ์เลขที่คำร้อง/);
    fireEvent.change(input, { target: { value: 'P-2506-0002' } });
    fireEvent.click(screen.getByRole('button', { name: 'รับตัวอย่าง' }));
    fireEvent.click(await screen.findByRole('button', { name: 'ยืนยันรับตัวอย่าง' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/petitions/pet1/receive', {
        actor: 'Tester',
        side: 'qc',
      }),
    );
    expect(onReceived).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('location')).toHaveTextContent('/qc-testing/pet1');
  });
  ```

- [ ] **Step 4: Run the focused test and verify it fails for the current behavior**

  Run: `npm run test -- src/components/petition/__tests__/QrReceiveModal.test.tsx`

  Expected: FAIL because the current default continuous mode returns to scanning instead of changing the location to `/qc-testing/pet1`.

- [ ] **Step 5: Implement the one-outcome successful-receipt path**

  In `src/components/petition/QrReceiveModal.tsx`:

  - Remove `CheckCircle2` and `Switch` imports, the `success` phase, and the `continuousMode`, `receivedList`, `flashMsg`, and timer refs/state.
  - Delete `showFlash`, the continuous-mode switch header, the flash banner, the success-state panel, and the received-items session panel.
  - Replace the successful branch of `confirmReceive` with this code:

  ```tsx
  const received = await receivePetition(id, user?.name || user?.email);
  onReceived();
  navigate(`/qc-testing/${received._id}`);
  ```

  Keep the surrounding `try`/`catch`, loading phase, scanner cleanup, manual entry, validation, and `rescan` behavior unchanged.

- [ ] **Step 6: Run the focused test and verify it passes**

  Run: `npm run test -- src/components/petition/__tests__/QrReceiveModal.test.tsx`

  Expected: PASS with all `QrReceiveModal` tests green, including manual entry and camera fallback coverage.

- [ ] **Step 7: Run static validation for the changed component**

  Run: `npx tsc --noEmit`

  Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 8: Inspect the scoped diff and commit only the task files**

  Run:

  ```powershell
  git diff --check -- src/components/petition/QrReceiveModal.tsx src/components/petition/__tests__/QrReceiveModal.test.tsx
  git diff -- src/components/petition/QrReceiveModal.tsx src/components/petition/__tests__/QrReceiveModal.test.tsx
  git add -- src/components/petition/QrReceiveModal.tsx src/components/petition/__tests__/QrReceiveModal.test.tsx
  git commit -m "fix: remove continuous QC scan"
  ```

  Expected: no whitespace errors; commit contains exactly the two scoped task files and no pre-existing working-tree changes.
