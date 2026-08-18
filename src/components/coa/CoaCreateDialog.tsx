import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoles, primaryRole } from "@/lib/roles";
import type { CoaDocument, EligibleCoaPetition } from "@/types/coa.types";

function formatProductionDate(value?: string | null) {
  if (!value) return "";
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

export default function CoaCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (doc: CoaDocument) => void;
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
  const selectedItems = useMemo(
    () => selectedPetition?.items.filter((item) => selectedSeqs.includes(item.seq)) ?? [],
    [selectedPetition, selectedSeqs],
  );
  const reusableActiveCoa = useMemo(() => {
    if (selectedItems.length === 0) return null;
    const activeCoas = selectedItems.map((item) => item.activeCoa).filter(Boolean);
    const coaIds = new Set(activeCoas.map((coa) => coa?.coaId));
    return activeCoas.length === selectedItems.length && coaIds.size === 1 ? activeCoas[0] : null;
  }, [selectedItems]);
  const reusableActiveCoaFields = useMemo(() => {
    if (!reusableActiveCoa) return "ชื่อสามัญ/Batch/วันที่ผลิตนี้";
    return [
      reusableActiveCoa.commonName ? `ชื่อสามัญ ${reusableActiveCoa.commonName}` : null,
      reusableActiveCoa.batchNo ? `Batch No. ${reusableActiveCoa.batchNo}` : null,
      reusableActiveCoa.productionDate ? `วันที่ผลิต ${formatProductionDate(reusableActiveCoa.productionDate)}` : null,
    ].filter(Boolean).join(" · ") || "ชื่อสามัญ/Batch/วันที่ผลิตนี้";
  }, [reusableActiveCoa]);
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
      onCreated(doc);
    },
  });
  const submitExisting = useMutation({
    mutationFn: async () => {
      if (!reusableActiveCoa) throw new Error("ไม่พบ COA ใบเดิมสำหรับส่งอนุมัติ");
      const revision = await api.reviseCoaDocument(reusableActiveCoa.coaId, { _user: actor });
      return api.submitCoaDocument(revision._id, { _user: actor });
    },
    onSuccess: (doc) => {
      onOpenChange(false);
      onCreated(doc);
    },
  });

  function toggleSeq(seq: number) {
    setSelectedSeqs((value) => (value.includes(seq) ? value.filter((item) => item !== seq) : [...value, seq]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-sky-100 bg-sky-50 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-sky-950">สร้าง COA</DialogTitle>
        </DialogHeader>
        {reusableActiveCoa && (
          <Alert className="border-orange-200 bg-orange-50 text-orange-900">
            <AlertTitle>พบประวัติการทำ COA แล้ว</AlertTitle>
            <AlertDescription>
              {reusableActiveCoaFields} เคยออก COA แล้ว เลข COA No. {reusableActiveCoa.coaNo}
              {reusableActiveCoa.petitionNo ? ` จากคำร้อง ${reusableActiveCoa.petitionNo}` : ""}
              <span className="mt-1 block">กด “ส่งใบเดิมไปรออนุมัติ” เพื่อส่งข้อมูลไปหน้า “รออนุมัติ” ได้ทันที</span>
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="max-h-80 overflow-auto rounded-md border border-sky-100 bg-sky-50/70">
            {petitions.map((petition) => (
              <button
                key={petition._id}
                type="button"
                className={`block w-full border-b border-sky-100 px-3 py-2 text-left text-sm transition-colors hover:bg-sky-100/80 ${petition._id === petitionId ? "bg-sky-100 text-sky-950" : "text-slate-700"}`}
                onClick={() => {
                  setPetitionId(petition._id);
                  setSelectedSeqs([]);
                }}
              >
                <div className="font-medium">{petition.petitionNo}</div>
                <div className="text-xs text-sky-500">{petition.items.length} รายการ</div>
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-auto rounded-md border border-sky-100 bg-white/90">
            {!selectedPetition && <div className="p-6 text-center text-sm text-sky-500">เลือกคำร้องที่อนุมัติผล Lab แล้ว</div>}
            {selectedPetition?.items.map((item) => (
              <label key={item.seq} className="flex items-start gap-3 border-b border-sky-50 p-3 text-sm hover:bg-sky-50/80">
                <Checkbox checked={selectedSeqs.includes(item.seq)} onCheckedChange={() => toggleSeq(item.seq)} />
                  <span>
                    <span className="block font-medium text-sky-950">{item.sampleName || item.commonName || `Sample ${item.seq}`}</span>
                    <span className="block text-xs text-sky-500">{[item.batchNo || item.lotNo || "-", item.productionDate ? `ผลิต ${formatProductionDate(item.productionDate)}` : null].filter(Boolean).join(" · ")}</span>
                    {item.activeCoa && (
                      <span className="mt-1 block rounded-md bg-orange-50 px-2 py-1 text-xs text-orange-700">
                      มีประวัติ COA แล้ว: {item.activeCoa.coaNo}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-sky-200 text-sky-700 hover:bg-sky-50" onClick={() => onOpenChange(false)}>ปิด</Button>
          {reusableActiveCoa ? (
            <Button
              className="gap-2 bg-orange-600 text-white hover:bg-orange-700"
              disabled={submitExisting.isPending || create.isPending}
              onClick={() => submitExisting.mutate()}
            >
              ส่งใบเดิมไปรออนุมัติ
            </Button>
          ) : (
            <Button className="gap-2 bg-sky-600 text-white hover:bg-sky-700" disabled={!petitionId || selectedSeqs.length === 0 || create.isPending || submitExisting.isPending} onClick={() => create.mutate()}>
              <FilePlus2 className="h-4 w-4" />
              สร้างร่าง COA
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
