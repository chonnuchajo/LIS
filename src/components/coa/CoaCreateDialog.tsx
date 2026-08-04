import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EligibleCoaPetition } from "@/types/coa.types";

export default function CoaCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [petitionId, setPetitionId] = useState("");
  const [selectedSeqs, setSelectedSeqs] = useState<number[]>([]);
  const { data } = useQuery({ queryKey: ["coa", "eligible-petitions"], queryFn: api.getEligibleCoaPetitions, enabled: open });
  const petitions = useMemo(() => data?.items ?? [], [data]);
  const selectedPetition = useMemo(
    () => petitions.find((petition: EligibleCoaPetition) => petition._id === petitionId),
    [petitions, petitionId],
  );
  const create = useMutation({
    mutationFn: () => api.createCoaDocument({ petitionId, selectedItemSeqs: selectedSeqs }),
    onSuccess: (doc) => {
      onOpenChange(false);
      onCreated(doc._id);
    },
  });

  function toggleSeq(seq: number) {
    setSelectedSeqs((value) => (value.includes(seq) ? value.filter((item) => item !== seq) : [...value, seq]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>สร้าง COA</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="max-h-80 overflow-auto rounded-md border">
            {petitions.map((petition) => (
              <button
                key={petition._id}
                type="button"
                className={`block w-full border-b px-3 py-2 text-left text-sm hover:bg-slate-50 ${petition._id === petitionId ? "bg-sky-50" : ""}`}
                onClick={() => {
                  setPetitionId(petition._id);
                  setSelectedSeqs([]);
                }}
              >
                <div className="font-medium">{petition.petitionNo}</div>
                <div className="text-xs text-muted-foreground">{petition.items.length} รายการ</div>
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-auto rounded-md border">
            {!selectedPetition && <div className="p-6 text-center text-sm text-muted-foreground">เลือกคำร้องที่อนุมัติผล Lab แล้ว</div>}
            {selectedPetition?.items.map((item) => (
              <label key={item.seq} className="flex items-start gap-3 border-b p-3 text-sm">
                <Checkbox checked={selectedSeqs.includes(item.seq)} onCheckedChange={() => toggleSeq(item.seq)} />
                <span>
                  <span className="block font-medium">{item.sampleName || item.commonName || `Sample ${item.seq}`}</span>
                  <span className="block text-xs text-muted-foreground">{item.batchNo || item.lotNo || "-"}</span>
                  {item.activeCoa && <span className="mt-1 block text-xs text-amber-600">มี COA แล้ว: {item.activeCoa.coaNo}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
          <Button className="gap-2" disabled={!petitionId || selectedSeqs.length === 0 || create.isPending} onClick={() => create.mutate()}>
            <FilePlus2 className="h-4 w-4" />
            สร้างร่าง COA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
