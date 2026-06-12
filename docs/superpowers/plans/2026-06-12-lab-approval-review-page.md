# Lab Approval Review Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำหน้าอนุมัติผล Lab ให้เหมือนด่าน QC — มีหน้า review เฉพาะ `/lab-approval/:id` แบบ read-only พร้อมแผงตัดสินล่างจอ และหน้า list มี flag/priority/AI draft

**Architecture:** Clone โครงจาก `QCApprovalReviewPage` (แนวทาง A) แต่ใช้ param lab-scope + ปุ่มตัดสิน 2 ปุ่มคงที่ (อนุมัติ/ส่งกลับให้แก้). ผล Lab อยู่ใน QCTestResult store เดียวกัน อ่านด้วย `getQCResults` และ reuse `buildApprovalGroups` ได้. Backend มีครบแล้ว ไม่แตะ.

**Tech Stack:** React 18 + TypeScript + React Router v6 + TanStack Query + shadcn/ui + Tailwind. type-check ด้วย `npx tsc -p tsconfig.app.json`.

**อ้างอิง spec:** `docs/superpowers/specs/2026-06-12-lab-approval-review-page-design.md`

**หมายเหตุการทดสอบ:** หน้า (pages) ในรีโปนี้ไม่มี unit test — verify ด้วย `tsc -p tsconfig.app.json` (ห้ามใช้ `tsc --noEmit` เฉยๆ เพราะ root tsconfig `files:[]` = no-op) + manual E2E. Commit เฉพาะไฟล์ตัวเองด้วย explicit pathspec (มี committer อื่นใน develop).

---

### Task 1: สร้างหน้า `LabApprovalReviewPage.tsx`

**Files:**
- Create: `src/pages/LabApprovalReviewPage.tsx`

- [ ] **Step 1: เขียนไฟล์หน้า review**

สร้าง `src/pages/LabApprovalReviewPage.tsx` ด้วยเนื้อหานี้ทั้งหมด:

```tsx
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FlaskConical, Loader2, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePetition } from "@/hooks/usePetition";
import { api, type ParameterItem } from "@/lib/api";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { labReceivedBy } from "@/lib/receiveStatus";
import { cn } from "@/lib/utils";
import { PETITION_DEPT_LABELS, type QCTestResult } from "@/types/petition.types";
import { buildApprovalGroups } from "@/lib/qcApprovalRows";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/context/ConfirmDialog";
import { useCanAccessPath } from "@/hooks/useCanAccessPath";
import { RevisionRequestDialog } from "@/components/petition/RevisionRequestDialog";

export default function LabApprovalReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuth();
  const confirm = useConfirm();
  const canAccessPath = useCanAccessPath();
  const canApproveLab = canAccessPath("/lab-approval");
  const [submitting, setSubmitting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const { data: petition, loading, error } = usePetition(id);
  const groupMembership = useItemGroupMembership();
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [results, setResults] = useState<QCTestResult[]>([]);
  const [petitionHasAbnormal, setPetitionHasAbnormal] = useState(false);

  useEffect(() => {
    api.getParameters()
      .then((all) =>
        setParameters(
          all.filter((p) => p.scope === "lab" || (p.scope === "qc" && p.shareWithLab === true)),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    api.getQCResults(id).then(setResults).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) { setPetitionHasAbnormal(false); return; }
    let alive = true;
    api.getAbnormalFlags([id])
      .then((m) => { if (alive) setPetitionHasAbnormal(!!m[id]); })
      .catch(() => { if (alive) setPetitionHasAbnormal(false); });
    return () => { alive = false; };
  }, [id]);

  const handleApprove = useCallback(async () => {
    if (!petition) return;
    if (!(await confirm({ title: "อนุมัติผล Lab", description: "อนุมัติผลการทดสอบ Lab นี้?" }))) return;
    setSubmitting(true);
    try {
      await api.labApprovePetition(petition._id, user?.name ?? "system");
      toast.success("อนุมัติผล Lab เรียบร้อย");
      navigate("/lab-approval");
    } catch {
      toast.error("อนุมัติไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, confirm, navigate]);

  const handleReject = useCallback(async (note: string) => {
    if (!petition) return;
    setSubmitting(true);
    try {
      await api.labRejectPetition(petition._id, user?.name ?? "system", note);
      toast.success("ส่งกลับให้ผู้ทดสอบ Lab แก้ไขเรียบร้อย");
      setRejectDialogOpen(false);
      navigate("/lab-approval");
    } catch {
      toast.error("ส่งกลับไม่สำเร็จ");
      throw new Error("reject failed");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, navigate]);

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
          onBack={() => navigate("/lab-approval")}
          title={
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-sky-500" />
              อนุมัติผล Lab {petition.petitionNo}
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
            ผู้รับงาน Lab: {labReceivedBy(petition) ?? "-"}
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

        {petition.labRedoExplanation && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
            <p className="font-semibold text-violet-700 mb-1">คำอธิบายการทำใหม่</p>
            <p className="text-violet-800">Lab: {petition.labRedoExplanation}</p>
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

        {/* แผงตัดสิน — fixed bottom (เฉพาะผู้มีสิทธิ์อนุมัติ Lab) */}
        {canApproveLab && (
          <div className="fixed bottom-0 left-0 right-0 z-50 md:left-72 px-4 sm:px-6 py-3 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="primary" size="sm" onClick={handleApprove} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                อนุมัติผล Lab
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(true)} disabled={submitting} className="gap-2">
                <RotateCcw className="h-4 w-4" /> ส่งกลับให้แก้
              </Button>
            </div>
          </div>
        )}

        <RevisionRequestDialog
          open={rejectDialogOpen}
          onOpenChange={setRejectDialogOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? "ผู้ทดสอบ Lab"}
          recipientLabel="ผู้ทดสอบ Lab"
          warning="คำร้องจะถูกส่งกลับให้ผู้ทดสอบ Lab แก้ไข/ทดสอบใหม่ (ไม่ปิดคำร้อง)"
          onConfirm={handleReject}
        />
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่จาก `LabApprovalReviewPage.tsx` (อาจมี ~12 latent error เดิมของรีโป — ตรวจว่าไม่มีบรรทัดที่ชี้ไฟล์นี้)

- [ ] **Step 3: Commit**

```bash
git add src/pages/LabApprovalReviewPage.tsx
git commit -m "feat: lab-approval review page (mirror QC)"
```

---

### Task 2: ผูก route `/lab-approval/:id` ใน App.tsx

**Files:**
- Modify: `src/App.tsx` (lazy import ~บรรทัด 36, route ~บรรทัด 109)

- [ ] **Step 1: เพิ่ม lazy import**

ใน `src/App.tsx` หลังบรรทัด `const LabApproval = lazy(() => import("./pages/LabApproval"));` เพิ่ม:

```tsx
const LabApprovalReviewPage = lazy(() => import("./pages/LabApprovalReviewPage"));
```

- [ ] **Step 2: เพิ่ม route**

หลังบรรทัด `<Route path="/lab-approval" element={<PrivateRoute><LabApproval /></PrivateRoute>} />` เพิ่ม:

```tsx
<Route path="/lab-approval/:id" element={<PrivateRoute><LabApprovalReviewPage /></PrivateRoute>} />
```

- [ ] **Step 3: type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: route /lab-approval/:id"
```

---

### Task 3: อัปเกรดหน้า list `LabApproval.tsx` (flag + priority + AI + navigate ใหม่)

**Files:**
- Modify: `src/pages/LabApproval.tsx` (เขียนทับทั้งไฟล์)

- [ ] **Step 1: เขียนทับ `src/pages/LabApproval.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, RotateCcw, Sparkles, Loader2 } from "lucide-react";
import { usePetitionList } from "@/hooks/usePetition";
import { PETITION_DEPT_LABELS, type Petition } from "@/types/petition.types";
import { api } from "@/lib/api";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import { statusBadge } from "@/lib/statusBadge";
import { getAiStatus, streamDraftNote } from "@/lib/aiApi";

const API_BASE = import.meta.env.BASE_URL + "api";

function priorityScore(
  petition: Petition,
  abnormalMap: Record<string, boolean>,
  returnedMap: Record<string, boolean>,
): number {
  const deptScore = petition.dept === "rm" ? 5 : petition.dept === "fg" ? 3 : 1;
  const isOverdue = petition.labCompletedAt
    ? Date.now() - new Date(petition.labCompletedAt).getTime() > 24 * 60 * 60 * 1000
    : false;
  return (
    (abnormalMap[petition._id] ? 30 : 0) +
    (isOverdue ? 20 : 0) +
    (returnedMap[petition._id] ? 10 : 0) +
    deptScore
  );
}

const LabApproval = () => {
  const navigate = useNavigate();
  const { data, loading } = usePetitionList({ awaitingLabApproval: true, limit: 100 });
  const petitions = data?.items ?? [];

  const [testersMap, setTestersMap] = useState<Record<string, string[]>>({});
  const [abnormalMap, setAbnormalMap] = useState<Record<string, boolean>>({});
  const [returnedMap, setReturnedMap] = useState<Record<string, boolean>>({});
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const sortedPetitions = useMemo(
    () =>
      [...petitions].sort(
        (a, b) => priorityScore(b, abnormalMap, returnedMap) - priorityScore(a, abnormalMap, returnedMap),
      ),
    [petitions, abnormalMap, returnedMap],
  );

  useEffect(() => {
    getAiStatus().then((s) => setOllamaAvailable(s.available));
  }, []);

  useEffect(() => {
    if (petitions.length === 0) {
      setTestersMap({});
      setAbnormalMap({});
      setReturnedMap({});
      return;
    }
    const ids = petitions.map((p) => p._id);
    let alive = true;
    fetch(`${API_BASE}/qc-results/testers?petitionIds=${encodeURIComponent(ids.join(","))}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((map: Record<string, string[]>) => { if (alive) setTestersMap(map || {}); })
      .catch(() => { if (alive) setTestersMap({}); });
    api.getAbnormalFlags(ids)
      .then((map) => { if (alive) setAbnormalMap(map || {}); })
      .catch(() => { if (alive) setAbnormalMap({}); });
    api.getReturnedFlags(ids)
      .then((map) => { if (alive) setReturnedMap(map || {}); })
      .catch(() => { if (alive) setReturnedMap({}); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petitions.map((p) => p._id).join(",")]);

  const columns: DataTableColumn<Petition>[] = [
    {
      key: "no",
      header: "เลขที่คำร้อง",
      className: "font-semibold text-primary",
      cell: (p) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span>{p.petitionNo}</span>
            {returnedMap[p._id] && (
              <RotateCcw className="h-4 w-4 text-orange-500 shrink-0" aria-label="ส่งกลับมาบันทึกผลใหม่" />
            )}
            {abnormalMap[p._id] && (
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" aria-label="พบค่าผิดปกติในผลทดสอบ" />
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {abnormalMap[p._id] && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                ผิดปกติ
              </span>
            )}
            {p.labCompletedAt && Date.now() - new Date(p.labCompletedAt).getTime() > 24 * 60 * 60 * 1000 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                ⏰ เกิน 24h
              </span>
            )}
            {returnedMap[p._id] && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                🔄 Revision
              </span>
            )}
          </div>
        </div>
      ),
    },
    { key: "dept", header: "แผนก", cell: (p) => <Badge variant="blue-soft">{PETITION_DEPT_LABELS[p.dept]}</Badge> },
    { key: "submitter", header: "ผู้นำส่ง", cell: (p) => p.submittedBy?.name ?? "-" },
    {
      key: "testers", header: "ผู้ทดสอบ", className: "max-w-[200px] text-sm text-muted-foreground align-top",
      cell: (p) => {
        const t = testersMap[p._id] ?? [];
        return t.length > 0 ? <div className="flex flex-col gap-0.5">{t.map((n) => <span key={n}>{n}</span>)}</div> : "-";
      },
    },
    { key: "count", header: "จำนวนรายการ", cell: (p) => `${p.items?.length ?? 0} รายการ` },
    { key: "status", header: "สถานะ", cell: (p) => { const b = statusBadge(p.status); return <Badge variant={b.variant}>{b.label}</Badge>; } },
    {
      key: "action", header: "การดำเนินการ", className: "text-right",
      cell: (p) => (
        <div className="flex flex-col items-end gap-2">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/lab-approval/${p._id}`); }}>
            ตรวจสอบ
          </Button>

          {ollamaAvailable && (
            <div className="mt-1 space-y-2 w-full" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled={draftingId === p._id}
                onClick={async () => {
                  setDraftingId(p._id);
                  setDraftNotes((prev) => ({ ...prev, [p._id]: "" }));
                  try {
                    await streamDraftNote(p._id, (chunk) => {
                      setDraftNotes((prev) => ({ ...prev, [p._id]: (prev[p._id] ?? "") + chunk }));
                    });
                  } catch {
                    setDraftNotes((prev) => ({ ...prev, [p._id]: "(เกิดข้อผิดพลาด — กรุณาลองใหม่)" }));
                  } finally {
                    setDraftingId(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-50"
              >
                {draftingId === p._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Draft หมายเหตุ (AI)
              </button>

              {draftNotes[p._id] && (
                <textarea
                  value={draftNotes[p._id]}
                  onChange={(e) => setDraftNotes((prev) => ({ ...prev, [p._id]: e.target.value }))}
                  className="w-full rounded-md border border-violet-200 bg-white px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-violet-400"
                  placeholder="AI กำลังสร้าง draft..."
                />
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={<span className="inline-flex items-center gap-2"><ShieldCheck className="w-6 h-6" />อนุมัติผล Lab</span>}
          description={`ตรวจสอบและอนุมัติผลการทดสอบจาก Lab · ${sortedPetitions.length} รายการรออนุมัติ`}
        />
        <DataTable
          columns={columns}
          data={sortedPetitions}
          rowKey={(p) => p._id}
          isLoading={loading}
          onRowClick={(p) => navigate(`/lab-approval/${p._id}`)}
          emptyTitle="ไม่มีคำร้องที่รออนุมัติ Lab"
          tableClassName="min-w-[700px]"
        />
      </div>
    </AppLayout>
  );
};

export default LabApproval;
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่. ถ้า `p.labCompletedAt` แดง (ไม่มีใน type Petition) — ตรวจ `src/types/petition.types.ts` ว่ามี field นี้ (มีใช้ใน LabTestingDetailPage แล้ว จึงควรมี); ถ้าไม่มีจริงให้ใช้ `p.completedAt` แทนใน priorityScore + badge 24h.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LabApproval.tsx
git commit -m "feat: lab-approval list flags + priority + AI draft, route to review page"
```

---

### Task 4: ถอดปุ่มอนุมัติ inline ออกจาก `LabTestingDetailPage.tsx`

**Files:**
- Modify: `src/pages/LabTestingDetailPage.tsx` (กล่อง amber ~บรรทัด 1137-1161, handler ~698-725, dialog ~1172-1180)

- [ ] **Step 1: ลบปุ่มในกล่อง "รอหัวหน้า Lab อนุมัติ"**

หาบล็อกนี้ (รอบบรรทัด 1149-1159) แล้วลบเฉพาะส่วน `{canApproveLab && (...)}` ออก ให้เหลือกล่อง banner สถานะอย่างเดียว:

ลบ:
```tsx
            {canApproveLab && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setLabRejectOpen(true)} disabled={submitting} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> ส่งกลับให้แก้
                </Button>
                <Button variant="primary" size="sm" onClick={handleLabApprove} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  อนุมัติผล Lab
                </Button>
              </div>
            )}
```

- [ ] **Step 2: ลบ handler + dialog ที่ไม่ใช้แล้ว**

ลบ `handleLabApprove` (บรรทัด ~698-710) และ `handleLabReject` (บรรทัด ~712-725) ทั้งสองฟังก์ชัน.
ลบ `RevisionRequestDialog` ของ labReject (บรรทัด ~1172-1180):

```tsx
        <RevisionRequestDialog
          open={labRejectOpen}
          onOpenChange={setLabRejectOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? 'ผู้ทดสอบ Lab'}
          recipientLabel="ผู้ทดสอบ Lab"
          warning="คำร้องจะถูกส่งกลับให้ผู้ทดสอบ Lab แก้ไข/ทดสอบใหม่ (ไม่ปิดคำร้อง)"
          onConfirm={handleLabReject}
        />
```

- [ ] **Step 3: เก็บกวาด state/import/ตัวแปรที่ค้าง**

- ลบ state `labRejectOpen` (เช่น `const [labRejectOpen, setLabRejectOpen] = useState(false);`)
- ลบ `canApproveLab` (`const canApproveLab = canAccessPath('/lab-approval');`) ถ้าไม่ถูกใช้ที่อื่นแล้ว
- ถ้า `RevisionRequestDialog` / `canAccessPath` / icon ใดไม่ถูกใช้แล้วในไฟล์ ให้ลบ import ที่ค้าง (ดูผล tsc/eslint)

- [ ] **Step 4: type-check + lint**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่ (โดยเฉพาะ "declared but never used" จาก state/handler/import ที่เพิ่งลบ — ต้องเคลียร์ให้หมด)

Run: `npm run lint`
Expected: ไม่มี error ใหม่จาก `LabTestingDetailPage.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/pages/LabTestingDetailPage.tsx
git commit -m "refactor: remove inline lab approval buttons (moved to review page)"
```

---

### Task 5: Verify ปลายทาง (manual E2E)

**Files:** ไม่มีการแก้ไฟล์ — ทดสอบจริงในเบราว์เซอร์

- [ ] **Step 1: รัน dev ทั้งสองฝั่ง**

Frontend: `npm run dev` (port 8000) · Backend: `cd server && npm run dev` (port 3001)

- [ ] **Step 2: ใช้ DevRoleSwitcher เป็น `lab-head` แล้วตรวจ flow**

1. เปิด `/lab-approval` → เห็นรายการที่รออนุมัติ + flag ผิดปกติ/revision/⏰ + เรียง priority (ผิดปกติขึ้นบน)
2. กด "ตรวจสอบ" → ไปที่ `/lab-approval/:id` (ไม่ใช่ `/lab-testing/:id`)
3. หน้า review แสดงตารางผล Lab read-only จัดกลุ่มตาม sample + indicator มีค่าผิดปกติ/ปกติ + (ถ้ามี) กล่องคำอธิบายการทำใหม่
4. กด "อนุมัติผล Lab" → confirm → toast สำเร็จ → กลับ `/lab-approval` และรายการหาย (ได้ `labApprovedAt`)
5. อีกคำร้อง: กด "ส่งกลับให้แก้" → กรอกเหตุผล → toast → กลับ list (คำร้องถูกส่งกลับผู้ทดสอบ Lab)

- [ ] **Step 3: ตรวจว่าหน้า lab-testing ไม่มีปุ่มอนุมัติแล้ว**

เปิด `/lab-testing/:id` ของคำร้องที่ `labCompletedAt` แต่ยังไม่ `labApprovedAt` → เห็นแค่ banner "รอหัวหน้า Lab อนุมัติ" ไม่มีปุ่มอนุมัติ/ส่งกลับ

- [ ] **Step 4: ตรวจสิทธิ์ (role ที่ไม่มี `/lab-approval`)**

สลับ role เป็นผู้ทดสอบ Lab ธรรมดา → เปิด `/lab-approval/:id` (ถ้า PrivateRoute ปล่อยผ่าน) เห็นตารางผลแต่ไม่มีแผงตัดสินล่างจอ. (ถ้า `/lab-approval` ถูกบล็อกที่ PrivateRoute อยู่แล้ว = ผ่านเช่นกัน)

- [ ] **Step 5: อัปเดต handoff/memory**

อัปเดต memory `project_lab_approval_stage.md` ว่าหน้า review เฉพาะ `/lab-approval/:id` เสร็จแล้ว (เหมือน QC) — ค้าง push + manual E2E ตามสถานะจริง
```

## หมายเหตุปิดท้าย

- ทุก commit ใช้ explicit pathspec (กัน committer อื่นใน develop)
- ยังไม่ push จนกว่า user สั่ง (ตามแนวทางสาขา develop เดิม)
