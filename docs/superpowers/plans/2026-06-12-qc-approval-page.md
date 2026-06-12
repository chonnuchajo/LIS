# Dedicated QC Approval Review Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้ายการอนุมัติผล QC ออกจากหน้ากรอกผล `QCTestingDetailPage` (ที่ถูก lock จนดูเหมือนพัง + โหลดหนัก) มาเป็นหน้าเฉพาะ `/qc-approval/:id` ที่เบาและเป็นตารางสรุป read-only + ปุ่มตัดสิน

**Architecture:** แยกตรรกะ "แปลง petition+results+parameters → แถวสรุปผล" เป็น pure function ใน `src/lib/qcApprovalRows.ts` (unit-test ได้) แล้วให้หน้าเพจ `QCApprovalReviewPage` เป็นแค่ตัวประกอบ UI + ปุ่มตัดสิน (ยกตรรกะ approve/reject เดิมมาตรง ๆ). หน้า list `QCApproval` ชี้ไป route ใหม่ และ `QCTestingDetailPage` redirect คำร้อง status=success ไปหน้าใหม่ แล้วลบบล็อกอนุมัติเดิมทิ้ง.

**Tech Stack:** React 18 + TypeScript + Vite, TanStack Query (`usePetition`), Vitest, shadcn/ui, `src/lib/api.ts`.

---

## File Structure

- **Create** `src/lib/qcApprovalRows.ts` — pure builder: `buildApprovalGroups(petition, parameters, results, groupMembership)` → โครงสร้างแถวสรุปผลพร้อมธงผิดปกติ/เกณฑ์
- **Create** `src/lib/qcApprovalRows.test.ts` — unit tests สำหรับ builder
- **Create** `src/pages/QCApprovalReviewPage.tsx` — หน้าอนุมัติใหม่ (โหลดเบา + ตารางสรุป + แผงปุ่มตัดสิน)
- **Modify** `src/App.tsx` — เพิ่ม lazy import + route `/qc-approval/:id`
- **Modify** `src/pages/QCApproval.tsx` — navigate ไป `/qc-approval/:id` แทน `/qc-testing/:id`
- **Modify** `src/pages/QCTestingDetailPage.tsx` — redirect status=success → `/qc-approval/:id`; ลบบล็อกแผงอนุมัติ + handler/state/dialog ที่ย้ายออก

ค่าใน results เก็บแบบ key = `${itemSeq}__${parameterId}` (เหมือน `resultKey` ใน `QCTestingDetailPage`); field unit key มาจาก `expandFieldForItem(field, commonName)[].key`; note key = `${unitKey}__note`.

---

## Task 1: Pure builder `buildApprovalGroups` + tests

**Files:**
- Create: `src/lib/qcApprovalRows.ts`
- Test: `src/lib/qcApprovalRows.test.ts`

หมายเหตุ helper ที่ reuse (มีอยู่แล้ว ผ่านเทสต์): `matchParametersForItem` (`@/lib/petitionTestItems`), `expandFieldForItem` + `isFieldAbnormal` + `resolveFieldStandard` + `resolveStandard` + type `ConditionContext` (`@/lib/parameterValidation`), `describeResolvedStandard` (`@/lib/standardOperators`).

- [ ] **Step 1: เขียน builder**

สร้าง `src/lib/qcApprovalRows.ts`:

```ts
import type { ParameterItem, ParameterValueField } from "@/lib/api";
import type { Petition, QCTestResult } from "@/types/petition.types";
import { matchParametersForItem } from "@/lib/petitionTestItems";
import {
  expandFieldForItem,
  isFieldAbnormal,
  resolveFieldStandard,
  resolveStandard,
  type ConditionContext,
} from "@/lib/parameterValidation";
import { describeResolvedStandard } from "@/lib/standardOperators";

export interface ApprovalFieldRow {
  key: string;
  label: string;
  unit?: string;
  value: string;
  standardText: string;
  abnormal: boolean;
  note: string;
  phase: 1 | 2;
}

export interface ApprovalParamGroup {
  parameterId: string;
  parameterName: string;
  hasPhases: boolean;
  rows: ApprovalFieldRow[];
}

export interface ApprovalItemGroup {
  seq: number;
  sampleName: string;
  batchNo?: string;
  sampleId?: string;
  commonName?: string;
  params: ApprovalParamGroup[];
  unmatched: boolean;
}

const resultKey = (itemSeq: number, parameterId: string) => `${itemSeq}__${parameterId}`;
const noteLabelFor = (unitKey: string) => `${unitKey}__note`;

function describeStandard(field: ParameterValueField): string {
  const op = field.standardOperator;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  const unit = field.unit ? ` ${field.unit}` : "";
  switch (op) {
    case "lt": return `< ${v1}${unit}`;
    case "lte": return `≤ ${v1}${unit}`;
    case "eq": return `= ${v1}${unit}`;
    case "gte": return `≥ ${v1}${unit}`;
    case "gt": return `> ${v1}${unit}`;
    case "between": return `${v1} - ${v2}${unit}`;
    case "tolerance": return `${v1} ± ${v2}%${unit}`;
    default: return "";
  }
}

const asStr = (v: unknown) => (v == null ? "" : String(v));

/**
 * แปลง petition + parameters (scope qc) + ผลที่บันทึก → โครงสร้างแถวสรุปแบบ read-only
 * สำหรับหน้าอนุมัติ. คงตรรกะ match/expand/abnormal/conditional ให้ตรงกับหน้ากรอกผล.
 */
export function buildApprovalGroups(
  petition: Petition,
  parameters: ParameterItem[],
  results: QCTestResult[],
  groupMembership: Map<string, string[]>,
): ApprovalItemGroup[] {
  // values[ resultKey ] = { unitKey -> value }  (phase 1 / phase 2 แยกกัน)
  const v1: Record<string, Record<string, unknown>> = {};
  const v2: Record<string, Record<string, unknown>> = {};
  results.forEach((r) => {
    const k = resultKey(r.itemSeq, r.parameterId);
    v1[k] = { ...((r.values ?? {}) as Record<string, unknown>) };
    v2[k] = { ...((r.valuesPhase2 ?? {}) as Record<string, unknown>) };
  });

  const idsFor = (sampleId?: string) =>
    groupMembership.get(String(sampleId ?? "").trim()) ?? [];

  return (petition.items ?? []).map((item) => {
    const matched = matchParametersForItem(item, parameters, idsFor(item.sampleId));

    const params: ApprovalParamGroup[] = matched.map((param) => {
      const k = resultKey(item.seq, param._id!);
      const buildCtx = (phaseVals: Record<string, Record<string, unknown>>): ConditionContext => ({
        sameParam: phaseVals[k] ?? {},
        otherParams: (() => {
          const out: Record<string, Record<string, unknown>> = {};
          matched.forEach((p) => {
            if (!p._id || p._id === param._id) return;
            out[String(p._id)] = phaseVals[resultKey(item.seq, p._id)] ?? {};
          });
          return out;
        })(),
      });

      const rows: ApprovalFieldRow[] = [];
      const pushFields = (phase: 1 | 2) => {
        const phaseVals = phase === 2 ? v2 : v1;
        const ctx = buildCtx(phaseVals);
        (param.valueFields ?? []).forEach((field) => {
          const fPhase = field.phase ?? "both";
          // phase 1 = ทุก field ยกเว้น 'after'; phase 2 = ทุก field ยกเว้น 'before'
          if (phase === 1 && fPhase === "after") return;
          if (phase === 2 && fPhase === "before") return;
          if (field.type === "reference") return;
          expandFieldForItem(field, item.commonName).forEach((unit) => {
            const raw = phaseVals[k]?.[unit.key];
            const effectiveField = unit.field.conditionalMode
              ? resolveFieldStandard(unit.field, ctx)
              : unit.field;
            const resolved = unit.field.conditionalMode
              ? resolveStandard(unit.field, ctx)
              : null;
            const standardText = resolved
              ? describeResolvedStandard(resolved, unit.field.unit ?? "")
              : describeStandard(effectiveField);
            rows.push({
              key: `${k}__${unit.key}__p${phase}`,
              label: unit.field.label,
              unit: unit.field.unit,
              value: asStr(raw),
              standardText,
              abnormal: isFieldAbnormal(effectiveField, raw),
              note: asStr(phaseVals[k]?.[noteLabelFor(unit.key)]),
              phase,
            });
          });
        });
      };

      pushFields(1);
      if (param.hasPhases) pushFields(2);

      return {
        parameterId: String(param._id),
        parameterName: param.name,
        hasPhases: !!param.hasPhases,
        rows,
      };
    });

    return {
      seq: item.seq,
      sampleName: item.sampleName || "-",
      batchNo: item.batchNo,
      sampleId: item.sampleId,
      commonName: item.commonName,
      params,
      unmatched: matched.length === 0,
    };
  });
}
```

- [ ] **Step 2: เขียน failing test**

สร้าง `src/lib/qcApprovalRows.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildApprovalGroups } from "./qcApprovalRows";
import type { ParameterItem } from "@/lib/api";
import type { Petition, QCTestResult } from "@/types/petition.types";

const param = (over: Partial<ParameterItem> = {}): ParameterItem => ({
  _id: "p1",
  name: "ความหนาแน่น",
  scope: "qc",
  testItems: ["density"],
  valueFields: [
    { label: "ค่า", type: "number", standardOperator: "between", standardValue: 10, standardValue2: 20, unit: "g" },
  ],
  ...(over as ParameterItem),
});

const petition = (): Petition => ({
  _id: "pet1",
  petitionNo: "Q-001",
  status: "success",
  dept: "rm",
  items: [
    { seq: 1, sampleName: "ตัวอย่าง A", commonName: "density", sampleId: "S1", batchNo: "B1", testItems: "density" },
  ],
} as unknown as Petition);

const result = (value: unknown): QCTestResult => ({
  itemSeq: 1,
  parameterId: "p1",
  parameterName: "ความหนาแน่น",
  values: { ค่า: value },
} as unknown as QCTestResult);

describe("buildApprovalGroups", () => {
  it("จับคู่พารามิเตอร์ + เติมค่าที่บันทึก + เกณฑ์มาตรฐาน", () => {
    const groups = buildApprovalGroups(petition(), [param()], [result(15)], new Map());
    expect(groups).toHaveLength(1);
    const row = groups[0].params[0].rows[0];
    expect(row.value).toBe("15");
    expect(row.standardText).toBe("10 - 20 g");
    expect(row.abnormal).toBe(false);
  });

  it("ตั้งธง abnormal เมื่อค่าหลุดเกณฑ์", () => {
    const groups = buildApprovalGroups(petition(), [param()], [result(99)], new Map());
    expect(groups[0].params[0].rows[0].abnormal).toBe(true);
  });

  it("ค่าว่างเมื่อไม่มีผลบันทึก", () => {
    const groups = buildApprovalGroups(petition(), [param()], [], new Map());
    expect(groups[0].params[0].rows[0].value).toBe("");
  });

  it("ตั้ง unmatched เมื่อไม่มีพารามิเตอร์ตรง", () => {
    const groups = buildApprovalGroups(petition(), [], [result(15)], new Map());
    expect(groups[0].unmatched).toBe(true);
    expect(groups[0].params).toHaveLength(0);
  });
});
```

- [ ] **Step 3: รันเทสต์ ให้ผ่าน**

Run: `npm run test -- src/lib/qcApprovalRows.test.ts`
Expected: PASS ทั้ง 4 เคส. ถ้า field shape (เช่น `standardOperator` ชื่อ key) ไม่ตรงกับ `ParameterValueField` จริง ให้ปรับ test fixture ให้ตรง type — ห้ามแก้ builder logic เพื่อให้ test ผ่านแบบผิดความหมาย.

- [ ] **Step 4: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ใน `qcApprovalRows.ts` / `.test.ts` (repo มี ~4 latent error เดิม: HomeQC, PetitionPrintTemplate, LabAgreementReviewView, api.ts — ปล่อยไว้).

- [ ] **Step 5: commit**

```bash
git add -- src/lib/qcApprovalRows.ts src/lib/qcApprovalRows.test.ts
git commit -m "feat(qc-approval): pure builder for read-only approval result rows"
```

---

## Task 2: หน้า `QCApprovalReviewPage` — โหลดข้อมูล + หัว + ตารางสรุป (ยังไม่มีปุ่มตัดสิน)

**Files:**
- Create: `src/pages/QCApprovalReviewPage.tsx`

- [ ] **Step 1: สร้างหน้า (data + render, ปุ่มตัดสินใส่ Task 3)**

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FlaskConical, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePetition } from "@/hooks/usePetition";
import { api, type ParameterItem } from "@/lib/api";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { qcReceivedBy } from "@/lib/receiveStatus";
import { cn } from "@/lib/utils";
import {
  PETITION_DEPT_LABELS,
  type QCTestResult,
} from "@/types/petition.types";
import { buildApprovalGroups } from "@/lib/qcApprovalRows";

export default function QCApprovalReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: petition, loading, error } = usePetition(id);
  const groupMembership = useItemGroupMembership();
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [results, setResults] = useState<QCTestResult[]>([]);
  const [petitionHasAbnormal, setPetitionHasAbnormal] = useState(false);

  useEffect(() => {
    api.getParameters()
      .then((all) => setParameters(all.filter((p) => (p.scope ?? "qc") === "qc")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    api.getQCResults(id).then(setResults).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) { setPetitionHasAbnormal(false); return; }
    api.getAbnormalFlags([id])
      .then((m) => setPetitionHasAbnormal(!!m[id]))
      .catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      </AppLayout>
    );
  }
  if (error || !petition) {
    return (
      <AppLayout>
        <div className="text-center text-grey-500">{error || "ไม่พบข้อมูลคำร้อง"}</div>
      </AppLayout>
    );
  }

  const groups = buildApprovalGroups(petition, parameters, results, groupMembership);

  return (
    <AppLayout title={petition.petitionNo}>
      <div className="space-y-6 pb-28">
        <PageHeader
          onBack={() => navigate("/qc-approval")}
          title={
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary-500" />
              อนุมัติผล {petition.petitionNo}
            </span>
          }
          actions={
            <span className="text-sm text-grey-500">
              ผู้นำส่ง: {petition.submittedBy?.name ?? "-"}
            </span>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="blue-soft">{PETITION_DEPT_LABELS[petition.dept]}</Badge>
          <Badge variant="gray-soft" className="font-normal">
            ผู้รับงาน QC: {qcReceivedBy(petition) ?? "-"}
          </Badge>
          {petitionHasAbnormal ? (
            <span className="inline-flex items-center gap-1 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" /> มีค่าผิดปกติ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" /> ผลปกติทุกรายการ
            </span>
          )}
        </div>

        {(petition.labRedoExplanation || petition.qcRedoExplanation) && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
            <p className="font-semibold text-violet-700 mb-1">คำอธิบายการทำใหม่</p>
            {petition.labRedoExplanation && <p className="text-violet-800">Lab: {petition.labRedoExplanation}</p>}
            {petition.qcRedoExplanation && <p className="text-violet-800">QC: {petition.qcRedoExplanation}</p>}
          </div>
        )}

        {groups.map((g) => (
          <Card key={g.seq} className="overflow-hidden">
            <CardHeader className="pb-3 bg-grey-50">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <span>รายการที่ {g.seq}: {g.sampleName}</span>
                {g.batchNo && <Badge variant="gray-soft" className="font-normal">Batch: {g.batchNo}</Badge>}
                {g.sampleId && <Badge variant="primary-soft" className="font-normal text-xs">{g.sampleId}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              {g.unmatched ? (
                <p className="text-sm text-grey-400 italic">ไม่พบพารามิเตอร์ที่ตรงกับรายการทดสอบ</p>
              ) : (
                g.params.map((param) => (
                  <div key={param.parameterId} className="space-y-2">
                    <h3 className="text-sm font-semibold text-grey-800 border-b pb-1">{param.parameterName}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-grey-500">
                          <tr>
                            <th className="py-1 pr-3 font-medium">ช่อง</th>
                            <th className="py-1 pr-3 font-medium">ค่าที่บันทึก</th>
                            <th className="py-1 pr-3 font-medium">เกณฑ์มาตรฐาน</th>
                            <th className="py-1 pr-3 font-medium">สถานะ</th>
                            <th className="py-1 font-medium">หมายเหตุ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {param.rows.map((row) => (
                            <tr key={row.key} className={cn("border-t", row.abnormal && "bg-red-50")}>
                              <td className="py-1.5 pr-3">
                                {row.label}{row.unit ? <span className="text-grey-400"> ({row.unit})</span> : null}
                                {param.hasPhases && <span className="ml-1 text-[10px] text-amber-600">P{row.phase}</span>}
                              </td>
                              <td className="py-1.5 pr-3 font-mono font-semibold">{row.value || "-"}</td>
                              <td className="py-1.5 pr-3 text-grey-500">{row.standardText || "-"}</td>
                              <td className="py-1.5 pr-3">
                                {row.abnormal ? (
                                  <span className="inline-flex items-center gap-1 text-red-600">
                                    <AlertTriangle className="h-3.5 w-3.5" /> ผิดปกติ
                                  </span>
                                ) : (
                                  <span className="text-green-600">ปกติ</span>
                                )}
                              </td>
                              <td className="py-1.5 text-grey-600">{row.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่. ถ้า `usePetition` คืน field ชื่อต่างจาก `{ data, loading, error }` ให้ยึดตามที่ `QCTestingDetailPage.tsx:305` ใช้ (`data`, `loading`, `error`).

- [ ] **Step 3: commit**

```bash
git add -- src/pages/QCApprovalReviewPage.tsx
git commit -m "feat(qc-approval): read-only result summary page (no decision panel yet)"
```

---

## Task 3: แผงปุ่มตัดสินบนหน้าใหม่ (ยกตรรกะจาก `QCTestingDetailPage`)

**Files:**
- Modify: `src/pages/QCApprovalReviewPage.tsx`

- [ ] **Step 1: เพิ่ม imports + state + handlers**

ใต้ imports เดิม เพิ่ม:

```tsx
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/context/ConfirmDialog";
import { RevisionRequestDialog } from "@/components/petition/RevisionRequestDialog";
```

ใน component (หลัง `const navigate = ...`) เพิ่ม:

```tsx
  const { user } = useAuth();
  const confirm = useConfirm();
  const [submitting, setSubmitting] = useState(false);
  const [retestTarget, setRetestTarget] = useState<"lab" | "qc" | "both">("lab");
  const [retestDialogOpen, setRetestDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [acceptReasonDialogOpen, setAcceptReasonDialogOpen] = useState(false);

  const doApprove = useCallback(async (conclusion: "pass" | "accepted-oos", note?: string) => {
    if (!petition) return;
    setSubmitting(true);
    try {
      await api.approvePetition(petition._id, user?.name ?? "system", conclusion, note);
      toast.success(conclusion === "accepted-oos" ? "ยอมรับผลเรียบร้อย" : "อนุมัติเรียบร้อย");
      navigate("/qc-approval");
    } catch {
      toast.error("ดำเนินการไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, navigate]);

  const handleApprovePass = useCallback(async () => {
    if (!(await confirm({ title: "ผลถูกต้อง", description: "ยืนยันว่าผลถูกต้องและอนุมัติคำร้องนี้?" }))) return;
    await doApprove("pass");
  }, [confirm, doApprove]);

  const handleAcceptOos = useCallback(async (note: string) => {
    setAcceptReasonDialogOpen(false);
    await doApprove("accepted-oos", note);
  }, [doApprove]);

  const handleRetest = useCallback(async (note: string) => {
    if (!petition) return;
    setSubmitting(true);
    try {
      await api.rejectPetition(petition._id, user?.name ?? "system", note, retestTarget);
      const label = retestTarget === "lab" ? "Lab" : retestTarget === "qc" ? "QC" : "Lab และ QC";
      toast.success(`ส่งกลับให้ ${label} ทดสอบใหม่เรียบร้อย`);
      setRetestDialogOpen(false);
      navigate("/qc-approval");
    } catch {
      toast.error("ส่งกลับไม่สำเร็จ");
      throw new Error("retest failed");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, retestTarget, navigate]);

  const handleReturnToRequester = useCallback(async (note: string) => {
    if (!petition) return;
    setSubmitting(true);
    try {
      await api.rejectPetition(petition._id, user?.name ?? "system", note, "requester");
      toast.success("ส่งคืนผู้ส่งให้แก้ product เรียบร้อย", { description: `ส่งให้ ${petition.submittedBy?.name ?? "ผู้ยื่น"}` });
      setReturnDialogOpen(false);
      navigate("/qc-approval");
    } catch {
      toast.error("ส่งคืนไม่สำเร็จ");
      throw new Error("return failed");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, navigate]);
```

หมายเหตุ: `useState` ถูก import อยู่แล้วใน Task 2; เพิ่ม `useCallback` ใน import จาก "react" (รวมเป็น `import { useEffect, useState, useCallback } from "react";`).

- [ ] **Step 2: เพิ่มแผงปุ่ม + dialogs ก่อนปิด `</div>` ของ container (หลัง `groups.map(...)` block)**

```tsx
        {/* แผงตัดสิน — fixed bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:left-72 px-4 sm:px-6 py-3 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">ถ้าให้ทดสอบใหม่ ส่งกลับไปยัง:</span>
              {([["lab", "Lab"], ["qc", "QC"], ["both", "ทั้งคู่"]] as const).map(([val, label]) => (
                <label key={val} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="retestTarget" checked={retestTarget === val} onChange={() => setRetestTarget(val)} />
                  {label}
                </label>
              ))}
            </div>
            {!petitionHasAbnormal ? (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button variant="primary" size="sm" onClick={handleApprovePass} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  ผลถูกต้อง
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRetestDialogOpen(true)} disabled={submitting} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> ผลไม่ถูกต้อง
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button variant="primary" size="sm" onClick={() => setAcceptReasonDialogOpen(true)} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  ยอมรับผล
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReturnDialogOpen(true)} disabled={submitting} className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
                  <RotateCcw className="h-4 w-4" /> ส่งคืนผู้ส่งแก้ product
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRetestDialogOpen(true)} disabled={submitting} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> ทดสอบใหม่
                </Button>
              </div>
            )}
          </div>
        </div>

        <RevisionRequestDialog
          open={retestDialogOpen}
          onOpenChange={setRetestDialogOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? "ผู้ยื่น"}
          recipientLabel={retestTarget === "lab" ? "ผู้ทดสอบ Lab" : retestTarget === "qc" ? "ผู้ทดสอบ QC" : "ผู้ทดสอบ Lab และ QC"}
          warning={`คำร้องจะถูกส่งกลับให้${retestTarget === "both" ? "ทั้ง Lab และ QC" : retestTarget === "lab" ? "Lab" : "QC"}ทดสอบใหม่ (ไม่ปิดคำร้อง ไม่เกี่ยวกับผู้ส่ง)`}
          onConfirm={handleRetest}
        />
        <RevisionRequestDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? "ผู้ยื่น"}
          recipientLabel={petition.submittedBy?.name ?? "ผู้ยื่น"}
          warning="คำร้องจะถูกปิดและส่งคืนผู้ส่งให้แก้ไข product ตามคำแนะนำ"
          onConfirm={handleReturnToRequester}
        />
        <RevisionRequestDialog
          open={acceptReasonDialogOpen}
          onOpenChange={setAcceptReasonDialogOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? "ผู้ยื่น"}
          recipientLabel="ยอมรับผลไม่ปกติ"
          warning="คำร้องจะถูกอนุมัติโดยบันทึกผลไม่ปกติเป็นผลจริง — โปรดระบุเหตุผล"
          onConfirm={handleAcceptOos}
        />
```

- [ ] **Step 3: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่.

- [ ] **Step 4: commit**

```bash
git add -- src/pages/QCApprovalReviewPage.tsx
git commit -m "feat(qc-approval): decision panel (pass/oos/return/retest) on review page"
```

---

## Task 4: ต่อ route + เปลี่ยนปลายทาง list + redirect หน้าเก่า + ลบบล็อกอนุมัติเดิม

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/QCApproval.tsx`
- Modify: `src/pages/QCTestingDetailPage.tsx`

- [ ] **Step 1: `App.tsx` — เพิ่ม lazy import + route**

เพิ่มบรรทัด lazy (ใกล้ ๆ `const QCApproval = lazy(...)`):

```tsx
const QCApprovalReviewPage = lazy(() => import("./pages/QCApprovalReviewPage"));
```

เพิ่ม route ใต้บรรทัด `<Route path="/qc-approval" ... />` (App.tsx:89):

```tsx
              <Route path="/qc-approval/:id" element={<PrivateRoute><QCApprovalReviewPage /></PrivateRoute>} />
```

- [ ] **Step 2: `QCApproval.tsx` — ชี้ navigate ไป route ใหม่**

เปลี่ยน 2 จุด:
- บรรทัด ~178 ในปุ่ม "ตรวจสอบ": `navigate(\`/qc-testing/${p._id}\`)` → `navigate(\`/qc-approval/${p._id}\`)`
- บรรทัด ~247 ใน `onRowClick`: `navigate(\`/qc-testing/${p._id}\`)` → `navigate(\`/qc-approval/${p._id}\`)`

- [ ] **Step 3: `QCTestingDetailPage.tsx` — redirect status=success ไปหน้าใหม่**

หลัง block `if (petitionError || !petition) { ... }` (จบราว ๆ บรรทัด 667) และก่อน `const items = petition.items ?? [];` เพิ่ม:

```tsx
  // คำร้องที่บันทึกผลแล้ว (รออนุมัติ) ย้ายไปหน้าอนุมัติเฉพาะ — กันคนหลงเข้าฟอร์มที่ถูก lock
  if (petition.status === "success") {
    return <Navigate to={`/qc-approval/${petition._id}`} replace />;
  }
```

เพิ่ม `Navigate` ใน import จาก react-router-dom (บรรทัด 3): `import { useParams, useNavigate, Navigate } from 'react-router-dom';`

- [ ] **Step 4: `QCTestingDetailPage.tsx` — ลบบล็อกแผงอนุมัติเดิม (status=success) + state/handler/dialog ที่ย้ายออก**

ลบสิ่งเหล่านี้ (ตอนนี้ตายเพราะ redirect แล้ว):
- JSX block `{petition.status === 'success' && ( ... )}` (เดิมบรรทัด ~1205–1271)
- handler ที่ย้ายไปหน้าใหม่: `doApprove`, `handleApprovePass`, `handleAcceptOos`, `handleRetest`, `handleReturnToRequester` (บรรทัด ~808–862)
- state ที่ใช้เฉพาะแผงอนุมัติ: `retestTarget`, `retestDialogOpen`, `returnDialogOpen`, `acceptReasonDialogOpen` (บรรทัด ~324–327)
- 3 `<RevisionRequestDialog ... />` ท้ายไฟล์ (บรรทัด ~1290–1321)
- `petitionHasAbnormal` + effect ที่เซ็ตมัน (บรรทัด ~347–353) — ใช้เฉพาะข้อความในแผงอนุมัติ
- import ที่ไม่ใช้แล้ว: `RevisionRequestDialog`, `useConfirm`/`confirm` (ถ้าไม่ถูกใช้ที่อื่นในไฟล์ — ตรวจก่อนลบ), `qcReceivedBy`

**สำคัญ — อย่าลบของที่ยังใช้:** `isLocked` (ยังใช้กับ field disabled ตอน `qcCompletedAt` รอ Lab), block `petition.status === 'approved' || 'rejected'` (ยังโชว์สถานะปิดงาน), `handleSubmitResult`/`handleSaveDraft` + ปุ่มล่าง (`status !== 'success'`), `AlertTriangle`/`abnormalCount` (ยังใช้ที่ header). ตรวจ `AlertTriangle`, `RotateCcw`, `CheckCircle2` ว่ายังถูกใช้ที่อื่นก่อนถอน import.

- [ ] **Step 5: type-check (จับ import/ตัวแปรที่ค้าง)**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่. ถ้ามี error "declared but never read" จากตัวที่ลบไม่หมด ให้ตามไปถอนให้ครบ.

- [ ] **Step 6: lint (จับ unused เพิ่ม)**

Run: `npm run lint`
Expected: ไม่มี error ใหม่ในไฟล์ที่แก้ (เตือน warning เดิมของ repo ปล่อยได้).

- [ ] **Step 7: commit**

```bash
git add -- src/App.tsx src/pages/QCApproval.tsx src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-approval): route review page, redirect success petitions off testing detail"
```

---

## Task 5: Build แยก dir (พิสูจน์ chunk + ไม่พัง) + checklist E2E

**Files:** ไม่มีไฟล์โค้ดใหม่ — verification เท่านั้น

- [ ] **Step 1: build ไป dir ทิ้ง (ปลอดภัย ไม่ trigger postbuild deploy)**

Run: `npx vite build --outDir dist-verify --emptyOutDir`
Expected: build สำเร็จ; เห็น chunk `QCApprovalReviewPage-*.js` แยกออกมา (ยืนยัน lazy-split ทำงาน).
จากนั้นลบ: `rm -rf dist-verify`

- [ ] **Step 2: รัน unit test ทั้งชุดที่เกี่ยว**

Run: `npm run test -- src/lib/qcApprovalRows.test.ts`
Expected: PASS.

- [ ] **Step 3: Manual E2E (ต้องมี backend `cd server && npm run dev` + `npm run dev`)**

ตรวจด้วยมือ (ใช้ DevRoleSwitcher เลือก role หัวหน้า QC):
1. ไป `/qc-approval` → คลิกแถว/ปุ่ม "ตรวจสอบ" → URL ต้องเป็น `/qc-approval/:id` (ไม่ใช่ `/qc-testing/:id`) และโหลดไว
2. หน้าโชว์ค่าผล + เกณฑ์ + ธงผิดปกติครบ; คำร้องผลปกติเห็น 2 ปุ่ม, ผลผิดปกติเห็น 3 ปุ่ม
3. ทดสอบทุกเส้นทาง: ผลถูกต้อง(pass) / ผลไม่ถูกต้อง(retest lab,qc,both) / ยอมรับผล(oos+เหตุผล) / ส่งคืนผู้ส่ง — แต่ละอันต้อง toast + เด้งกลับ `/qc-approval` + สถานะคำร้องเปลี่ยนถูก
4. พิมพ์ URL `/qc-testing/:id` ของคำร้อง status=success ตรง ๆ → ต้องเด้งไป `/qc-approval/:id`
5. หน้ากรอกผล QC ปกติ (`/qc-testing/:id` ของ pendingReview/inProgress) ยังกรอก/บันทึกได้ ไม่ regression
6. **สิทธิ์:** ถ้า role หัวหน้า QC เข้า `/qc-approval/:id` แล้วเจอ 403 → เพิ่ม path permission `/qc-approval/*` (หรือ `/qc-approval/:id`) ให้ role นั้นใน Access Control (เทียบเคส `/lab-approval` ที่เคยต้องเพิ่ม)

- [ ] **Step 4: (หลัง E2E ผ่าน) update memory/handoff**

บันทึกความคืบหน้าใน `.remember/remember.md` ว่าแยกหน้าอนุมัติ QC เสร็จ + ค้างเรื่องสิทธิ์ path ถ้ายังไม่ได้เพิ่ม.

---

## Self-Review (ผู้เขียนแผนตรวจเอง)

- **Spec coverage:** ครบทุกข้อ — route+nav (T4), โหลดเบา (T2), ตารางสรุป (T1+T2), แผงตัดสิน (T3), redirect+ลบของเก่า (T4), สิทธิ์ (T5 step 3.6), เกณฑ์ผ่านทั้งหมดอยู่ใน T5.
- **Placeholder scan:** ไม่มี TBD/TODO; โค้ดครบทุก step.
- **Type consistency:** `buildApprovalGroups(petition, parameters, results, groupMembership)` signature ตรงกันทุกที่ที่เรียก (T2). `approvePetition(id, actor, conclusion, note)` / `rejectPetition(id, actor, note, target)` ตรงกับ `api.ts:458,468`. `RevisionRequestDialog` props ตรงกับ component (`onConfirm: (note) => ...`, `recipientLabel`, `warning`). field key (`standardOperator/standardValue/standardValue2`) ตาม `ParameterValueField` ใน `describeStandard` เดิม.
- **เสี่ยง:** Task 4 step 4 (ลบของเก่า) ต้องพึ่ง tsc/lint จับ import/ตัวแปรค้าง — มี step บังคับรันแล้ว. ถ้า `usePetition` คืน shape ต่าง ให้ยึดตามการใช้จริงใน `QCTestingDetailPage.tsx:305`.
