import { useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { pendingAdditionalSample } from '@/lib/additionalSamples';
import type { AdditionalSampleRequest, Petition, PetitionItem } from '@/types/petition.types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  petition: Petition;
  side: AdditionalSampleRequest['side'];
  items: PetitionItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beforeSubmit: () => Promise<void>;
  onRequested: (petition: Petition) => void;
}

export default function AdditionalSampleRequestDialog({ petition, side, items, open, onOpenChange, beforeSubmit, onRequested }: Props) {
  const [reason, setReason] = useState('');
  const [weights, setWeights] = useState<Record<number, string[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const pending = pendingAdditionalSample(petition, side);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending.current || pending) return;
    if (!reason.trim()) { setError('กรุณาระบุเหตุผลที่ขอตัวอย่างเพิ่ม'); return; }
    if (reason.trim().length > 2000) { setError('เหตุผลต้องยาวไม่เกิน 2000 ตัวอักษร'); return; }
    const selected = items.filter((item) => weights[item.seq] !== undefined)
      .map((item) => ({ itemSeq: item.seq, quantity: weights[item.seq].length, weights: weights[item.seq].map(Number) }));
    if (!selected.length) { setError('กรุณาเลือกรายการอย่างน้อย 1 รายการ'); return; }
    if (selected.some((item) => item.quantity < 1 || item.quantity > 1000 || item.weights.some((weight) => ![100, 250, 500].includes(weight)))) {
      setError('กรุณาเลือกน้ำหนัก 100, 250 หรือ 500 กรัมให้ครบทุกตัวอย่าง (ไม่เกิน 1000 ตัวอย่างต่อรายการ)');
      return;
    }
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await beforeSubmit();
      const response = await api.post<Petition & { additionalSampleNotificationWarning?: string }>(
        '/petitions/' + petition._id + '/additional-samples',
        { side, reason: reason.trim(), items: selected },
      );
      onRequested(response.data.data);
      if (response.data.data.additionalSampleNotificationWarning) toast.warning(response.data.data.additionalSampleNotificationWarning);
      onOpenChange(false);
      setReason('');
      setWeights({});
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!sending.current) onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ขอตัวอย่างเพิ่ม ({side.toUpperCase()})</DialogTitle>
          <DialogDescription>เลือกรายการและน้ำหนักแต่ละตัวอย่าง พิมพ์ 1 ฉลากต่อตัวอย่าง ไม่ใช่ตามน้ำหนัก การขอเพิ่มยังไม่ปิดผลตรวจ และจะรอรับตัวอย่างรอบใหม่</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <fieldset disabled={busy || !!pending} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="additional-sample-reason">เหตุผลที่ขอตัวอย่างเพิ่ม</Label>
              <Textarea id="additional-sample-reason" required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <div className="rounded-lg border bg-card text-card-foreground divide-y">
              {items.map((item) => (
                <div key={item.seq} className="space-y-3 p-3">
                  <div className="flex items-center gap-3">
                    <Checkbox id={'sample-item-' + item.seq} checked={weights[item.seq] !== undefined} disabled={busy || !!pending}
                      onCheckedChange={(checked) => setWeights((previous) => {
                        const next = { ...previous };
                        if (checked) next[item.seq] = [''];
                        else delete next[item.seq];
                        return next;
                      })} />
                    <Label htmlFor={'sample-item-' + item.seq} className="flex-1 min-w-0">รายการที่ {item.seq}: {item.sampleName}</Label>
                  </div>
                  {weights[item.seq]?.map((weight, index) => (
                    <div key={index} className="flex items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label htmlFor={`sample-weight-${item.seq}-${index}`}>น้ำหนักตัวอย่างที่ {index + 1}</Label>
                        <NativeSelect id={`sample-weight-${item.seq}-${index}`} aria-label={`น้ำหนักตัวอย่างที่ ${index + 1} รายการที่ ${item.seq}`} value={weight}
                          onChange={(event) => setWeights((previous) => ({ ...previous, [item.seq]: previous[item.seq].map((value, weightIndex) => weightIndex === index ? event.target.value : value) }))}>
                          <option value="" disabled>เลือกน้ำหนัก</option>
                          {[100, 250, 500].map((value) => <option key={value} value={value}>{value} กรัม</option>)}
                        </NativeSelect>
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label={`ลบตัวอย่างที่ ${index + 1} รายการที่ ${item.seq}`} disabled={weights[item.seq].length === 1}
                        onClick={() => setWeights((previous) => ({ ...previous, [item.seq]: previous[item.seq].filter((_, weightIndex) => weightIndex !== index) }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {weights[item.seq] && <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" aria-label={`เพิ่มตัวอย่างรายการที่ ${item.seq}`} disabled={weights[item.seq].length >= 1000}
                      onClick={() => setWeights((previous) => ({ ...previous, [item.seq]: [...previous[item.seq], ''] }))}>
                      <Plus className="h-4 w-4" />เพิ่มตัวอย่าง
                    </Button>
                    <span className="text-sm text-muted-foreground">{weights[item.seq].length} ตัวอย่าง · {weights[item.seq].length} ฉลาก</span>
                  </div>}
                </div>
              ))}
            </div>
          </fieldset>
          {(pending || error) && <p role="alert" className="text-sm text-destructive">{pending ? 'มีคำขอที่รอรับตัวอย่างเพิ่มสำหรับฝั่งนี้แล้ว' : error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !!pending}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'กำลังส่งคำขอ...' : 'ส่งคำขอ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
