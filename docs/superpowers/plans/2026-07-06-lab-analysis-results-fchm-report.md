# ผลวิเคราะห์ Lab + รายงานผลฟอร์ม F-CHM-01-03 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับหน้า `/record-results` เป็น "ผลวิเคราะห์ Lab" (แสดงคำร้องที่หัวหน้า Lab อนุมัติแล้ว) และคลิกแล้วเปิดใบรายงานผลตามฟอร์ม F-CHM-01-03 ที่ป้อนด้วยข้อมูลจริง

**Architecture:** แยก 3 ชั้น — `labReport.ts` (pure model builder, มี test) → `LabResultReportTemplate.tsx` (presentational, วาดฟอร์ม F-CHM จาก model) → `LabReportDialog.tsx` (โหลดข้อมูล + พิมพ์). เพิ่ม filter `labApproved` ที่ server/hook แล้ว rewire หน้า `AnalysisResults.tsx`; ลบ `COADialog.tsx` (dead code) ที่เป็นต้นแบบ layout.

**Tech Stack:** React 18 + TypeScript + Vite, TanStack Query, shadcn/ui Dialog, Vitest, Express + Mongoose

## Global Constraints

- UI ทุกส่วนเป็นภาษาไทย (ยึดสำนวนเดิมในหน้า)
- ฟอร์มพิมพ์กว้าง 210mm (A4) — preview ต้องไม่มี horizontal scroll (ScaledPreview ย่อพอดีจอ)
- คอลัมน์ "วิธีทดสอบ" v1 แสดง `-` เสมอ (Parameter ไม่มี field method)
- list แสดงเฉพาะคำร้องที่ `labApprovedAt != null`
- คอลัมน์ผลกรองเฉพาะ `scope === 'lab'` — ผล QC ต้องไม่หลุดเข้ารายงาน
- path route `/record-results` คงเดิม (access-control อ้าง path นี้) — เปลี่ยนแค่ label/เนื้อหา
- type-check ด้วย `npx tsc -p tsconfig.app.json` (root tsconfig เป็น no-op), test ด้วย `npm run test`
- commit เฉพาะไฟล์ตัวเองด้วย explicit pathspec (มี committer อื่นในรีโป), ปิดท้าย message ด้วย `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Task 1: `labReport.ts` — pure model builder

**Files:**
- Create: `src/lib/labReport.ts`
- Test: `src/lib/labReport.test.ts`

**Interfaces:**
- Consumes: `Petition`, `PetitionItem`, `PETITION_DEPT_LABELS` (`@/types/petition.types`); `LabRequest` (`@/types/labRequest.types`); `ApprovalItemGroup` (`@/lib/qcApprovalRows` — มี `.seq:number`, `.params: { scope:'lab'|'qc'; rows: { label:string; unit?:string; value:string; standardText:string }[] }[]`)
- Produces: `buildLabReportPages(petition, labRequests, groups): LabReportPage[]`, `buddhistDate(iso?): string`, และ types `LabReportPage`, `LabReportRow`

- [ ] **Step 1: Write the failing test**

Create `src/lib/labReport.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildLabReportPages, buddhistDate } from "@/lib/labReport";
import type { Petition } from "@/types/petition.types";
import type { LabRequest } from "@/types/labRequest.types";
import type { ApprovalItemGroup } from "@/lib/qcApprovalRows";

const petition = {
  _id: "pt1",
  petitionNo: "P-2606-0018",
  dept: "production",
  submittedBy: { name: "สมชาย" },
  items: [
    {
      seq: 1,
      sampleName: "Gly",
      commonName: "Glyphosate",
      batchNo: "26RD-001",
      sampleId: "S1",
      condition: "normal",
      productionDate: "2026-01-10T00:00:00.000Z",
      submissionNo: "SUB-1",
      labelManufacturer: "ICP",
    },
    {
      seq: 2,
      sampleName: "Para",
      commonName: "Paraquat",
      batchNo: "26RD-002",
      sampleId: "S2",
      condition: "defective",
    },
  ],
  labReceivedAt: "2026-01-11T00:00:00.000Z",
  firstResultAt: "2026-01-12T00:00:00.000Z",
  labCompletedBy: "นุชจรินทร์",
  labApprovedAt: "2026-01-15T00:00:00.000Z",
  labApprovedBy: "นคร",
} as unknown as Petition;

const labRequests = [
  {
    _id: "lr1",
    labRequestNo: "LR-001",
    petitionId: "pt1",
    petitionNo: "P-2606-0018",
    batchNo: "26RD-001",
    sampleSeq: 1,
    reportCustomerName: "",
    requester: { fullName: "คุณเอ", department: "RD", email: "a@x.com", phone: "012" },
  },
] as unknown as LabRequest[];

const groups: ApprovalItemGroup[] = [
  {
    seq: 1,
    sampleName: "Gly",
    batchNo: "26RD-001",
    sampleId: "S1",
    commonName: "Glyphosate",
    unmatched: false,
    params: [
      {
        parameterId: "p1",
        parameterName: "ปริมาณสาร",
        scope: "lab",
        hasPhases: false,
        rows: [
          { key: "k1", label: "Glyphosate", unit: "%w/v", value: "48.2", standardText: "45.5-50.5", abnormal: false, note: "", phase: 1 },
        ],
      },
      {
        parameterId: "p2",
        parameterName: "pH (QC)",
        scope: "qc",
        hasPhases: false,
        rows: [
          { key: "k2", label: "pH", value: "7", standardText: "6-8", abnormal: false, note: "", phase: 1 },
        ],
      },
    ],
  },
];

describe("buddhistDate", () => {
  it("แปลงเป็น พ.ศ. dd/mm/yyyy", () => {
    expect(buddhistDate("2026-01-15T00:00:00.000Z")).toBe("15/01/2569");
  });
  it("ค่าว่าง → ''", () => {
    expect(buddhistDate(undefined)).toBe("");
    expect(buddhistDate(null)).toBe("");
  });
});

describe("buildLabReportPages", () => {
  const pages = buildLabReportPages(petition, labRequests, groups);

  it("สร้าง 1 หน้าต่อ 1 item", () => {
    expect(pages).toHaveLength(2);
  });

  it("map ข้อมูลลูกค้า/ตัวอย่าง หน้าแรกถูกต้อง", () => {
    const p = pages[0];
    expect(p.reportNo).toBe("LR-001");
    expect(p.reportDate).toBe("15/01/2569");
    expect(p.customer.name).toBe("คุณเอ"); // reportCustomerName ว่าง → requester.fullName
    expect(p.customer.company).toBe("บริษัท ไอ ซี พี ลัดดา จำกัด");
    expect(p.customer.department).toBe("RD");
    expect(p.customer.email).toBe("a@x.com");
    expect(p.sample.name).toBe("Glyphosate");
    expect(p.sample.sampleNo).toBe("S1");
    expect(p.sample.receivedDate).toBe("11/01/2569");
    expect(p.sample.reportedDate).toBe("15/01/2569");
    expect(p.sample.condition).toBe("ปกติ");
    expect(p.analystName).toBe("นุชจรินทร์");
    expect(p.labHeadName).toBe("นคร");
  });

  it("แถวผลกรองเฉพาะ scope=lab, method='-'", () => {
    const p = pages[0];
    expect(p.rows).toHaveLength(1); // qc row ถูกตัดออก
    expect(p.rows[0]).toEqual({
      testItem: "Glyphosate (%w/v)",
      result: "48.2",
      criteria: "45.5-50.5",
      method: "-",
    });
  });

  it("item ที่ไม่มี group → rows ว่าง + fallback ลูกค้า", () => {
    const p = pages[1];
    expect(p.rows).toHaveLength(0);
    expect(p.customer.name).toBe("สมชาย"); // ไม่มี labRequest → submittedBy.name
    expect(p.customer.department).toBe("แผนกผลิต"); // PETITION_DEPT_LABELS[production]
    expect(p.sample.condition).toBe("บกพร่อง");
  });

  it("reportCustomerName ถ้ามี ชนะ requester.fullName", () => {
    const lr2 = [{ ...labRequests[0], reportCustomerName: "ลูกค้าพิเศษ" }] as unknown as LabRequest[];
    const out = buildLabReportPages(petition, lr2, groups);
    expect(out[0].customer.name).toBe("ลูกค้าพิเศษ");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/labReport.test.ts`
Expected: FAIL — "Failed to resolve import @/lib/labReport" / buildLabReportPages is not a function

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/labReport.ts`:

```ts
import type { LabRequest } from "@/types/labRequest.types";
import type { Petition, PetitionItem } from "@/types/petition.types";
import { PETITION_DEPT_LABELS } from "@/types/petition.types";
import type { ApprovalItemGroup } from "@/lib/qcApprovalRows";

export interface LabReportRow {
  testItem: string;
  result: string;
  criteria: string;
  method: string;
}

export interface LabReportPage {
  reportNo: string;
  reportDate: string;
  customer: { name: string; company: string; department: string; email: string; phone: string };
  sample: {
    name: string;
    batchNo: string;
    productionDate: string;
    submissionNo: string;
    manufacturer: string;
    sampleNo: string;
    receivedDate: string;
    testedDate: string;
    reportedDate: string;
    condition: string;
  };
  rows: LabReportRow[];
  analystName: string;
  labHeadName: string;
  remark: string;
}

const DASH = "-";
const COMPANY_NAME = "บริษัท ไอ ซี พี ลัดดา จำกัด";

export function buddhistDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yy}`;
}

// จับคู่ labRequest ต่อ item — ตำแหน่ง sampleSeq ก่อน, batchNo รอง, ตัวแรกเป็น fallback
function labRequestForItem(item: PetitionItem, labRequests: LabRequest[]): LabRequest | undefined {
  return (
    labRequests.find((lr) => lr.sampleSeq === item.seq) ??
    labRequests.find((lr) => lr.batchNo === item.batchNo) ??
    labRequests[0]
  );
}

function rowsForItem(group: ApprovalItemGroup | undefined): LabReportRow[] {
  if (!group) return [];
  const out: LabReportRow[] = [];
  group.params
    .filter((p) => p.scope === "lab")
    .forEach((p) => {
      p.rows.forEach((r) => {
        const unit = r.unit ? ` (${r.unit})` : "";
        out.push({
          testItem: `${r.label}${unit}`,
          result: r.value || DASH,
          criteria: r.standardText || DASH,
          method: DASH,
        });
      });
    });
  return out;
}

const conditionText = (c?: string) =>
  c === "normal" ? "ปกติ" : c === "defective" ? "บกพร่อง" : DASH;

export function buildLabReportPages(
  petition: Petition,
  labRequests: LabRequest[],
  groups: ApprovalItemGroup[],
): LabReportPage[] {
  const groupBySeq = new Map<number, ApprovalItemGroup>();
  groups.forEach((g) => groupBySeq.set(g.seq, g));

  const reportedDate = buddhistDate(petition.labApprovedAt);
  const analystName = petition.labCompletedBy || DASH;
  const labHeadName = petition.labApprovedBy || DASH;

  return (petition.items ?? []).map((item) => {
    const lr = labRequestForItem(item, labRequests);
    const requester = lr?.requester;
    return {
      reportNo: lr?.labRequestNo || petition.petitionNo,
      reportDate: reportedDate,
      customer: {
        name: lr?.reportCustomerName || requester?.fullName || petition.submittedBy?.name || DASH,
        company: COMPANY_NAME,
        department: requester?.department || PETITION_DEPT_LABELS[petition.dept] || DASH,
        email: requester?.email || DASH,
        phone: requester?.phone || DASH,
      },
      sample: {
        name: item.commonName || item.sampleName || DASH,
        batchNo: item.batchNo || item.lotNo || DASH,
        productionDate: buddhistDate(item.productionDate) || DASH,
        submissionNo: item.submissionNo || lr?.labRequestNo || petition.petitionNo,
        manufacturer: item.labelManufacturer || item.labelSeller || DASH,
        sampleNo: item.sampleId || lr?.labRequestNo || DASH,
        receivedDate: buddhistDate(petition.labReceivedAt || petition.receivedAt || petition.sampleSentAt) || DASH,
        testedDate: buddhistDate(petition.firstResultAt || petition.labCompletedAt) || DASH,
        reportedDate: reportedDate || DASH,
        condition: conditionText(item.condition),
      },
      rows: rowsForItem(groupBySeq.get(item.seq)),
      analystName,
      labHeadName,
      remark: petition.conclusionNote || "",
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/labReport.test.ts`
Expected: PASS (ทุก it เขียว)

- [ ] **Step 5: Commit**

```bash
git add src/lib/labReport.ts src/lib/labReport.test.ts
git commit -m "feat(lab-report): buildLabReportPages pure model builder + tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `LabResultReportTemplate.tsx` — presentational ฟอร์ม F-CHM

**Files:**
- Create: `src/components/petition/LabResultReportTemplate.tsx`

**Interfaces:**
- Consumes: `LabReportPage` (`@/lib/labReport`); `ICP_LADDA_LOGO_URL` (`@/lib/branding`)
- Produces: `export default function LabResultReportTemplate({ pages }: { pages: LabReportPage[] })`, `export const LAB_REPORT_CSS: string`

- [ ] **Step 1: Create the component**

Create `src/components/petition/LabResultReportTemplate.tsx`:

```tsx
import { ICP_LADDA_LOGO_URL } from "@/lib/branding";
import type { LabReportPage } from "@/lib/labReport";

export const LAB_REPORT_CSS = `
.lr-root, .lr-root * { box-sizing: border-box; color: #000; font-family: 'Sarabun', 'TH SarabunPSK', 'Kanit', Arial, sans-serif; }
.lr-page { width: 210mm; padding: 12mm; background: #fff; font-size: 12pt; }
.lr-page + .lr-page { margin-top: 6mm; page-break-before: always; break-before: page; }
.lr-tbl { width: 100%; border-collapse: collapse; table-layout: fixed; }
.lr-tbl td, .lr-tbl th { border: 0.8pt solid #000; padding: 2.4mm; vertical-align: top; word-break: break-word; }
.lr-nt { border-top: 0; }
.lr-strong { font-weight: 700; }
.lr-small { font-size: 9.5pt; line-height: 1.35; }
.lr-center { text-align: center; }
.lr-right { text-align: right; }
.lr-italic { font-style: italic; }
.lr-half { width: 50%; }
.lr-logo { height: 16mm; margin-bottom: 1.5mm; }
.lr-hd-mid { text-align: center; vertical-align: middle; font-weight: 700; font-size: 13pt; }
.lr-title { text-align: center; font-weight: 700; font-size: 14pt; }
.lr-results th { text-align: center; background: #f3f3f3; }
.lr-muted { color: #555; }
.lr-remark { margin-top: 5mm; font-size: 11pt; }
.lr-sign { margin-top: 10mm; text-align: center; font-size: 11pt; }
.lr-sigline { display: inline-block; border-bottom: 0.8pt dotted #000; min-width: 62mm; margin: 0 2mm; }
.lr-sign-name { margin-top: 1mm; }
.lr-sign-gap { margin-top: 8mm; }
.lr-note { margin-top: 8mm; font-size: 9.5pt; }
.lr-note-ind { margin-left: 12mm; }
.lr-foot { display: flex; justify-content: space-between; margin-top: 6mm; font-size: 9.5pt; color: #444; }
@media screen { .lr-page { margin: 0 auto; box-shadow: 0 0 0 1px #ddd; } }
`;

export default function LabResultReportTemplate({ pages }: { pages: LabReportPage[] }) {
  return (
    <div className="lr-root">
      <style>{LAB_REPORT_CSS}</style>
      {pages.map((page, i) => (
        <section className="lr-page" key={i}>
          {/* Header */}
          <table className="lr-tbl">
            <tbody>
              <tr>
                <td style={{ width: "34%" }}>
                  <img className="lr-logo" src={ICP_LADDA_LOGO_URL} alt="ICP Ladda" />
                  <div className="lr-strong">บริษัท ไอ ซี พี ลัดดา จำกัด</div>
                  <div className="lr-small">
                    151 หมู่ 8 ตำบลสามควายเผือก อำเภอเมือง<br />
                    นครปฐม จังหวัดนครปฐม 73000<br />
                    โทรศัพท์ : 034-305281-2
                  </div>
                </td>
                <td className="lr-hd-mid">ห้องปฏิบัติการบริษัท ไอ ซี พี ลัดดา จำกัด</td>
                <td style={{ width: "27%" }}>
                  <div className="lr-right lr-small">หน้า {i + 1}/{pages.length}</div>
                  <div className="lr-small">เลขที่รายงาน {page.reportNo}</div>
                  <div className="lr-small">วันที่ {page.reportDate || "-"}</div>
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="lr-title">รายงานผลการทดสอบ</td>
              </tr>
            </tbody>
          </table>

          {/* Customer + sample */}
          <table className="lr-tbl lr-nt">
            <tbody>
              <tr>
                <td className="lr-half">
                  <div className="lr-right lr-italic lr-small">ข้อมูลจากลูกค้า</div>
                  <div>ชื่อ : {page.customer.name}</div>
                  <div>บริษัท : {page.customer.company}</div>
                  <div>หน่วยงาน : {page.customer.department}</div>
                  <div>Email : {page.customer.email}</div>
                  <div>โทร : {page.customer.phone}</div>
                </td>
                <td className="lr-half">
                  <div className="lr-right lr-italic lr-small">ข้อมูลตัวอย่าง</div>
                  <div>ชื่อตัวอย่าง : {page.sample.name}</div>
                  <div>แบทช์หมายเลข : {page.sample.batchNo}</div>
                  <div>วันที่ผลิต/นำเข้า : {page.sample.productionDate}</div>
                  <div>เลขที่ใบนำส่ง : {page.sample.submissionNo}</div>
                  <div>ผู้ผลิต/ผู้ขาย : {page.sample.manufacturer}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Sample dates */}
          <table className="lr-tbl lr-nt">
            <tbody>
              <tr>
                <td className="lr-half">เลขที่ตัวอย่าง : {page.sample.sampleNo}</td>
                <td className="lr-half">วันที่รับตัวอย่าง : {page.sample.receivedDate}</td>
              </tr>
              <tr>
                <td>วันที่ทดสอบ : {page.sample.testedDate}</td>
                <td>วันที่รายงานผล : {page.sample.reportedDate}</td>
              </tr>
              <tr>
                <td colSpan={2}>สภาพตัวอย่าง : {page.sample.condition}</td>
              </tr>
            </tbody>
          </table>

          {/* Results */}
          <table className="lr-tbl lr-results lr-nt">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>รายการทดสอบ</th>
                <th style={{ width: "22%" }}>ผลการทดสอบ</th>
                <th style={{ width: "24%" }}>เกณฑ์กำหนด</th>
                <th style={{ width: "22%" }}>วิธีทดสอบ</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.length ? (
                page.rows.map((r, ri) => (
                  <tr key={ri}>
                    <td className="lr-center">{r.testItem}</td>
                    <td className="lr-center">{r.result}</td>
                    <td className="lr-center">{r.criteria}</td>
                    <td className="lr-center">{r.method}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="lr-center lr-muted">ไม่พบผลทดสอบฝั่ง Lab</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="lr-remark">หมายเหตุ : {page.remark}</div>

          {/* Signatures */}
          <div className="lr-sign">
            <div>ผู้ทดสอบ <span className="lr-sigline" /> นักเคมี</div>
            <div className="lr-sign-name">( {page.analystName} )</div>
            <div className="lr-sign-gap">ผู้อนุมัติ / ผู้ตรวจสอบ <span className="lr-sigline" /> หัวหน้าห้องปฏิบัติการ</div>
            <div className="lr-sign-name">( {page.labHeadName} )</div>
          </div>

          <div className="lr-note">
            <div><strong>หมายเหตุ</strong> รายงานนี้มีผลเฉพาะกับตัวอย่างที่นำมาทดสอบเท่านั้น</div>
            <div className="lr-note-ind">
              รายงานผลทดสอบต้องไม่ถูกทำสำเนาเฉพาะเพียงบางส่วน โดยได้รับความยินยอมเป็นลายลักษณ์อักษรจากห้องปฏิบัติการ ยกเว้นทำทั้งฉบับ
            </div>
          </div>

          <div className="lr-foot">
            <span>F-CHM-01-03 Rev 00 16/01/69</span>
            <span>End of Report</span>
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่จากไฟล์นี้ (repo มี latent error เดิม ~12 — ตรวจว่าไม่มีบรรทัดที่ชี้ `LabResultReportTemplate.tsx`)

- [ ] **Step 3: Commit**

```bash
git add src/components/petition/LabResultReportTemplate.tsx
git commit -m "feat(lab-report): F-CHM-01-03 presentational template

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `LabReportDialog.tsx` — dialog โหลดข้อมูล + พิมพ์

**Files:**
- Create: `src/components/lis/LabReportDialog.tsx`

**Interfaces:**
- Consumes: `buildLabReportPages` (`@/lib/labReport`); `LabResultReportTemplate`, `LAB_REPORT_CSS` (`@/components/petition/LabResultReportTemplate`); `buildApprovalGroups` (`@/lib/qcApprovalRows`); `useLabRequestsByPetition` (`@/hooks/usePetition`); `useItemGroupMembership` (`@/hooks/useItemGroupMembership`); `api` + `ParameterItem` (`@/lib/api`); `PrintPreviewDialog` (`@/components/lis/PrintPreviewDialog`); UI `Dialog*`, `Button`; `Petition`, `QCTestResult` (`@/types/petition.types`)
- Produces: `export default function LabReportDialog({ open, onOpenChange, petition }: { open: boolean; onOpenChange: (v: boolean) => void; petition: Petition | null })`

- [ ] **Step 1: Create the component**

Create `src/components/lis/LabReportDialog.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { api, type ParameterItem } from "@/lib/api";
import { useLabRequestsByPetition } from "@/hooks/usePetition";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { buildApprovalGroups } from "@/lib/qcApprovalRows";
import { buildLabReportPages } from "@/lib/labReport";
import LabResultReportTemplate, { LAB_REPORT_CSS } from "@/components/petition/LabResultReportTemplate";
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
import type { Petition, QCTestResult } from "@/types/petition.types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  petition: Petition | null;
}

export default function LabReportDialog({ open, onOpenChange, petition }: Props) {
  const petitionId = petition?._id;
  const { data: labRequests } = useLabRequestsByPetition(petitionId);
  const groupMembership = useItemGroupMembership();
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [results, setResults] = useState<QCTestResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .getParameters()
      .then((all) =>
        setParameters(all.filter((p) => p.scope === "lab" || (p.scope === "qc" && p.shareWithLab === true))),
      )
      .catch(() => setParameters([]));
  }, [open]);

  useEffect(() => {
    if (!open || !petitionId) return;
    setLoaded(false);
    api
      .getQCResults(petitionId)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoaded(true));
  }, [open, petitionId]);

  const pages = useMemo(() => {
    if (!petition) return [];
    const groups = buildApprovalGroups(petition, parameters, results, groupMembership);
    return buildLabReportPages(petition, labRequests ?? [], groups);
  }, [petition, parameters, results, groupMembership, labRequests]);

  const report = <LabResultReportTemplate pages={pages} />;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>ใบรายงานผลการทดสอบ — {petition?.petitionNo ?? ""}</DialogTitle>
          </DialogHeader>

          {!loaded ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังโหลด…
            </div>
          ) : (
            <div className="overflow-x-auto">{report}</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
            <Button onClick={() => setPrintOpen(true)} disabled={!loaded || pages.length === 0} className="gap-2">
              <Printer className="h-4 w-4" /> พิมพ์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintPreviewDialog open={printOpen} onOpenChange={setPrintOpen} docType="coa" css={LAB_REPORT_CSS}>
        {report}
      </PrintPreviewDialog>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่ที่ชี้ `LabReportDialog.tsx` (ยืนยันว่า `useLabRequestsByPetition`, `api.getParameters`, `api.getQCResults` มีจริง — ทั้งหมดถูกใช้แบบเดียวกันใน `src/pages/LabApprovalReviewPage.tsx`)

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/LabReportDialog.tsx
git commit -m "feat(lab-report): LabReportDialog — load data + print F-CHM report

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: filter `labApproved` ที่ server + hook

**Files:**
- Modify: `server/routes/petitions.js:103` (เพิ่ม block หลัง `awaitingLabApproval`)
- Modify: `src/hooks/usePetition.ts:79` (เพิ่ม field ใน `PetitionListParams`) และ `:112` (set query param)

**Interfaces:**
- Produces: query param `?labApproved=true` → server ตอบเฉพาะ petition ที่ `labApprovedAt != null`; hook รับ `labApproved?: boolean`

- [ ] **Step 1: แก้ server route**

ใน `server/routes/petitions.js` แทรกหลังบล็อก `awaitingLabApproval` (หลังบรรทัด `}` ที่ปิด block นั้น — เดิมคือบรรทัด 103):

เปลี่ยนจาก:

```js
    if (req.query.awaitingLabApproval === 'true') {
      q.labCompletedAt = { $ne: null };
      q.labApprovedAt = null;
      q.status = 'inProgress';
    }

    const [docs, total] = await Promise.all([
```

เป็น:

```js
    if (req.query.awaitingLabApproval === 'true') {
      q.labCompletedAt = { $ne: null };
      q.labApprovedAt = null;
      q.status = 'inProgress';
    }
    if (req.query.labApproved === 'true') {
      q.labApprovedAt = { $ne: null };
    }

    const [docs, total] = await Promise.all([
```

- [ ] **Step 2: แก้ hook type + query builder**

ใน `src/hooks/usePetition.ts` เพิ่ม field ใน `PetitionListParams` (เดิมบรรทัด ~79):

เปลี่ยนจาก:

```ts
  dept?: PetitionDept;
  awaitingLabApproval?: boolean;
}
```

เป็น:

```ts
  dept?: PetitionDept;
  awaitingLabApproval?: boolean;
  labApproved?: boolean;
}
```

และในตัวสร้าง `queryString` (เดิมบรรทัด ~112) เปลี่ยนจาก:

```ts
    if (params.awaitingLabApproval) sp.set('awaitingLabApproval', 'true');
    return sp.toString();
```

เป็น:

```ts
    if (params.awaitingLabApproval) sp.set('awaitingLabApproval', 'true');
    if (params.labApproved) sp.set('labApproved', 'true');
    return sp.toString();
```

- [ ] **Step 3: Verify — server filter ตอบถูก**

ต้องมี backend รันอยู่ (`cd server && npm run dev`). ยิงเทียบผล 2 คำสั่ง:

Run: `curl -s "http://localhost:3001/api/petitions?labApproved=true&limit=5"`
Expected: JSON `{ items: [...] }` โดยทุก item มี `labApprovedAt` ไม่ใช่ null (เทียบกับ `?limit=5` เปล่าที่จะมี item ที่ `labApprovedAt` เป็น null ปนได้)

- [ ] **Step 4: Type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่

- [ ] **Step 5: Commit**

```bash
git add server/routes/petitions.js src/hooks/usePetition.ts
git commit -m "feat(petitions): labApproved list filter (labApprovedAt != null)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: rewire `AnalysisResults.tsx` + nav label + ลบ COADialog

**Files:**
- Modify: `src/pages/AnalysisResults.tsx` (เขียนใหม่ทั้งไฟล์ — Lab scope + เปิด dialog)
- Modify: `src/lib/navItems.ts:37` (label "ผลวิเคราะห์" → "ผลวิเคราะห์ Lab")
- Delete: `src/components/lis/COADialog.tsx`

**Interfaces:**
- Consumes: `usePetitionList` (`@/hooks/usePetition`) ด้วย `{ labApproved: true }`; `LabReportDialog` (`@/components/lis/LabReportDialog`); `Petition`, `PETITION_DEPT_LABELS` (`@/types/petition.types`); `AppLayout`

- [ ] **Step 1: เขียน `AnalysisResults.tsx` ใหม่**

แทนที่ทั้งไฟล์ `src/pages/AnalysisResults.tsx` ด้วย:

```tsx
import { useMemo, useState } from "react";
import AppLayout from "@/components/lis/AppLayout";
import LabReportDialog from "@/components/lis/LabReportDialog";
import { usePetitionList } from "@/hooks/usePetition";
import { PETITION_DEPT_LABELS, type Petition } from "@/types/petition.types";

export default function AnalysisResults() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Petition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // คำร้องฝั่ง Lab ที่หัวหน้าห้องปฏิบัติการอนุมัติผลแล้ว
  const { data, loading } = usePetitionList({ labApproved: true, limit: 100 });

  const rows = useMemo(() => {
    const items = (data?.items ?? []) as Petition[];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      `${p.petitionNo} ${p.submittedBy?.name ?? ""}`.toLowerCase().includes(q),
    );
  }, [data, search]);

  const openReport = (p: Petition) => {
    setSelected(p);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-lis-text">ผลวิเคราะห์ Lab</h1>
          <p className="text-sm text-gray-500">คำร้องที่หัวหน้าห้องปฏิบัติการอนุมัติผลแล้ว</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเลขคำร้อง / ผู้ส่ง"
            className="rounded-md border px-3 py-1.5 text-sm"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">เลขคำร้อง</th>
                <th className="px-3 py-2">แผนก</th>
                <th className="px-3 py-2">ผู้ส่ง</th>
                <th className="px-3 py-2">วันที่อนุมัติ Lab</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">กำลังโหลด…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">ยังไม่มีคำร้องที่หัวหน้า Lab อนุมัติ</td></tr>
              )}
              {rows.map((p) => (
                <tr
                  key={p._id}
                  onClick={() => openReport(p)}
                  className="cursor-pointer border-t hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium">{p.petitionNo}</td>
                  <td className="px-3 py-2">{PETITION_DEPT_LABELS[p.dept]}</td>
                  <td className="px-3 py-2">{p.submittedBy?.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    {p.labApprovedAt ? new Date(p.labApprovedAt).toLocaleDateString("th-TH") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LabReportDialog open={dialogOpen} onOpenChange={setDialogOpen} petition={selected} />
    </AppLayout>
  );
}
```

- [ ] **Step 2: เปลี่ยน nav label**

ใน `src/lib/navItems.ts` (บรรทัด 37) เปลี่ยนจาก:

```ts
  { icon: ClipboardList, label: "ผลวิเคราะห์", path: "/record-results" },
```

เป็น:

```ts
  { icon: ClipboardList, label: "ผลวิเคราะห์ Lab", path: "/record-results" },
```

- [ ] **Step 3: ลบ COADialog (dead code)**

Run: `git rm src/components/lis/COADialog.tsx`
Expected: ลบสำเร็จ (grep ยืนยันไม่มี import ที่อื่น — ตรวจซ้ำด้วยคำสั่งถัดไป)

Run: `git grep -n "COADialog" -- "src/*" || echo "no references"`
Expected: `no references` (ถ้ายังเจอ import ค้าง ให้ลบ import นั้นก่อน — ไม่ควรมีตามที่สำรวจแล้ว)

- [ ] **Step 4: Type-check + lint + test**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่ที่ชี้ `AnalysisResults.tsx` / `navItems.ts`

Run: `npm run lint`
Expected: 0 error ใหม่จากไฟล์ที่แก้

Run: `npm run test -- src/lib/labReport.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/AnalysisResults.tsx src/lib/navItems.ts
git rm src/components/lis/COADialog.tsx
git commit -m "feat(lab-report): rewire ผลวิเคราะห์ Lab list → F-CHM report dialog; drop dead COADialog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Manual E2E (หลังทำครบ 5 tasks)

รันทั้ง 2 process (`npm run dev` + `cd server && npm run dev`) แล้วเปิด Brave/Playwright:

1. ไปเมนู "ผลวิเคราะห์ Lab" — เห็นเฉพาะคำร้องที่หัวหน้า Lab อนุมัติ (วันที่อนุมัติ Lab มีค่า)
2. ค้นหาเลขคำร้อง/ผู้ส่ง — กรองถูกต้อง
3. คลิกแถว → dialog เปิดใบรายงานฟอร์ม F-CHM: header โลโก้+เลขที่รายงาน, 2 คอลัมน์ลูกค้า/ตัวอย่าง, ตาราง 4 คอลัมน์ (เกณฑ์กำหนดมาจาก standard จริง, วิธีทดสอบ = "-"), เซ็นชื่อ นักเคมี(labCompletedBy)+หัวหน้าห้องปฏิบัติการ(labApprovedBy), footer F-CHM-01-03
4. คำร้องหลาย item → หลายหน้าในรายงาน
5. กด "พิมพ์" → PrintPreviewDialog ย่อพอดีจอ **ไม่มี horizontal scroll**; ถ้าตั้งเครื่องพิมพ์ไว้ กดพิมพ์ได้
6. เทียบหน้าตากับไฟล์ `เอกสารที่เกี่ยวข้อง/F-CHM-01-03 Rev 00 160169 ใบรายงานผลการทดสอบ (ฉบับเต็ม).doc`

## Self-Review coverage

- ขอบเขต list `labApprovedAt` → Task 4 (server) + Task 5 (หน้าใช้ `labApproved:true`) ✓
- ปรับหน้าเดิมเป็น Lab (ไม่เปลี่ยน path) → Task 5 + Task 4 (label) ✓
- ฟอร์ม F-CHM ข้อมูลจริง → Task 1 (model) + Task 2 (template) + Task 3 (dialog) ✓
- เกณฑ์กำหนด = standardText, กรอง scope=lab → Task 1 `rowsForItem` ✓
- วิธีทดสอบ = "-" → Task 1 (`method: DASH`) + test ✓
- 1 หน้า/ตัวอย่าง, page-break → Task 1 (map items) + Task 2 (CSS `.lr-page + .lr-page`) ✓
- พิมพ์ผ่าน PrintPreviewDialog docType coa → Task 3 ✓
- ลบ COADialog dead code → Task 5 ✓
- ไม่แตะ ResultReportPrintTemplate / route `/record-results/:id` → ไม่มี task แตะ ✓
```
