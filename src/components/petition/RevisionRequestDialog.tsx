import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { releaseBodyPointerLock } from '@/context/ConfirmDialog';
import { Loader2, RotateCcw } from 'lucide-react';

interface RevisionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petitionNo: string;
  submitterName: string;
  onConfirm: (note: string) => Promise<void> | void;
  /** ผู้รับปลายทาง (default = submitterName ผู้ยื่น) */
  recipientLabel?: string;
  /** ข้อความเตือน (default = ปิดคำร้อง สร้างใหม่). ส่งกลับ Lab/QC ให้ใช้ข้อความที่ไม่ปิดคำร้อง */
  warning?: string;
}

export function RevisionRequestDialog({
  open,
  onOpenChange,
  petitionNo,
  submitterName,
  onConfirm,
  recipientLabel,
  warning,
}: RevisionRequestDialogProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
      setNote('');
      onOpenChange(false);
      // onConfirm usually navigates immediately; clear the Radix body lock now
      // so the next page isn't born unclickable (see RoutePointerLockGuard).
      releaseBodyPointerLock();
    } catch {
      // keep dialog open on error
    } finally {
      setSubmitting(false);
    }
  };

  const canConfirm = note.trim().length > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-orange-500" />
            ส่งคำร้อง {petitionNo} ให้แก้ไข
          </DialogTitle>
          <DialogDescription>
            ส่งกลับให้: <span className="font-semibold text-foreground">{recipientLabel ?? submitterName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            ข้อความถึงผู้ยื่น <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ระบุสิ่งที่ต้องการให้แก้ไข..."
            disabled={submitting}
            className="w-full text-sm rounded border px-3 py-2 min-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary-300 disabled:bg-grey-50"
          />
        </div>

        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          ⚠ {warning ?? 'คำร้องนี้จะถูกปิด ผู้ยื่นจะต้องสร้างคำร้องใหม่จากคำร้องนี้เพื่อแก้ไข'}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            ส่งให้แก้ไข
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
