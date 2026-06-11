import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { usePetitionList } from "@/hooks/usePetition";
import { PETITION_DEPT_LABELS, type Petition } from "@/types/petition.types";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import { statusBadge } from "@/lib/statusBadge";

const API_BASE = import.meta.env.BASE_URL + "api";

const LabApproval = () => {
  const navigate = useNavigate();
  const { data, loading } = usePetitionList({ awaitingLabApproval: true, limit: 100 });
  const petitions = data?.items ?? [];
  const [testersMap, setTestersMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (petitions.length === 0) {
      setTestersMap({});
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
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petitions.map((p) => p._id).join(",")]);

  const columns: DataTableColumn<Petition>[] = [
    { key: "no", header: "เลขที่คำร้อง", className: "font-semibold text-primary", cell: (p) => p.petitionNo },
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
        <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/lab-testing/${p._id}`); }}>
          ตรวจสอบ
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={<span className="inline-flex items-center gap-2"><ShieldCheck className="w-6 h-6" />อนุมัติผล Lab</span>}
          description={`ตรวจสอบและอนุมัติผลการทดสอบจาก Lab · ${petitions.length} รายการรออนุมัติ`}
        />
        <DataTable
          columns={columns}
          data={petitions}
          rowKey={(p) => p._id}
          isLoading={loading}
          onRowClick={(p) => navigate(`/lab-testing/${p._id}`)}
          emptyTitle="ไม่มีคำร้องที่รออนุมัติ Lab"
          tableClassName="min-w-[700px]"
        />
      </div>
    </AppLayout>
  );
};

export default LabApproval;
