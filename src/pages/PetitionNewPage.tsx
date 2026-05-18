import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import { Button } from '@/components/ui/button';
import PetitionForm from '@/components/petition/PetitionForm';
import SampleLabelStep, { type LabelItem } from '@/components/petition/SampleLabelStep';
import { createPetition } from '@/hooks/usePetition';
import type { PetitionFormValues } from '@/lib/validations';

export default function PetitionNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as
    | { prefill?: Partial<PetitionFormValues>; prodOrderNos?: string[] }
    | null;
  const prefill = state?.prefill;
  const prodOrderNos = state?.prodOrderNos;

  const [step, setStep] = useState<1 | 2>(1);
  const [petitionValues, setPetitionValues] = useState<PetitionFormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNext(values: PetitionFormValues) {
    setPetitionValues(values);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmitLabel(labelItems: LabelItem[]) {
    if (!petitionValues) return;
    setSubmitting(true);
    setError(null);
    try {
      const merged: PetitionFormValues = {
        ...petitionValues,
        items: petitionValues.items.map((item, idx) => ({
          ...item,
          ...labelItems[idx],
        })),
      };
      const created = await createPetition(merged, prodOrderNos);
      navigate(`/petitions/${created._id}`, { state: { autoPrint: true } });
    } catch (err) {
      const message =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data
              ?.error?.message
          : err instanceof Error
            ? err.message
            : null;
      setError(message ?? 'บันทึกคำร้องไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-black-500">คำขอตรวจตัวอย่าง</h1>
            <p className="text-sm text-grey-500">
              กรอกข้อมูลตามแบบฟอร์ม FM-QR-07-04-001-R00 ให้ครบถ้วน
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            <span className={step === 1 ? 'font-semibold text-primary-500' : 'text-grey-400'}>
              1. ข้อมูลคำร้อง
            </span>
            <span className="text-grey-300 mx-1">→</span>
            <span className={step === 2 ? 'font-semibold text-primary-500' : 'text-grey-400'}>
              2. ข้อมูลฉลากตัวอย่าง
            </span>
          </div>

          {error && (
            <div className="rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500">
              {error}
            </div>
          )}

          {step === 1 && (
            <>
              {prefill && (
                <div className="rounded-[10px] border border-primary-500 bg-primary-50 p-3 text-sm text-primary-500">
                  ดึงข้อมูลจากใบสั่งผลิตอัตโนมัติ
                  {prefill.items?.length ? ` (${prefill.items.length} ตัวอย่าง)` : ''}
                </div>
              )}
              <PetitionForm
                defaultValues={prefill ?? petitionValues ?? undefined}
                onSubmit={handleNext}
                submitLabel="ถัดไป"
              />
            </>
          )}

          {step === 2 && petitionValues && (
            <SampleLabelStep
              petitionValues={petitionValues}
              onBack={() => setStep(1)}
              onSubmit={handleSubmitLabel}
              submitting={submitting}
            />
          )}
        </div>
    </AppLayout>
  );
}
