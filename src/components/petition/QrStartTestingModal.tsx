import { Button } from '@/components/ui/button';
import { ScanLine } from 'lucide-react';

interface Props {
  onClose: () => void;
  onDone: () => void;
}

// Phase 2: hook up real QR scan & POST /petitions/:id/review action=startTesting.
// For now this is a placeholder modal so list page can mount.
export default function QrStartTestingModal({ onClose, onDone }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[10px] w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary-500" />
          <h2 className="text-lg font-bold text-black-500">สแกน QR เริ่มตรวจ</h2>
        </div>
        <p className="text-sm text-grey-500">
          ฟีเจอร์นี้จะเปิดใช้งานใน Phase 2 — สแกน QR ของคำร้องเพื่อเปลี่ยนสถานะเป็น "QC กำลังตรวจ"
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            ปิด
          </Button>
          <Button variant="primary" onClick={() => { onDone(); onClose(); }}>
            ตกลง
          </Button>
        </div>
      </div>
    </div>
  );
}
