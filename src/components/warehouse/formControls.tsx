// ตัวควบคุมฟอร์มที่ใช้ร่วมกันทุก step ของฟอร์ม F-WAR-03-01,02
// RadioRow / CheckRow / toggle ยกมาจาก LabAgreementReviewDialog เพื่อให้หน้าตาเหมือนกันทั้งระบบ
import { Checkbox } from '@/components/ui/checkbox';

export function toggle<T>(arr: T[] | undefined, v: T, on: boolean): T[] {
  const set = new Set(arr ?? []);
  if (on) set.add(v); else set.delete(v);
  return Array.from(set);
}

export const RadioRow = ({ checked, onSelect, children }:
  { checked: boolean; onSelect: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onSelect}
    className={`flex items-start gap-2 text-left text-sm w-full py-1 ${checked ? 'font-medium text-sky-700' : 'text-grey-700'}`}>
    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${checked ? 'border-sky-600 bg-sky-600' : 'border-grey-400'}`} />
    <span>{children}</span>
  </button>
);

export const CheckRow = ({ checked, onChange, children }:
  { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) => (
  <label className="flex items-start gap-2 text-sm py-1 cursor-pointer">
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
    <span>{children}</span>
  </label>
);

// ช่องกรอกพร้อม label — ใช้กับช่องเติมคำบนกระดาษ
export const Field = ({ label, children, className }:
  { label: string; children: React.ReactNode; className?: string }) => (
  <label className={`flex flex-col gap-1 text-sm ${className ?? ''}`}>
    <span className="text-grey-600">{label}</span>
    {children}
  </label>
);
