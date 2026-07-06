// src/components/lis/ChemicalRequisitionPanel.tsx
// การ์ดแสดงรายการเบิกสารเคมี (solvent) วันนี้ + ยกเลิก/คืนสต็อก (list-only — ปุ่มเบิกอยู่ที่ StockRequisitionTab)
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { todayStr } from "@/lib/chemicalRequisition";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

interface Props {
  roomSlug: string;
}

export default function ChemicalRequisitionPanel({ roomSlug }: Props) {
  const queryClient = useQueryClient();

  const { data: requisitions = [] } = useQuery({
    queryKey: ["chemical-requisitions", roomSlug, todayStr()],
    queryFn: () => api.getChemicalRequisitions({ room: roomSlug, date: todayStr() }),
    refetchOnWindowFocus: true,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteChemicalRequisition(id),
    onSuccess: () => { toast.success("ยกเลิกการเบิกแล้ว (คืนสต็อก)"); invalidate(); },
    onError: (err: Error) => toast.error(err.message || "ยกเลิกไม่สำเร็จ"),
  });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            สารเคมีที่เบิกวันนี้
          </span>
          {requisitions.length > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
              {requisitions.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requisitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FlaskConical className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">ยังไม่มีรายการเบิกวันนี้</p>
          </div>
        ) : (
          <ul className="divide-y">
            {requisitions.map((req) => (
              <li key={req._id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="w-12 text-xs tabular-nums text-muted-foreground">
                  {req.createdAt ? fmtTime(req.createdAt) : ""}
                </span>
                <span className="font-medium">{req.solventName}</span>
                <span className="text-muted-foreground">× {req.qty} ขวด</span>
                <span className="text-muted-foreground">→ {req.instrumentName}</span>
                {req.requestedBy?.name && (
                  <span className="text-xs text-muted-foreground">โดย {req.requestedBy.name}</span>
                )}
                <button
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  title="ยกเลิกการเบิก (คืนสต็อก)"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`ยกเลิกการเบิก ${req.solventName} x ${req.qty} ขวด และคืนสต็อก?`)) {
                      deleteMutation.mutate(req._id);
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
