# Manual petitionNo Receive (Lab/QC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มช่องกรอกเลขที่คำร้อง (petitionNo) ด้วยมือ เป็นทางเลือกนอกจากการสแกน QR ในหน้ารับงาน Lab และ QC

**Architecture:** เพิ่ม controlled `<input>` + `<form>` ในสอง modal เดิม (`LabScanAcceptModal`, `QrReceiveModal`). form submit เรียกฟังก์ชัน fetch เดิมของแต่ละ modal (`fetchAndCheck` / `fetchAndConfirm`) — เลขที่พิมพ์วิ่งเข้า path ตรวจสอบ/ยืนยันเดิมทั้งหมด ไม่แตะ backend, ไม่แตะ state machine ของกล้อง. ช่องกรอกโชว์ทั้ง phase `scanning` และ `no-camera`.

**Tech Stack:** React 18 + TypeScript, Vitest + @testing-library/react (jsdom), shadcn Button

---

## File Structure

- Modify: `src/components/petition/LabScanAcceptModal.tsx` — เพิ่ม state + form (รับงาน Lab)
- Modify: `src/components/petition/QrReceiveModal.tsx` — เพิ่ม state + form (รับตัวอย่าง QC)
- Create: `src/components/petition/__tests__/LabScanAcceptModal.test.tsx`
- Create: `src/components/petition/__tests__/QrReceiveModal.test.tsx`

หมายเหตุ pattern test (อ้างอิงจาก `src/pages/__tests__/StandardConfig.test.tsx`): mock `@/lib/api`, mock `html5-qrcode` (กันเปิดกล้องจริง), mock `@/hooks/useAuth`, render ใน `MemoryRouter`.

---

### Task 1: LabScanAcceptModal — ช่องกรอกเลขที่คำร้อง

**Files:**
- Test: `src/components/petition/__tests__/LabScanAcceptModal.test.tsx` (create)
- Modify: `src/components/petition/LabScanAcceptModal.tsx`

- [ ] **Step 1: เขียน failing test**

สร้างไฟล์ `src/components/petition/__tests__/LabScanAcceptModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LabScanAcceptModal from '../LabScanAcceptModal';

// กันเปิดกล้องจริง: start reject + ไม่มีกล้อง → phase 'no-camera'
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = vi.fn().mockRejectedValue(new Error('no camera'));
    stop = vi.fn().mockResolvedValue(undefined);
    getState = vi.fn().mockReturnValue(2);
    static getCameras = vi.fn().mockResolvedValue([]);
  },
  Html5QrcodeScannerState: { SCANNING: 2, PAUSED: 3 },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Tester', email: 't@t.com' } }),
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}));

import { api } from '@/lib/api';

const labPetition = {
  _id: 'pet1',
  petitionNo: 'P-2506-0001',
  dept: 'production',
  status: 'sampleSent',
  assignedTo: { name: 'Tester' },
  items: [{ seq: 1, sampleName: 'ตัวอย่าง A', batchNo: 'B1' }],
};

function renderModal() {
  return render(
    <MemoryRouter>
      <LabScanAcceptModal open onClose={() => {}} onAccepted={() => {}} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LabScanAcceptModal manual entry', () => {
  it('แสดงช่องกรอกเลขที่คำร้องเมื่อไม่มีกล้อง', async () => {
    renderModal();
    expect(
      await screen.findByPlaceholderText(/พิมพ์เลขที่คำร้อง/),
    ).toBeInTheDocument();
  });

  it('พิมพ์เลขที่คำร้องแล้ว submit → เข้าจอ confirm', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: labPetition },
    });
    renderModal();

    const input = await screen.findByPlaceholderText(/พิมพ์เลขที่คำร้อง/);
    fireEvent.change(input, { target: { value: 'P-2506-0001' } });
    fireEvent.click(screen.getByRole('button', { name: 'รับงาน' }));

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/petitions/scan/P-2506-0001'),
      ),
    );
    expect(await screen.findByText('P-2506-0001')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/components/petition/__tests__/LabScanAcceptModal.test.tsx`
Expected: FAIL — ไม่เจอ placeholder `พิมพ์เลขที่คำร้อง` (ยังไม่มี input) / ไม่เจอปุ่ม `รับงาน` ใน phase no-camera

- [ ] **Step 3: เพิ่ม state `manualCode`**

ใน `LabScanAcceptModal.tsx` หลังบรรทัด `const scannerRef = useRef<Html5Qrcode | null>(null);` (บรรทัด 61) เพิ่ม:

```tsx
  const [manualCode, setManualCode] = useState('');
```

(`useState` import อยู่แล้วบรรทัด 1)

- [ ] **Step 4: เพิ่ม handler + form UI**

หาบล็อก no-camera (บรรทัด ~237-239):

```tsx
          {phase === 'no-camera' && (
            <p className="text-center text-sm text-grey-500">ไม่พบกล้องในอุปกรณ์นี้</p>
          )}
```

แทนที่ด้วย (เพิ่ม form ต่อท้าย โชว์ทั้ง scanning + no-camera):

```tsx
          {phase === 'no-camera' && (
            <p className="text-center text-sm text-grey-500">ไม่พบกล้องในอุปกรณ์นี้</p>
          )}

          {(phase === 'scanning' || phase === 'no-camera') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = manualCode.trim();
                if (!code) return;
                setManualCode('');
                fetchAndCheck(code);
              }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 text-xs text-grey-400">
                <div className="h-px flex-1 bg-grey-200" />
                <span>หรือ</span>
                <div className="h-px flex-1 bg-grey-200" />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="พิมพ์เลขที่คำร้อง เช่น P-2506-0001"
                  className="flex-1 rounded-lg border border-grey-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
                />
                <Button type="submit" variant="primary" disabled={!manualCode.trim()}>
                  รับงาน
                </Button>
              </div>
            </form>
          )}
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npx vitest run src/components/petition/__tests__/LabScanAcceptModal.test.tsx`
Expected: PASS ทั้ง 2 เคส

- [ ] **Step 6: type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่จากไฟล์นี้ (repo มี latent error เดิม ~12 ตัว — ตรวจว่าไม่เพิ่มจาก LabScanAcceptModal.tsx)

- [ ] **Step 7: commit**

```bash
git add src/components/petition/LabScanAcceptModal.tsx src/components/petition/__tests__/LabScanAcceptModal.test.tsx
git commit -m "feat(lab): manual petitionNo entry as alternative to QR scan on accept"
```

---

### Task 2: QrReceiveModal — ช่องกรอกเลขที่คำร้อง (QC)

**Files:**
- Test: `src/components/petition/__tests__/QrReceiveModal.test.tsx` (create)
- Modify: `src/components/petition/QrReceiveModal.tsx`

- [ ] **Step 1: เขียน failing test**

สร้างไฟล์ `src/components/petition/__tests__/QrReceiveModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QrReceiveModal from '../QrReceiveModal';

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = vi.fn().mockRejectedValue(new Error('no camera'));
    stop = vi.fn().mockResolvedValue(undefined);
    getState = vi.fn().mockReturnValue(2);
    static getCameras = vi.fn().mockResolvedValue([]);
  },
  Html5QrcodeScannerState: { SCANNING: 2, PAUSED: 3 },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Tester', email: 't@t.com' } }),
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}));

import { api } from '@/lib/api';

const qcPetition = {
  _id: 'pet1',
  petitionNo: 'P-2506-0002',
  dept: 'production',
  status: 'sampleSent',
  submittedBy: { name: 'ผู้ส่ง' },
  items: [{ seq: 1, sampleName: 'ตัวอย่าง A' }],
};

function renderModal() {
  return render(
    <MemoryRouter>
      <QrReceiveModal open onClose={() => {}} onReceived={() => {}} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QrReceiveModal manual entry', () => {
  it('แสดงช่องกรอกเลขที่คำร้องเมื่อไม่มีกล้อง', async () => {
    renderModal();
    expect(
      await screen.findByPlaceholderText(/พิมพ์เลขที่คำร้อง/),
    ).toBeInTheDocument();
  });

  it('พิมพ์เลขที่คำร้องแล้ว submit → เข้าจอ confirm', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: qcPetition },
    });
    renderModal();

    const input = await screen.findByPlaceholderText(/พิมพ์เลขที่คำร้อง/);
    fireEvent.change(input, { target: { value: 'P-2506-0002' } });
    fireEvent.click(screen.getByRole('button', { name: 'รับตัวอย่าง' }));

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/petitions/scan/P-2506-0002'),
      ),
    );
    expect(await screen.findByText('P-2506-0002')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/components/petition/__tests__/QrReceiveModal.test.tsx`
Expected: FAIL — ไม่เจอ placeholder / ปุ่ม `รับตัวอย่าง` ใน phase no-camera

- [ ] **Step 3: เพิ่ม state `manualCode`**

ใน `QrReceiveModal.tsx` หลังบรรทัด `const flashTimer = useRef<number | null>(null);` (บรรทัด 72) เพิ่ม:

```tsx
  const [manualCode, setManualCode] = useState('');
```

(`useState` import อยู่แล้วบรรทัด 1)

- [ ] **Step 4: เพิ่ม handler + form UI**

หาบล็อก no-camera (บรรทัด ~273-275):

```tsx
          {phase === 'no-camera' && (
            <p className="text-center text-sm text-grey-500">ไม่พบกล้องในอุปกรณ์นี้</p>
          )}
```

แทนที่ด้วย:

```tsx
          {phase === 'no-camera' && (
            <p className="text-center text-sm text-grey-500">ไม่พบกล้องในอุปกรณ์นี้</p>
          )}

          {(phase === 'scanning' || phase === 'no-camera') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = manualCode.trim();
                if (!code) return;
                setManualCode('');
                fetchAndConfirm(code);
              }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 text-xs text-grey-400">
                <div className="h-px flex-1 bg-grey-200" />
                <span>หรือ</span>
                <div className="h-px flex-1 bg-grey-200" />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="พิมพ์เลขที่คำร้อง เช่น P-2506-0001"
                  className="flex-1 rounded-lg border border-grey-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                />
                <Button type="submit" variant="primary" disabled={!manualCode.trim()}>
                  รับตัวอย่าง
                </Button>
              </div>
            </form>
          )}
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npx vitest run src/components/petition/__tests__/QrReceiveModal.test.tsx`
Expected: PASS ทั้ง 2 เคส

- [ ] **Step 6: type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่จาก QrReceiveModal.tsx

- [ ] **Step 7: commit**

```bash
git add src/components/petition/QrReceiveModal.tsx src/components/petition/__tests__/QrReceiveModal.test.tsx
git commit -m "feat(qc): manual petitionNo entry as alternative to QR scan on receive"
```

---

### Task 3: Verify รวม + full test run

- [ ] **Step 1: รัน test ทั้ง suite ให้แน่ใจไม่มีอะไรพัง**

Run: `npm run test`
Expected: test เดิมทั้งหมดยังผ่าน + 4 เคสใหม่ผ่าน

- [ ] **Step 2: Verify จริงในแอป (manual)**

รัน frontend (`npm run dev`) + backend (`cd server && npm run dev`).
- หน้า QC (`/qc-testing`) → กด "สแกน QR รับตัวอย่าง" → พิมพ์ petitionNo ที่สถานะ `sampleSent` → กด "รับตัวอย่าง" → ขึ้นจอ confirm → ยืนยัน → สำเร็จ
- หน้า Lab (`/lab-testing`) → กด "สแกน QR รับงาน" → พิมพ์ petitionNo ที่ถูก assign ให้ตัวเอง → กด "รับงาน" → ขึ้นจอ confirm → รับงาน → เด้งเข้า detail
- ลองพิมพ์เลขมั่ว → ขึ้น error เดิม ("ไม่พบข้อมูลคำร้อง")

---

## Self-Review Notes

- **Spec coverage:** ครบทุกข้อ — ช่องกรอกทั้ง Lab+QC (Task 1,2), reuse fetch เดิม (form onSubmit), โชว์ทั้ง scanning+no-camera, ไม่แตะ backend, ปุ่ม disabled เมื่อว่าง, placeholder format `P-YYMM-####`.
- **No placeholders:** code เต็มทุก step.
- **Type consistency:** `manualCode`/`setManualCode`, `fetchAndCheck` (Lab) vs `fetchAndConfirm` (QC) ตรงกับชื่อจริงในแต่ละไฟล์.
