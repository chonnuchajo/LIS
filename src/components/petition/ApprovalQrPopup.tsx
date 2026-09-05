import QRCode from "qrcode";
import { CheckCircle2, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Petition } from "@/types/petition.types";

function getQrValue(petition: Petition, item: Petition["items"][number]): string {
  return JSON.stringify({
    id: petition._id,
    petitionNo: petition.petitionNo,
    sampleId: item.sampleId || "",
    itemSeq: item.seq,
  });
}

function QrCodeSvg({ value }: { value: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const modules = Array.from(qr.modules.data as Uint8Array);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-28 w-28 shrink-0"
      role="img"
      aria-label={`QR ${value}`}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      {modules.map((filled, index) => {
        if (!filled) return null;
        const x = index % size;
        const y = Math.floor(index / size);
        return <rect key={index} x={x} y={y} width="1" height="1" fill="#000" />;
      })}
    </svg>
  );
}

export default function ApprovalQrPopup({
  petition,
  open,
  onOpenChange,
}: {
  petition: Petition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!petition) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            อนุมัติแล้ว — QR Code พร้อมใช้งาน
          </DialogTitle>
          <DialogDescription>
            {petition.petitionNo} · popup นี้ปิดเองใน 30 วินาที
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <div className="flex items-center gap-2 font-medium">
            <Volume2 className="h-4 w-4" />
            ระบบเปิดเสียงเตือนพร้อม popup นี้
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {petition.items.map((item) => (
            <div key={`${item.seq}-${item.sampleId || item.batchNo}`} className="flex gap-3 rounded-lg border bg-white p-3 shadow-sm">
              <QrCodeSvg value={getQrValue(petition, item)} />
              <div className="min-w-0 space-y-1 text-sm">
                <div className="font-semibold text-foreground">ตัวอย่าง {item.sampleId || item.seq}</div>
                <div className="break-words text-muted-foreground">{item.sampleName}</div>
                {item.batchNo ? <div className="break-all text-xs text-muted-foreground">Batch: {item.batchNo}</div> : null}
                <div className="break-all text-xs font-medium text-green-700">{petition.petitionNo}</div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
