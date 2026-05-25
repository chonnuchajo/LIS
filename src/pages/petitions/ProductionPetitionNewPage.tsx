import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ItemsStep, { type ItemRowValues } from '@/components/petition/wizard/ItemsStep';
import type { SubmitterValues } from '@/components/petition/wizard/SubmitterPicker';
import ProductionPlanStep from '@/components/petition/wizard/ProductionPlanStep';
import LabRequestStep, { type LabRequestRowValues } from '@/components/petition/wizard/LabRequestStep';
import {
  isLabBatch,
  makeBlankProductionPlan,
  type ProductionPlan,
} from '@/types/productionPlan.types';
import { createPetition, createLabRequest } from '@/hooks/usePetition';
import { useAuth } from '@/hooks/useAuth';

const ICP_LADDA_ADDRESS = '151 ม.8 ต.สามควายเผือก อ.เมืองนครปฐม จ.นครปฐม 73000';
const ICP_LADDA_COMPANY = 'ICP Ladda Co., LTD.';

type StepKey = 'items' | 'plan' | 'lab';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'items', label: '1. ผู้นำส่ง + รายการตัวอย่าง' },
  { key: 'plan', label: '2. ใบวางแผน-ควบคุมการผลิต' },
  { key: 'lab', label: '3. ใบคำขอรับบริการ' },
];

function makeBlankItem(seq: number): ItemRowValues {
  return {
    seq,
    sampleName: '',
    commonName: '',
    batchNo: '',
    productionDate: null,
    packageUnit: '',
    submissionNo: '',
    testUnit: '',
    testItems: '',
    note: '',
  };
}

function makeBlankLabRequest(
  batchNo: string,
  sampleSeq: number,
  sampleName: string,
  fullName: string,
  email: string,
  department: string,
): LabRequestRowValues {
  return {
    batchNo,
    sampleSeq,
    sampleName,
    requester: {
      fullName,
      department,
      address: ICP_LADDA_ADDRESS,
      phone: '034-305281-2',
      fax: '',
      email,
      contactName: fullName,
      position: '',
    },
    serviceAgreement: {
      sampleDelivery: 'self',
      testMethod: 'standard',
      testMethodDoneBefore: null,
      testMethodDetail: '',
      testDuration: 'normal',
      testDurationDays: null,
      requireUncertainty: false,
    },
    reportCustomerName: ICP_LADDA_COMPANY,
    reportAddressType: 'default',
    reportAddressOther: '',
    invoiceAddressType: 'default',
    invoiceAddressOther: '',
    testDelivery: ['email'],
    storageCondition: ['room'],
    packageType: ['plasticBag'],
    packageTypeOther: '',
    sampleReturn: 'return',
  };
}

export default function ProductionPetitionNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const prodOrderNos = (location.state as { prodOrderNos?: string[] } | null)?.prodOrderNos;

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = STEPS[stepIdx].key;

  const [submitter, setSubmitter] = useState<SubmitterValues>({
    employeeId: user?.id ?? '',
    name: user?.name ?? '',
  });
  const [deliverer, setDeliverer] = useState<SubmitterValues>({
    employeeId: user?.id ?? '',
    name: user?.name ?? '',
  });
  const [delivererTouched, setDelivererTouched] = useState(false);

  // Re-sync submitter when user auth resolves (read-only — always match logged-in user)
  useEffect(() => {
    if (user?.name) {
      setSubmitter({ employeeId: user.id ?? '', name: user.name });
      if (!delivererTouched) {
        setDeliverer({ employeeId: user.id ?? '', name: user.name });
      }
    }
  }, [user?.id, user?.name, delivererTouched]);

  const [items, setItems] = useState<ItemRowValues[]>([makeBlankItem(1)]);

  const [plan, setPlanState] = useState<ProductionPlan | null>(null);

  const labBatches = useMemo(
    () => items.filter((it) => it.batchNo && isLabBatch(it.batchNo)),
    [items],
  );

  const [labRequest, setLabRequest] = useState<LabRequestRowValues | null>(null);

  // sync plan + labRequest with items
  useEffect(() => {
    const validItems = items.filter((it) => it.batchNo);
    const batchNos = validItems.map((it) => it.batchNo);
    if (batchNos.length > 0) {
      setPlanState((prev) => {
        const first = validItems[0];
        if (!prev) {
          return {
            ...makeBlankProductionPlan(batchNos[0], batchNos),
            commonName: first.commonName || '',
            productionDate: first.productionDate ?? '',
            quantity: first.packageUnit ?? '',
          };
        }
        return { ...prev, batchNo: batchNos[0], batchNos };
      });
    }
    const labItems = validItems.filter((it) => isLabBatch(it.batchNo));
    if (labItems.length > 0) {
      setLabRequest((prev) => {
        if (!prev) {
          const first = labItems[0];
          return makeBlankLabRequest(
            first.batchNo,
            first.seq,
            first.sampleName,
            user?.name ?? '',
            user?.email ?? '',
            user?.department ?? 'ผลิต',
          );
        }
        return prev;
      });
    } else {
      setLabRequest(null);
    }
  }, [items, submitter.name]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  function validateStep(): boolean {
    setStepError(null);
    if (currentStep === 'items') {
      if (!submitter.name.trim()) {
        setStepError('ไม่พบชื่อผู้ยื่นคำขอ กรุณาเข้าสู่ระบบใหม่');
        return false;
      }
      if (!deliverer.name.trim()) {
        setStepError('กรุณาเลือกผู้นำส่ง');
        return false;
      }
      if (items.length === 0) {
        setStepError('ต้องมีตัวอย่างอย่างน้อย 1 รายการ');
        return false;
      }
      for (const it of items) {
        if (!it.sampleName.trim()) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณากรอกชื่อตัวอย่าง`);
          return false;
        }
        if (!it.batchNo.trim()) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณากรอกเลขแบช`);
          return false;
        }
      }
      const seen = new Set<string>();
      for (const it of items) {
        const key = it.batchNo.trim();
        if (seen.has(key)) {
          setStepError(`พบ batch ซ้ำ: ${key}`);
          return false;
        }
        seen.add(key);
      }
    }
    if (currentStep === 'plan') {
      if (!plan) {
        setStepError('ยังไม่มีข้อมูลใบวางแผน');
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep()) return;
    // skip step 4 if no qualifying batches
    if (currentStep === 'plan' && labBatches.length === 0) {
      void handleSubmit();
      return;
    }
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    setStepError(null);
    setStepIdx((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    if (!validateStep()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        dept: 'production' as const,
        submittedBy: {
          employeeId: submitter.employeeId || undefined,
          name: submitter.name,
        },
        deliveredBy: {
          employeeId: deliverer.employeeId || undefined,
          name: deliverer.name,
        },
        items: items.map((it, idx) => ({ ...it, seq: idx + 1 })),
        productionPlans: plan ? [plan] : [],
        labRequests: [],
        prodOrderNos: prodOrderNos ?? [],
        cause: '',
      };
      const created = await createPetition(payload);

      if (labBatches.length > 0 && labRequest) {
        try {
          await createLabRequest({ ...labRequest, petitionId: created._id });
        } catch (e) {
          setError(`สร้างใบคำขอรับบริการไม่สำเร็จ: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }
      navigate(`/petitions/${created._id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'บันทึกคำร้องไม่สำเร็จ';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/petitions/new')}>
            <ArrowLeft className="h-4 w-4" />
            กลับ
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-black-500">คำขอแผนกผลิต</h1>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {STEPS.map((s, i) => {
            const active = i === stepIdx;
            const done = i < stepIdx;
            const disabled =
              s.key === 'lab' && labBatches.length === 0 && stepIdx >= STEPS.length - 1;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  className={
                    active
                      ? 'font-semibold text-primary-500'
                      : done
                        ? 'text-grey-500'
                        : disabled
                          ? 'text-grey-300 line-through'
                          : 'text-grey-400'
                  }
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="text-grey-300">→</span>}
              </div>
            );
          })}
        </div>

        {stepError && (
          <div className="rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500">
            {stepError}
          </div>
        )}
        {error && (
          <div className="rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500 whitespace-pre-wrap">
            {error}
          </div>
        )}

        <Card>
          <CardContent className="p-4 md:p-5">
            {currentStep === 'items' && (
              <ItemsStep
                value={items}
                onChange={setItems}
                submitter={submitter}
                onSubmitterChange={setSubmitter}
                submitterReadOnly
                deliverer={deliverer}
                onDelivererChange={(v) => {
                  setDelivererTouched(true);
                  setDeliverer(v);
                }}
              />
            )}
            {currentStep === 'plan' && plan && (
              <ProductionPlanStep items={items} plan={plan} onChange={setPlanState} />
            )}
            {currentStep === 'lab' && labRequest && (
              <LabRequestStep
                items={labBatches}
                request={labRequest}
                onChange={setLabRequest}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3">
          <Button variant="ghost" onClick={goBack} disabled={stepIdx === 0 || submitting} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" />
            ย้อนกลับ
          </Button>
          <div className="flex flex-col sm:flex-row gap-2">
            {stepIdx < STEPS.length - 1 ? (
              <Button onClick={goNext} disabled={submitting} className="w-full sm:w-auto">
                {currentStep === 'plan' && labBatches.length === 0 ? (
                  <>
                    <Save className="h-4 w-4" />
                    บันทึก (ไม่มี batch ส่ง lab)
                  </>
                ) : (
                  <>
                    ถัดไป
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                <Save className="h-4 w-4" />
                {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
