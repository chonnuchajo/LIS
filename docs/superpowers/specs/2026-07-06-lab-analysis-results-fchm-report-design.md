# ผลวิเคราะห์ Lab + รายงานผลฟอร์ม F-CHM-01-03 — Design

วันที่: 2026-07-06
สาขา: develop
สถานะ: design (รออนุมัติ)

## เป้าหมาย

ปรับหน้า `/record-results` (ปัจจุบัน = "ผลวิเคราะห์", `AnalysisResults.tsx`) ให้เป็นหน้า **"ผลวิเคราะห์ Lab"** ที่แสดงเฉพาะคำร้องฝั่ง Lab ที่หัวหน้าห้องปฏิบัติการอนุมัติแล้ว เมื่อคลิกแถว → เปิด **ใบรายงานผลการทดสอบตามฟอร์ม F-CHM-01-03 Rev 00 (ฉบับเต็ม)** ที่ป้อนด้วยข้อมูลจริง แทนที่ template Certificate of Analysis เดิม

## บริบทที่สำรวจแล้ว

- **หน้าเดิม** `src/pages/AnalysisResults.tsx` — list คำร้อง `status: approved,rejected` คลิกแล้ว `navigate(/record-results/:id)`; nav label "ผลวิเคราะห์" (`navItems.ts`), route ใน `App.tsx` = `/record-results`
- **ฟอร์ม F-CHM มีอยู่แล้วแต่เป็น dead code** — `src/components/lis/COADialog.tsx` วาด layout ฟอร์ม F-CHM ครบ (header โลโก้+เลขที่รายงาน / 2 คอลัมน์ ข้อมูลลูกค้า+ตัวอย่าง / ตาราง 4 คอลัมน์ รายการทดสอบ·ผลการทดสอบ·เกณฑ์กำหนด·วิธีทดสอบ / เซ็นชื่อ นักเคมี+หัวหน้าห้องปฏิบัติการ / footer "F-CHM-01-03 Rev 00 16/01/69") **แต่ป้อนด้วย mock `SampleItem` + heuristic ปลอม** (spec = ค่า±2.5, method hardcode "CIPAC E", ชื่อผู้เซ็น hardcode) และ **ไม่มีใครเรียกใช้เลย**
- **ตัวประกอบข้อมูลจริงมีครบ** — `buildApprovalGroups()` (`src/lib/qcApprovalRows.ts`) สร้าง row ต่อ item/param/field ที่มี `label`(รายการทดสอบ), `value`(ผลการทดสอบ), `unit`, `standardText`(เกณฑ์กำหนด), และ `scope: 'lab'|'qc'` ให้กรองเฉพาะ Lab ได้
- **สูตรโหลดข้อมูล** จาก `LabApprovalReviewPage.tsx`: `usePetition` + `useLabRequestsByPetition` + `useItemGroupMembership` + `api.getParameters()` (กรอง `scope==='lab' || (scope==='qc' && shareWithLab)`) + `api.getQCResults(id)`
- **ต้นแบบ filter ฝั่ง server** — `server/routes/petitions.js` มี `awaitingLabApproval=true` → `q.labApprovedAt=null; q.status='inProgress'` ใช้แนวเดียวกันเพิ่ม `labApproved=true` ได้

## การตัดสินใจ (ยืนยันกับผู้ใช้แล้ว)

1. **ความสัมพันธ์กับหน้าเดิม** — ปรับหน้าเดิม `/record-results` ให้เป็นสาย Lab (ไม่สร้าง route ใหม่)
2. **ขอบเขต list** — แสดงคำร้องที่ `labApprovedAt != null` (หัวหน้า Lab อนุมัติแล้ว)
3. **คอลัมน์ "วิธีทดสอบ"** — v1 เว้นไว้ แสดง `-` (Parameter ไม่มี field method; ไม่เดา CIPAC)
4. **แนวทางรายงาน** — รื้อ layout จาก COADialog มาทำ template ข้อมูลจริง แล้วลบ COADialog

## สถาปัตยกรรม

แยกเป็น 3 ชั้นชัดเจน (pure model → presentational template → dialog wrapper) + จุดต่อ list/route

### 1. `src/lib/labReport.ts` (ใหม่ — pure, มี test)

ฟังก์ชัน map ข้อมูลดิบ → โครงหน้ารายงาน ทดสอบได้โดยไม่แตะ DOM

```ts
export interface LabReportRow { testItem: string; result: string; criteria: string; method: string; }
export interface LabReportPage {
  reportNo: string;
  reportDate: string;        // พ.ศ.
  customer: { name: string; company: string; department: string; email: string; phone: string };
  sample: {
    name: string; batchNo: string; productionDate: string; submissionNo: string; manufacturer: string;
    sampleNo: string; receivedDate: string; testedDate: string; reportedDate: string; condition: string;
  };
  rows: LabReportRow[];
  analystName: string;       // ผู้ทดสอบ (นักเคมี)
  labHeadName: string;       // ผู้อนุมัติ (หัวหน้าห้องปฏิบัติการ)
  remark: string;
}

export function buildLabReportPages(
  petition: Petition,
  labRequests: LabRequest[],
  groups: ApprovalItemGroup[],   // ผลจาก buildApprovalGroups
): LabReportPage[]
```

**กฎ map (1 หน้า = 1 PetitionItem):**

| ช่องในฟอร์ม | ที่มา |
|---|---|
| เลขที่รายงาน | `labRequest.labRequestNo` ?? `petitionNo` |
| วันที่รายงานผล/วันที่ | `labApprovedAt` |
| ลูกค้า·ชื่อ | `labRequest.reportCustomerName` ?? `requester.fullName` ?? `submittedBy.name` |
| ลูกค้า·บริษัท | `"บริษัท ไอ ซี พี ลัดดา จำกัด"` (ค่าคงที่ภายใน) |
| ลูกค้า·หน่วยงาน | `requester.department` ?? `PETITION_DEPT_LABELS[dept]` |
| ลูกค้า·Email / โทร | `requester.email` / `requester.phone` (ไม่มี → `-`) |
| ตัวอย่าง·ชื่อ | `item.commonName` ?? `item.sampleName` |
| ตัวอย่าง·แบทช์ | `item.batchNo` ?? `item.lotNo` |
| ตัวอย่าง·วันที่ผลิต/นำเข้า | `item.productionDate` |
| ตัวอย่าง·เลขที่ใบนำส่ง | `item.submissionNo` ?? `labRequest.labRequestNo` ?? `petitionNo` |
| ตัวอย่าง·ผู้ผลิต/ผู้ขาย | `item.labelManufacturer` ?? `item.labelSeller` ?? `-` |
| เลขที่ตัวอย่าง | `item.sampleId` ?? `labRequest.labRequestNo` ?? `-` |
| วันที่รับตัวอย่าง | `labReceivedAt` ?? `receivedAt` ?? `sampleSentAt` |
| วันที่ทดสอบ | `firstResultAt` ?? `labCompletedAt` |
| สภาพตัวอย่าง | `item.condition === 'normal' ? 'ปกติ' : (defective ? 'บกพร่อง' : '-')` |
| แถวผล | จาก `groups[seq].params` ที่ `scope==='lab'` → flat rows: `testItem = label (+ ' (unit)')`, `result = value \|\| '-'`, `criteria = standardText \|\| '-'`, `method = '-'` |
| ผู้ทดสอบ | `labCompletedBy` ?? `-` |
| หัวหน้าห้องปฏิบัติการ | `labApprovedBy` ?? `-` |
| หมายเหตุ | `conclusionNote` ?? `''` |

- วันที่ทุกช่องแปลงเป็น พ.ศ. `dd/mm/yyyy` (helper เดียวกับ `buddhistDate`/`toThaiDate`)
- item ที่ไม่มี lab-scoped row → แสดงแถว placeholder "ไม่พบผลทดสอบฝั่ง Lab"
- labRequest ต่อ item: จับคู่ด้วย `sampleSeq === item.seq` ?? `batchNo === item.batchNo` ?? `labRequests[0]` (เลียนแบบ `labRequestFor` ใน ResultReportPrintTemplate)

### 2. `src/components/petition/LabResultReportTemplate.tsx` (ใหม่ — presentational)

- รับ props `{ pages: LabReportPage[] }` วาดตาม layout/CSS ของ COADialog เดิม (ยกโครง table + CSS มาปรับ)
- หนึ่ง `.section` ต่อ 1 page มี `break-inside: avoid` + page-break ระหว่างหน้า
- footer แต่ละหน้า: `F-CHM-01-03 Rev 00 16/01/69` (ซ้าย) · `End of Report` (ขวา)
- ไม่มี logic ดึงข้อมูล — รับ model ล้วน

### 3. `src/components/lis/LabReportDialog.tsx` (ใหม่ — wrapper)

- props `{ open, onOpenChange, petition }`
- เมื่อ `open` โหลด: `labRequests` (`useLabRequestsByPetition`), `parameters` (lab-scoped), `results` (`getQCResults`), `groupMembership` (`useItemGroupMembership`)
- `buildApprovalGroups(...)` → `buildLabReportPages(...)` → ส่งเข้า `LabResultReportTemplate`
- ปุ่ม "พิมพ์" เปิด `PrintPreviewDialog` `docType="coa"` (คง config พิมพ์เดิม), CSS ยกจาก COADialog
- ใช้ `releaseBodyPointerLock`/แนว ConfirmDialog กัน pointer-lock ค้าง

### 4. จุดต่อ list / route / server

- **`src/pages/AnalysisResults.tsx`** — เปลี่ยนหัวข้อ "ผลวิเคราะห์ Lab", คำอธิบาย "คำร้องที่หัวหน้าห้องปฏิบัติการอนุมัติผลแล้ว"; ใช้ `usePetitionList({ labApproved: true, limit: 100 })`; คลิกแถว → set state เปิด `LabReportDialog` (ไม่ navigate); คอลัมน์ตาราง: เลขคำร้อง / แผนก / ผู้ส่ง / วันที่อนุมัติ Lab (`labApprovedAt`); **ลบชุด filter chip conclusion เดิม** (pass/accepted-oos/returned) ทิ้ง เพราะอิงการตัดสินฝั่ง QC ไม่เกี่ยวกับ Lab — เหลือช่องค้นหาเลขคำร้อง/ผู้ส่งอย่างเดียว
- **`src/hooks/usePetition.ts`** — เพิ่ม `labApproved?: boolean` ใน `PetitionListParams` + set `sp.set('labApproved','true')`
- **`server/routes/petitions.js`** — ใน GET list: `if (req.query.labApproved === 'true') q.labApprovedAt = { $ne: null };`
- **`src/lib/navItems.ts`** — label "ผลวิเคราะห์" → "ผลวิเคราะห์ Lab" (path `/record-results` คงเดิม เพื่อไม่กระทบ access-control ที่อ้าง path นี้)
- **ลบ** `src/components/lis/COADialog.tsx`
- **ไม่แตะ** route `/record-results/:id` (Analysis Result Detail) และ flow post-test เดิม

## Data flow

```
AnalysisResults (usePetitionList labApproved)
  └─ คลิกแถว → LabReportDialog(petition)
       ├─ useLabRequestsByPetition / getParameters(lab) / getQCResults / useItemGroupMembership
       ├─ buildApprovalGroups() → ApprovalItemGroup[]
       ├─ buildLabReportPages(petition, labRequests, groups) → LabReportPage[]
       └─ LabResultReportTemplate(pages)  →  PrintPreviewDialog(coa)
```

## Error / edge cases

- คำร้องไม่มี labRequest → ใช้ fallback (`requester` ว่าง → `-`), ยังออกฟอร์มได้
- item ไม่มี lab-scoped result → แถว placeholder, หน้ายังพิมพ์ได้
- `labApprovedBy`/`labCompletedBy` ว่าง → `( - )`
- หลาย item → หลายหน้า (page-break) พิมพ์รวมได้
- list ว่าง → "ยังไม่มีคำร้องที่หัวหน้า Lab อนุมัติ"

## Testing

- **`src/lib/labReport.test.ts`** (Vitest) — TDD `buildLabReportPages`:
  - map ครบทุกช่อง + fallback chain (reportCustomerName → requester → submittedBy)
  - กรองเฉพาะ row `scope==='lab'` (row qc ต้องไม่หลุดเข้ารายงาน)
  - `method` = `-` เสมอ (v1)
  - หลาย item → หลาย page; วันที่เป็น พ.ศ.
  - item ไม่มี row → placeholder
- Manual E2E (Brave + Playwright): เปิดหน้า, คลิกคำร้องที่ Lab อนุมัติ, เทียบหน้าตากับ .doc, กดพิมพ์ preview ไม่มี horizontal scroll
- `npx tsc -p tsconfig.app.json` clean, `npm run lint`, `npm run test`

## ไฟล์ที่เกี่ยวข้อง

ใหม่: `src/lib/labReport.ts`, `src/lib/labReport.test.ts`, `src/components/petition/LabResultReportTemplate.tsx`, `src/components/lis/LabReportDialog.tsx`
แก้: `src/pages/AnalysisResults.tsx`, `src/hooks/usePetition.ts`, `server/routes/petitions.js`, `src/lib/navItems.ts`
ลบ: `src/components/lis/COADialog.tsx`

## นอกขอบเขต (YAGNI)

- ไม่เพิ่ม field วิธีทดสอบ ใน Parameter/DB (v1 แสดง `-`)
- ไม่ทำหน้า QC-scope คู่ขนาน (โฟกัส Lab ตามโจทย์)
- ไม่แก้ ResultReportPrintTemplate (CoA เดิม) — ให้ PetitionDetailPage ใช้ต่อได้
- ไม่ย้าย/เปลี่ยน route path `/record-results`
