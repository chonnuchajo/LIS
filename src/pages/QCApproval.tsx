import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, RotateCcw } from "lucide-react";
import { usePetitionList } from "@/hooks/usePetition";
import { PETITION_DEPT_LABELS, type Petition } from "@/types/petition.types";
import { api } from "@/lib/api";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import { statusBadge } from "@/lib/statusBadge";

const API_BASE = import.meta.env.BASE_URL + "api";

const QCApproval = () => {
  const navigate = useNavigate();
  const { data: petitionData, loading: petitionLoading } = usePetitionList({
    status: "success",
    limit: 100,
  });
  const successPetitions = petitionData?.items ?? [];

  const [testersMap, setTestersMap] = useState<Record<string, string[]>>({});
  const [abnormalMap, setAbnormalMap] = useState<Record<string, boolean>>({});
  const [returnedMap, setReturnedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (successPetitions.length === 0) {
      setTestersMap({});
      setAbnormalMap({});
      setReturnedMap({});
      return;
    }
    const ids = successPetitions.map((p) => p._id);
    const idsParam = ids.join(",");
    let alive = true;
    fetch(`${API_BASE}/qc-results/testers?petitionIds=${encodeURIComponent(idsParam)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((map: Record<string, string[]>) => {
        if (alive) setTestersMap(map || {});
      })
      .catch(() => {
        if (alive) setTestersMap({});
      });
    api.getAbnormalFlags(ids)
      .then((map) => {
        if (alive) setAbnormalMap(map || {});
      })
      .catch(() => {
        if (alive) setAbnormalMap({});
      });
    api.getReturnedFlags(ids)
      .then((map) => {
        if (alive) setReturnedMap(map || {});
      })
      .catch(() => {
        if (alive) setReturnedMap({});
      });
    return () => {
      alive = false;
    };
  }, [successPetitions.map((p) => p._id).join(",")]);

  const columns: DataTableColumn<Petition>[] = [
    {
      key: "no",
      header: "เลขที่คำร้อง",
      className: "font-semibold text-primary",
      cell: (p) => (
        <div className="flex items-center gap-1.5">
          <span>{p.petitionNo}</span>
          {returnedMap[p._id] && (
            <RotateCcw className="h-4 w-4 text-orange-500 shrink-0" aria-label="ส่งกลับมาบันทึกผลใหม่" />
          )}
          {abnormalMap[p._id] && (
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" aria-label="พบค่าผิดปกติในผลทดสอบ" />
          )}
        </div>
      ),
    },
    {
      key: "dept",
      header: "แผนก",
      cell: (p) => <Badge variant="blue-soft">{PETITION_DEPT_LABELS[p.dept]}</Badge>,
    },
    { key: "submitter", header: "ผู้นำส่ง", cell: (p) => p.submittedBy?.name ?? "-" },
    {
      key: "testers",
      header: "ผู้ทดสอบ",
      className: "max-w-[200px] text-sm text-muted-foreground align-top",
      cell: (p) => {
        const testers = testersMap[p._id] ?? [];
        return testers.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {testers.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        ) : (
          "-"
        );
      },
    },
    { key: "count", header: "จำนวนรายการ", cell: (p) => `${p.items?.length ?? 0} รายการ` },
    {
      key: "status",
      header: "สถานะ",
      cell: (p) => {
        const b = statusBadge(p.status);
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
    },
    {
      key: "action",
      header: "การดำเนินการ",
      className: "text-right",
      cell: (p) => (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/qc-testing/${p._id}`);
          }}
        >
          ตรวจสอบ
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" />
              QC Approval
            </span>
          }
          description={`ตรวจสอบและอนุมัติผลการทดสอบจาก QC · ${successPetitions.length} รายการรออนุมัติ`}
        />

        <DataTable
          columns={columns}
          data={successPetitions}
          rowKey={(p) => p._id}
          isLoading={petitionLoading}
          onRowClick={(p) => navigate(`/qc-testing/${p._id}`)}
          emptyTitle="ไม่มีคำร้องที่รออนุมัติ"
          tableClassName="min-w-[700px]"
        />
      </div>
    </AppLayout>
  );
};

export default QCApproval;
