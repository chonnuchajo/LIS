import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, ArrowRight, CheckCircle2, Factory, Printer, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/lis/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/lis/PageHeader';
import ItemsStep, { type ItemRowValues } from '@/components/petition/wizard/ItemsStep';
import type { SubmitterValues } from '@/components/petition/wizard/SubmitterPicker';
import LabRequestStep, { type LabRequestRowValues } from '@/components/petition/wizard/LabRequestStep';
import SampleLabelPrintTemplate from '@/components/petition/SampleLabelPrintTemplate';
import {
  isLabBatch,
  makeBlankProductionPlan,
  type ProductionPlan,
} from '@/types/productionPlan.types';
import { createPetition, createLabRequest } from '@/hooks/usePetition';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { Petition, ProductionPetition } from '@/types/petition.types';

const ICP_LADDA_ADDRESS = '151 ม.8 ต.สามควายเผือก อ.เมืองนครปฐม จ.นครปฐม 73000';
const ICP_LADDA_COMPANY = 'ICP Ladda Co., LTD.';
const PRODUCTION_RETURN_URL = 'https://app-plant.icpladda.com/production/public/sample_analysis.php?status=&q=';

type StepKey = 'items' | 'plan' | 'lab';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'items', label: '1. ผู้นำส่ง + รายการตัวอย่าง' },
  // 'plan' (ใบวางแผน-ควบคุมการผลิต) ซ่อนจาก wizard — เลิกใช้แล้ว รอลบ (ดู docs/handoff/production-plan-form.md)
  // ยังคง state `plan` + auto-sync ไว้เพื่อส่ง productionPlans เงียบๆ ให้ backend validation ผ่าน
  { key: 'lab', label: '2. ใบคำขอรับบริการ' },
];

interface ProductionPetitionNewPageProps {
  integrationMode?: boolean;
  publicMode?: boolean;
}

function makeBlankItem(seq: number): ItemRowValues {
  return {
    seq,
    sampleName: '',
    commonName: '',
    batchNo: '',
    lotNo: '',
    productionDate: null,
    packageUnit: '',
    submissionNo: '',
    testUnit: '',
    testItems: '',
    note: '',
  };
}

function getQueryValue(searchParams: URLSearchParams, keys: string[]): string {
  for (const key of keys) {
    const value = searchParams.get(key)?.trim();
    if (value) return value;
  }
  return '';
}

function makeInitialItemFromQuery(searchParams: URLSearchParams): ItemRowValues | null {
  const sampleName = getQueryValue(searchParams, ['sampleName', 'itemName', 'productName']);
  const batchNo = getQueryValue(searchParams, ['batchNo', 'batch']);
  const lotNo = getQueryValue(searchParams, ['lotNo', 'lot']);
  const commonName = getQueryValue(searchParams, ['commonName', 'activeIngredient']);
  const productionDate = getQueryValue(searchParams, ['productionDate', 'requestDate', 'mfgDate']);
  const packageUnit = getQueryValue(searchParams, ['quantity', 'packageUnit', 'packSize']);
  const submissionNo = getQueryValue(searchParams, ['submissionNo', 'requestNo']);
  const testItems = getQueryValue(searchParams, ['testItems', 'tests']);
  const itemNo = getQueryValue(searchParams, ['itemNo']);
  const mfNo = getQueryValue(searchParams, ['mfNo']);
  const priority = getQueryValue(searchParams, ['priority']);
  const note = [
    getQueryValue(searchParams, ['note']),
    itemNo ? `Item: ${itemNo}` : '',
    mfNo ? `MF: ${mfNo}` : '',
    priority ? `Priority: ${priority}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  if (![sampleName, batchNo, lotNo, commonName, productionDate, packageUnit, submissionNo, testItems, note].some(Boolean)) {
    return null;
  }

  return {
    ...makeBlankItem(1),
    sampleName,
    batchNo,
    lotNo,
    commonName,
    productionDate: productionDate || null,
    packageUnit,
    // submissionNo เว้นว่าง — backend จะเซ็ต = เลขคำขออัตโนมัติตอนบันทึก
    testItems,
    note,
  };
}

function splitQueryList(value: string, splitComma = false): string[] {
  const delimiter = splitComma ? /[,\n|;]+/ : /[\n|;]+/;
  return value
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getQueryValues(
  searchParams: URLSearchParams,
  keys: string[],
  options: { splitComma?: boolean } = {},
): string[] {
  const values: Array<{ index: number; value: string }> = [];
  const lowerKeys = keys.map((key) => key.toLowerCase());

  for (const key of keys) {
    for (const value of searchParams.getAll(key)) {
      for (const item of splitQueryList(value, options.splitComma)) {
        values.push({ index: values.length, value: item });
      }
    }
  }

  for (const [rawKey, rawValue] of searchParams.entries()) {
    const key = rawKey.toLowerCase();
    for (const base of lowerKeys) {
      const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = key.match(new RegExp(`^${escaped}(?:\\[(\\d+)\\]|_(\\d+)|(\\d+))$`));
      if (!match) continue;
      const index = Number(match[1] ?? match[2] ?? match[3]);
      for (const item of splitQueryList(rawValue, options.splitComma)) {
        values.push({ index, value: item });
      }
    }
  }

  return values
    .sort((a, b) => a.index - b.index)
    .map((item) => item.value);
}

function valueAt(values: string[], index: number, fallbackToFirst = true): string {
  return values[index] ?? (fallbackToFirst ? values[0] : '') ?? '';
}

function getNestedSampleValues(
  searchParams: URLSearchParams,
  keys: string[],
  options: { splitComma?: boolean } = {},
): string[] {
  const values: Array<{ index: number; value: string }> = [];
  const lowerKeys = keys.map((key) => key.toLowerCase());

  for (const [rawKey, rawValue] of searchParams.entries()) {
    const match = rawKey.toLowerCase().match(/^samples\[(\d+)\]\[([^\]]+)\]$/);
    if (!match || !lowerKeys.includes(match[2])) continue;
    const index = Number(match[1]);
    for (const item of splitQueryList(rawValue, options.splitComma)) {
      values.push({ index, value: item });
    }
  }

  return values
    .sort((a, b) => a.index - b.index)
    .map((item) => item.value);
}

function getSampleOrQueryValues(
  searchParams: URLSearchParams,
  keys: string[],
  options: { splitComma?: boolean } = {},
): string[] {
  const nested = getNestedSampleValues(searchParams, keys, options);
  return nested.length ? nested : getQueryValues(searchParams, keys, options);
}

function makeInitialItemsFromQuery(searchParams: URLSearchParams): ItemRowValues[] {
  const singleItem = makeInitialItemFromQuery(searchParams);
  const sampleNames = getSampleOrQueryValues(searchParams, ['sampleName', 'itemName', 'productName'], { splitComma: true });
  const batchNos = getSampleOrQueryValues(searchParams, ['batchNo', 'batch'], { splitComma: true });
  const lotNos = getSampleOrQueryValues(searchParams, ['lotNo', 'lot'], { splitComma: true });
  const commonNames = getSampleOrQueryValues(searchParams, ['commonName', 'activeIngredient']);
  const productionDates = getSampleOrQueryValues(searchParams, ['productionDate', 'requestDate', 'mfgDate'], { splitComma: true });
  const packageUnits = getSampleOrQueryValues(searchParams, ['quantity', 'packageUnit', 'packSize', 'packsize']);
  const testItems = getSampleOrQueryValues(searchParams, ['testItems', 'tests']);
  const notes = getSampleOrQueryValues(searchParams, ['note']);
  const itemNos = getSampleOrQueryValues(searchParams, ['itemNo'], { splitComma: true });
  const mfNos = getSampleOrQueryValues(searchParams, ['mfNo'], { splitComma: true });
  const priorities = getSampleOrQueryValues(searchParams, ['priority'], { splitComma: true });

  const itemCount = Math.max(
    sampleNames.length,
    batchNos.length,
    lotNos.length,
    commonNames.length,
    productionDates.length,
    packageUnits.length,
    testItems.length,
    notes.length,
    itemNos.length,
    mfNos.length,
    priorities.length,
  );

  if (itemCount <= 1) {
    if (!singleItem) return [];
    return [{ ...singleItem, packageUnit: packageUnits[0] || singleItem.packageUnit }];
  }

  const items: ItemRowValues[] = [];
  for (let i = 0; i < itemCount; i += 1) {
    const note = [
      valueAt(notes, i),
      valueAt(itemNos, i, false) ? `Item: ${valueAt(itemNos, i, false)}` : '',
      valueAt(mfNos, i) ? `MF: ${valueAt(mfNos, i)}` : '',
      valueAt(priorities, i) ? `Priority: ${valueAt(priorities, i)}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const item = {
      ...makeBlankItem(i + 1),
      sampleName: valueAt(sampleNames, i),
      batchNo: valueAt(batchNos, i, false),
      lotNo: valueAt(lotNos, i, false),
      commonName: valueAt(commonNames, i),
      productionDate: valueAt(productionDates, i) || null,
      packageUnit: valueAt(packageUnits, i),
      testItems: valueAt(testItems, i),
      note,
    };

    if ([
      item.sampleName,
      item.batchNo,
      item.lotNo,
      item.commonName,
      item.productionDate,
      item.packageUnit,
      item.testItems,
      item.note,
    ].some(Boolean)) {
      items.push(item);
    }
  }

  return items;
}

function toBuddhistShort(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

function currentBuddhistYearShort(): string {
  return String((new Date().getFullYear() + 543) % 100).padStart(2, '0');
}

function getQrValue(petition: Petition, item: Petition['items'][number]): string {
  return JSON.stringify({
    id: petition._id,
    petitionNo: petition.petitionNo,
    sampleId: item.sampleId || '',
    itemSeq: item.seq,
  });
}

function PreviewQrCode({ value }: { value: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const modules = Array.from(qr.modules.data as Uint8Array);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-20 w-20 shrink-0"
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

function LabelPreview({ petition }: { petition: Petition }) {
  const yearShort = currentBuddhistYearShort();

  return (
    <div className="space-y-3">
      {petition.items.map((item) => {
        const productLine = [item.sampleName, item.commonName].filter(Boolean).join(' ');
        return (
          <div
            key={item.seq}
            className="mx-auto w-full max-w-[760px] rounded-md border border-black bg-white p-4 text-black shadow-sm"
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="shrink-0 border border-black bg-white p-1">
                <PreviewQrCode value={getQrValue(petition, item)} />
              </div>
              <div className="flex-1 text-center text-sm font-semibold">
                ป้ายนำส่งตัวอย่าง บริษัท ไอ ซี พี ลัดดา จำกัด
              </div>
              <div className="flex items-end gap-1 whitespace-nowrap text-sm">
                <span>เลขที่</span>
                <span className="inline-block min-w-[4rem] border-b border-black px-1 text-center">
                  {item.sampleId || '\u00a0'}
                </span>
                <span>/</span>
                <span className="inline-block min-w-[2rem] border-b border-black px-1 text-center">
                  {yearShort}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <PreviewField label="ชื่อผลิตภัณฑ์ และสารสำคัญ" value={productLine} />
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewField label="วัน เดือน ปี ที่ผลิต/นำเข้า" value={toBuddhistShort(item.productionDate)} />
                <PreviewField label="แบชนัมเบอร์" value={item.batchNo} />
              </div>
              <PreviewField label="ผู้ผลิต" value={item.labelManufacturer} />
              <PreviewField label="ผู้ขาย" value={item.labelSeller} />
              <div className="grid gap-3 sm:grid-cols-3">
                <PreviewField label="ปริมาณ" value={item.labelQuantity} />
                <PreviewField label="สุ่มโดย" value={item.labelSampledBy} />
                <PreviewField label="ว/ด/ป" value={toBuddhistShort(item.labelSampledDate)} />
              </div>
              <PreviewField label="หมายเหตุ" value={item.labelRemark} />
            </div>

            <div className="mt-3 text-[10px]">F-LAB-01-10 Rev : 01 01/04/67</div>
          </div>
        );
      })}
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-end gap-1">
      <span className="whitespace-nowrap">{label}</span>
      <span className="min-h-[1.25rem] flex-1 border-b border-black px-1">{value || ''}</span>
    </div>
  );
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

export default function ProductionPetitionNewPage({
  integrationMode = false,
  publicMode = false,
}: ProductionPetitionNewPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const prodOrderNosFromState = (location.state as { prodOrderNos?: string[] } | null)?.prodOrderNos;
  const prodOrderNosFromQuery = useMemo(() => {
    const plural = getQueryValues(searchParams, ['prodOrderNos'], { splitComma: true });
    const singular = getQueryValues(searchParams, ['prodOrderNo'], { splitComma: true });
    const mfNo = getSampleOrQueryValues(searchParams, ['mfNo'], { splitComma: true });
    return [...plural, ...singular, ...mfNo];
  }, [searchParams]);
  const prodOrderNos = prodOrderNosFromState?.length ? prodOrderNosFromState : prodOrderNosFromQuery;
  const initialQueryItems = useMemo(() => makeInitialItemsFromQuery(searchParams), [searchParams]);
  const integrationActor = useMemo(() => {
    const department = getQueryValue(searchParams, ['department']);
    const requesterName = getQueryValue(searchParams, ['requesterName', 'submittedBy', 'submitterName', 'employeeName']);
    const requesterEmail = getQueryValue(searchParams, ['requesterEmail', 'email', 'requesterMail', 'mail']);
    const requestNo = getQueryValue(searchParams, ['requestNo']);
    const mfNo = getQueryValue(searchParams, ['mfNo']);
    const ref = requestNo || mfNo;
    return {
      employeeId: ref || 'production-system',
      name: requesterName || (department ? `Production System (${department})` : 'Production System'),
      department,
      email: requesterEmail,
    };
  }, [searchParams]);
  const submitterDepartment = integrationMode
    ? integrationActor.department
    : user?.department;
  const revisionOfId = searchParams.get('revisionOf');
  const [revisionSource, setRevisionSource] = useState<Petition | null>(null);

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = STEPS[stepIdx].key;

  const [submitter, setSubmitter] = useState<SubmitterValues>({
    employeeId: integrationMode ? integrationActor.employeeId : (user?.id ?? ''),
    name: integrationMode ? integrationActor.name : (user?.name ?? ''),
  });
  // ผู้นำส่ง = required ต้องเลือกเอง ไม่ default เป็นผู้ล็อกอิน (integration เท่านั้นที่ตั้งค่าให้)
  const [deliverer, setDeliverer] = useState<SubmitterValues>({
    employeeId: integrationMode ? integrationActor.employeeId : '',
    name: integrationMode ? integrationActor.name : '',
  });
  const [delivererTouched, setDelivererTouched] = useState(false);

  // Re-sync submitter when user auth resolves (read-only — always match logged-in user)
  useEffect(() => {
    if (integrationMode) {
      setSubmitter(integrationActor);
      if (!delivererTouched) {
        setDeliverer(integrationActor);
      }
    } else if (user?.name) {
      setSubmitter({ employeeId: user.id ?? '', name: user.name });
    }
  }, [user?.id, user?.name, delivererTouched, integrationMode, integrationActor]);

  const [items, setItems] = useState<ItemRowValues[]>(() =>
    initialQueryItems.length ? initialQueryItems : [makeBlankItem(1)],
  );

  const [plan, setPlanState] = useState<ProductionPlan | null>(null);

  // Pre-fill from a rejected predecessor when ?revisionOf=<id> is present
  useEffect(() => {
    if (!revisionOfId) return;
    let alive = true;
    api.getPetition(revisionOfId)
      .then((source) => {
        if (!alive) return;
        if (source.status !== 'rejected') {
          toast.error('คำร้องต้นทางไม่ได้ถูกส่งกลับให้แก้ไข');
          navigate('/petitions');
          return;
        }
        if (
          user?.employeeId &&
          source.submittedBy?.employeeId &&
          user.employeeId !== source.submittedBy.employeeId
        ) {
          toast.error('คุณไม่ใช่ผู้ยื่นของคำร้องต้นทาง');
          navigate('/petitions');
          return;
        }
        setRevisionSource(source);
        // Pre-fill items (strip sampleId so backend regenerates)
        setItems(
          source.items.map((it, idx) => ({
            seq: idx + 1,
            sampleName: it.sampleName ?? '',
            commonName: it.commonName ?? '',
            batchNo: it.batchNo ?? '',
            lotNo: it.lotNo ?? '',
            productionDate: it.productionDate ?? null,
            packageUnit: it.packageUnit ?? '',
            submissionNo: it.submissionNo ?? '',
            testUnit: it.testUnit ?? '',
            testItems: it.testItems ?? '',
            note: it.note ?? '',
          })),
        );
        if (source.dept === 'production') {
          const plans = (source as ProductionPetition).productionPlans ?? [];
          if (plans.length > 0) setPlanState(plans[0]);
        }
      })
      .catch(() => {
        if (alive) {
          toast.error('โหลดคำร้องต้นทางไม่สำเร็จ');
          navigate('/petitions');
        }
      });
    return () => { alive = false; };
  }, [revisionOfId, navigate, user?.employeeId]);

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
            submitter.name,
            integrationMode ? integrationActor.email : (user?.email ?? ''),
            submitterDepartment ?? 'ผลิต',
          );
        }
        return prev;
      });
    } else {
      setLabRequest(null);
    }
  }, [items, submitter.name, submitterDepartment, user?.email, integrationMode, integrationActor.email]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [createdPetition, setCreatedPetition] = useState<Petition | null>(null);

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
        if (!it.lotNo.trim()) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณากรอกเลข lot`);
          return false;
        }
        if (!it.commonName.trim()) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณากรอกชื่อสามัญ`);
          return false;
        }
        if (!it.productionDate) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณาเลือกวันผลิต`);
          return false;
        }
        if (!it.packageUnit.trim()) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณากรอกขนาดบรรจุ`);
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
    return true;
  }

  function goNext() {
    if (!validateStep()) return;
    // ใบวางแผนถูกซ่อน — items เป็น step ก่อน lab; ถ้าไม่มี batch ส่ง lab ให้บันทึกเลย
    if (currentStep === 'items' && labBatches.length === 0) {
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
          department: submitterDepartment || undefined,
        },
        deliveredBy: {
          employeeId: deliverer.employeeId || undefined,
          name: deliverer.name,
        },
        items: items.map((it, idx) => ({ ...it, seq: idx + 1 })),
        productionPlans: plan ? [plan] : [],
        labRequests: [],
        prodOrderNos,
        cause: '',
        revisionOf: revisionOfId || undefined,
      };
      const created = await createPetition(payload as Parameters<typeof createPetition>[0]);

      if (labBatches.length > 0 && labRequest) {
        try {
          await createLabRequest({ ...labRequest, petitionId: created._id });
        } catch (e) {
          setError(`สร้างใบคำขอรับบริการไม่สำเร็จ: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }
      if (publicMode) {
        setCreatedPetition(created);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      navigate(`/petitions/${created._id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'บันทึกคำร้องไม่สำเร็จ';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePageBack() {
    if (publicMode) {
      window.location.href = PRODUCTION_RETURN_URL;
      return;
    }
    navigate('/petitions');
  }

  function printCreatedLabels() {
    if (!createdPetition) return;
    setTimeout(() => window.print(), 50);
  }

  const successContent = createdPetition ? (
    <div className="space-y-4">
      <div className="hidden print:block">
        <SampleLabelPrintTemplate petition={createdPetition} />
      </div>

      <div className="print:hidden space-y-4">
        <PageHeader title="บันทึกคำขอสำเร็จ" onBack={handlePageBack} />

        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">สร้างคำขอเรียบร้อย</h2>
                  <p className="text-sm text-muted-foreground">
                    เลขที่คำขอ: <span className="font-semibold text-foreground">{createdPetition.petitionNo}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    จำนวนสติกเกอร์: {createdPetition.items.length} รายการ
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={printCreatedLabels} className="w-full sm:w-auto">
                  <Printer className="h-4 w-4" />
                  พิมพ์สติกเกอร์
                </Button>
                <Button variant="primary-outline" onClick={handlePageBack} className="w-full sm:w-auto">
                  กลับ Production System
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Preview สติกเกอร์</h2>
              <p className="text-sm text-muted-foreground">แสดงตัวอย่างบนหน้าเว็บก่อนสั่งพิมพ์จริง</p>
            </div>
            <LabelPreview petition={createdPetition} />
          </CardContent>
        </Card>
      </div>
    </div>
  ) : null;

  const content = (
      <div className="space-y-4">
        <PageHeader title={integrationMode ? 'Production System Request' : 'คำขอแผนกผลิต'} onBack={handlePageBack} />

        {integrationMode && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <Factory className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div className="space-y-1 text-sm text-blue-900">
                <p className="font-medium">Created from Production System</p>
                {prodOrderNos.length > 0 && (
                  <p>
                    Production order: <span className="font-semibold">{prodOrderNos.join(', ')}</span>
                  </p>
                )}
                <p className="text-blue-800">Please review the imported sample data before saving.</p>
              </div>
            </div>
          </div>
        )}

        {revisionSource && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-sm text-orange-800">
              ยื่นแก้ไขจากคำร้อง{' '}
              <span className="font-semibold">{revisionSource.petitionNo}</span>
            </p>
          </div>
        )}


        {/* Stepper — ซ่อน step ใบคำขอรับบริการเมื่อไม่มี batch ลงท้าย 1/6 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {STEPS.filter((s) => s.key !== 'lab' || labBatches.length > 0).map((s, i, arr) => {
            const active = i === stepIdx;
            const done = i < stepIdx;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  className={
                    active
                      ? 'font-semibold text-primary-500'
                      : done
                        ? 'text-grey-500'
                        : 'text-grey-400'
                  }
                >
                  {s.label}
                </span>
                {i < arr.length - 1 && <span className="text-grey-300">→</span>}
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
                submitterDepartment={submitterDepartment}
                deliverer={deliverer}
                onDelivererChange={(v) => {
                  setDelivererTouched(true);
                  setDeliverer(v);
                }}
                itemsReadOnly={integrationMode}
              />
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
                {currentStep === 'items' && labBatches.length === 0 ? (
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
  );

  if (publicMode) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">{successContent ?? content}</div>
      </div>
    );
  }

  return <AppLayout>{content}</AppLayout>;
}
