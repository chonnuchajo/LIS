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
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-primary" />
          สารเคมีที่เบิกวันนี้
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requisitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีการเบิกวันนี้</p>
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
