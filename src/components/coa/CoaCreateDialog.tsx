import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoles, primaryRole } from "@/lib/roles";
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
  const { user } = useAuth();
  const [petitionId, setPetitionId] = useState("");
  const [selectedSeqs, setSelectedSeqs] = useState<number[]>([]);
  const { data } = useQuery({ queryKey: ["coa", "eligible-petitions"], queryFn: api.getEligibleCoaPetitions, enabled: open });
  const petitions = useMemo(() => data?.items ?? [], [data]);
  const selectedPetition = useMemo(
    () => petitions.find((petition: EligibleCoaPetition) => petition._id === petitionId),
    [petitions, petitionId],
  );
  const actor = useMemo(() => {
    const roles = normalizeRoles(user);
    const activeRole = user?.role || primaryRole(roles);
    return {
      name: user?.name,
      email: user?.email,
      role: activeRole,
      activeRole,
    };
  }, [user]);
  const create = useMutation({
    mutationFn: () => api.createCoaDocument({ petitionId, selectedItemSeqs: selectedSeqs, _user: actor }),
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
      <DialogContent className="border-violet-100 bg-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-violet-950">สร้าง COA</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="max-h-80 overflow-auto rounded-md border border-violet-100 bg-violet-50/40">
            {petitions.map((petition) => (
              <button
                key={petition._id}
                type="button"
                className={`block w-full border-b border-violet-100 px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-50 ${petition._id === petitionId ? "bg-violet-100 text-violet-950" : "text-slate-700"}`}
                onClick={() => {
                  setPetitionId(petition._id);
                  setSelectedSeqs([]);
                }}
              >
                <div className="font-medium">{petition.petitionNo}</div>
                <div className="text-xs text-violet-500">{petition.items.length} รายการ</div>
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-auto rounded-md border border-violet-100 bg-white">
            {!selectedPetition && <div className="p-6 text-center text-sm text-violet-500">เลือกคำร้องที่อนุมัติผล Lab แล้ว</div>}
            {selectedPetition?.items.map((item) => (
              <label key={item.seq} className="flex items-start gap-3 border-b border-violet-50 p-3 text-sm hover:bg-emerald-50/60">
                <Checkbox checked={selectedSeqs.includes(item.seq)} onCheckedChange={() => toggleSeq(item.seq)} />
                <span>
                  <span className="block font-medium text-violet-950">{item.sampleName || item.commonName || `Sample ${item.seq}`}</span>
                  <span className="block text-xs text-violet-500">{item.batchNo || item.lotNo || "-"}</span>
                  {item.activeCoa && <span className="mt-1 block text-xs text-emerald-700">มี COA แล้ว: {item.activeCoa.coaNo}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-violet-200 text-violet-700 hover:bg-violet-50" onClick={() => onOpenChange(false)}>ปิด</Button>
          <Button className="gap-2 bg-violet-700 text-white hover:bg-violet-800" disabled={!petitionId || selectedSeqs.length === 0 || create.isPending} onClick={() => create.mutate()}>
            <FilePlus2 className="h-4 w-4" />
            สร้างร่าง COA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
