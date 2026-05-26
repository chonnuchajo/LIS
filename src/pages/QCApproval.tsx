import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/lis/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FlaskConical, AlertTriangle, RotateCcw } from "lucide-react";
import { usePetitionList } from "@/hooks/usePetition";
import { PETITION_DEPT_LABELS, PETITION_STATUS_CONFIG } from "@/types/petition.types";
import { api } from "@/lib/api";

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

  return (
    <AppLayout>
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" />
            QC Approval
          </h1>
          <p className="text-sm text-muted-foreground">ตรวจสอบและอนุมัติผลการทดสอบจาก QC</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="w-4 h-4" />
                คำร้องทดสอบเสร็จสิ้น รออนุมัติ
              </CardTitle>
              <Badge variant="green-soft">{successPetitions.length} รายการ</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {petitionLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : successPetitions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">ไม่มีคำร้องที่รออนุมัติ</p>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่คำร้อง</TableHead>
                      <TableHead>แผนก</TableHead>
                      <TableHead>ผู้นำส่ง</TableHead>
                      <TableHead>ผู้ทดสอบ</TableHead>
                      <TableHead>จำนวนรายการ</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {successPetitions.map((p) => {
                      const statusCfg = PETITION_STATUS_CONFIG[p.status];
                      const testers = testersMap[p._id] ?? [];
                      return (
                        <TableRow
                          key={p._id}
                          className="cursor-pointer hover:bg-grey-50"
                          onClick={() => navigate(`/qc-testing/${p._id}`)}
                        >
                          <TableCell className="font-semibold text-primary">
                            <div className="flex items-center gap-1.5">
                              <span>{p.petitionNo}</span>
                              {returnedMap[p._id] && (
                                <RotateCcw
                                  className="h-4 w-4 text-orange-500 shrink-0"
                                  aria-label="ส่งกลับมาบันทึกผลใหม่"
                                />
                              )}
                              {abnormalMap[p._id] && (
                                <AlertTriangle
                                  className="h-4 w-4 text-red-500 shrink-0"
                                  aria-label="พบค่าผิดปกติในผลทดสอบ"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="blue-soft">{PETITION_DEPT_LABELS[p.dept]}</Badge>
                          </TableCell>
                          <TableCell>{p.submittedBy?.name ?? "-"}</TableCell>
                          <TableCell className="max-w-[200px] text-sm text-muted-foreground align-top">
                            {testers.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {testers.map((name) => (
                                  <span key={name}>{name}</span>
                                ))}
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{p.items?.length ?? 0} รายการ</TableCell>
                          <TableCell>
                            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/qc-testing/${p._id}`);
                              }}
                            >
                              ตรวจสอบ
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
    </AppLayout>
  );
};

export default QCApproval;
