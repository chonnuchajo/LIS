import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import PrintPreviewDialog from '@/components/lis/PrintPreviewDialog';
import { createPetition, createLabRequest } from '@/hooks/usePetition';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import {
  buildPetitionMasterItemOptions,
  findMatchingPetitionMasterItem,
  normalizeMasterItemPayload,
} from '@/lib/petitionMasterItem';
import { isLabBatch, type Petition } from '@/types/petition.types';

const ICP_LADDA_ADDRESS = '151 ม.8 ต.สามควายเผือก อ.เมืองนครปฐม จ.นครปฐม 73000';
const ICP_LADDA_COMPANY = 'ICP Ladda Co., LTD.';
const PRODUCTION_RETURN_URL = 'https://app-plant.icpladda.com/production-react/?tab=list';

type StepKey = 'items' | 'lab';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'items', label: '1. ผู้นำส่ง + รายการตัวอย่าง' },
  { key: 'lab', label: '2. ใบคำขอรับบริการ' },
];

interface ProductionPetitionNewPageProps {
  integrationMode?: boolean;
  publicMode?: boolean;
}

function makeBlankItem(seq: number): ItemRowValues {
  return {
    seq,
    itemNo: '',
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

export function objectToSearchParams(input: unknown): URLSearchParams {
  const params = new URLSearchParams();
  const append = (key: string, value: unknown) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') {
          Object.entries(item as Record<string, unknown>).forEach(([childKey, childValue]) =>
            append(`${key}[${index}][${childKey}]`, childValue),
          );
        } else {
          append(key, item);
        }
      });
      return;
    }
    if (typeof value === 'object') return;
    params.append(key, String(value));
  };

  if (input && typeof input === 'object') {
    Object.entries(input as Record<string, unknown>).forEach(([key, value]) => append(key, value));
  }
  return params;
}

export function buildProductionReturnUrl(searchParams: URLSearchParams, createdPetition?: Pick<Petition, 'petitionNo'> | null): string {
  const petitionNo = createdPetition?.petitionNo;
  const requestNo = getQueryValue(searchParams, ['requestNo', 'request_no', 'submissionNo']);
  const url = new URL(PRODUCTION_RETURN_URL);
  const requesterEmail = getQueryValue(searchParams, ['requesterEmail', 'requester_email', 'email']);
  if (requestNo) {
    url.searchParams.set('requestNo', requestNo);
    url.searchParams.set('request_no', requestNo);
  }
  if (petitionNo) {
    url.searchParams.set('lisPetitionNo', petitionNo);
    url.searchParams.set('petitionNo', petitionNo);
    url.searchParams.set('lisStatus', 'sent');
    url.searchParams.set('lisSent', '1');
  }
  if (requesterEmail) {
    url.searchParams.set('requesterEmail', requesterEmail);
    url.searchParams.set('requester_email', requesterEmail);
  }
  return url.toString();
}

export function isResearchAndDevelopmentDepartment(department?: string | null): boolean {
  return String(department || '').replace(/\s+/g, '').toLowerCase() === 'r&d';
}

export function requiresDeliveryAndBatch(department?: string | null): boolean {
  return !isResearchAndDevelopmentDepartment(department);
}

export function requiresMasterItemSelection({
  department,
  integrationMode,
}: {
  department?: string | null;
  integrationMode: boolean;
}): boolean {
  return !integrationMode && !isResearchAndDevelopmentDepartment(department);
}

export function hasRequiredLabRequestStep(
  department: string | null | undefined,
  items: Array<Pick<ItemRowValues, 'batchNo' | 'testItems'>>,
): boolean {
  if (isResearchAndDevelopmentDepartment(department)) return items.length > 0;
  return items.some((it) => it.batchNo && isLabBatch(it.batchNo));
}

function makeInitialItemFromQuery(searchParams: URLSearchParams): ItemRowValues | null {
  const sampleName = getQueryValue(searchParams, ['sampleName', 'itemName', 'productName']);
  const batchNo = getQueryValue(searchParams, ['batchNo', 'batch']);
  const lotNo = getQueryValue(searchParams, ['lotNo', 'lot']);
  const commonName = getQueryValue(searchParams, ['commonName', 'activeIngredient']);
  const productionDate = getQueryValue(searchParams, ['productionDate', 'requestDate', 'mfgDate']);
  const packageUnit = getQueryValue(searchParams, ['quantity', 'packageUnit', 'packSize']);
  const submissionNo = getQueryValue(searchParams, ['submissionNo', 'requestNo', 'request_no']);
  const testItems = getQueryValue(searchParams, ['testItems', 'tests', 'lab']);
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
    itemNo,
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

function makeQuantityLabel(qty: string, unit: string): string {
  return [qty, unit].filter(Boolean).join(' ');
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

export function makeInitialItemsFromQuery(searchParams: URLSearchParams): ItemRowValues[] {
  const singleItem = makeInitialItemFromQuery(searchParams);
  const sampleNames = getSampleOrQueryValues(searchParams, ['sampleName', 'itemName', 'productName'], { splitComma: true });
  const batchNos = getSampleOrQueryValues(searchParams, ['batchNo', 'batch'], { splitComma: true });
  const lotNos = getSampleOrQueryValues(searchParams, ['lotNo', 'lot'], { splitComma: true });
  const commonNames = getSampleOrQueryValues(searchParams, ['commonName', 'activeIngredient']);
  const productionDates = getSampleOrQueryValues(searchParams, ['productionDate', 'requestDate', 'mfgDate'], { splitComma: true });
  const packageUnits = getSampleOrQueryValues(searchParams, ['quantity', 'packageUnit', 'packSize', 'packsize']);
  const quantities = getSampleOrQueryValues(searchParams, ['qty', 'quantityValue', 'amount'], { splitComma: true });
  const quantityUnits = getSampleOrQueryValues(searchParams, ['unit', 'qtyUnit', 'quantityUnit'], { splitComma: true });
  const testItems = getSampleOrQueryValues(searchParams, ['testItems', 'tests', 'lab']);
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
    quantities.length,
    quantityUnits.length,
    testItems.length,
    notes.length,
    itemNos.length,
    mfNos.length,
    priorities.length,
  );

  if (itemCount <= 1) {
    if (!singleItem) return [];
    const productionDate = productionDates[0] || singleItem.productionDate || '';
    const submittedQuantity = quantities[0] ?? '';
    const submittedUnit = quantityUnits[0] ?? '';
    return [{
      ...singleItem,
      productionDate: productionDate || null,
      packageUnit: packageUnits[0] || singleItem.packageUnit,
      labelQuantity: makeQuantityLabel(submittedQuantity, submittedUnit),
      labelSampledDate: productionDate,
      submittedQuantity,
      submittedUnit,
    }];
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
      itemNo: valueAt(itemNos, i, false),
      sampleName: valueAt(sampleNames, i),
      batchNo: valueAt(batchNos, i, false),
      lotNo: valueAt(lotNos, i, false),
      commonName: valueAt(commonNames, i),
      productionDate: valueAt(productionDates, i) || null,
      packageUnit: valueAt(packageUnits, i),
      testItems: valueAt(testItems, i),
      note,
      labelQuantity: makeQuantityLabel(valueAt(quantities, i, false), valueAt(quantityUnits, i)),
      labelSampledDate: valueAt(productionDates, i),
      submittedQuantity: valueAt(quantities, i, false),
      submittedUnit: valueAt(quantityUnits, i),
    };

    if ([
      item.sampleName,
      item.batchNo,
      item.lotNo,
      item.commonName,
      item.productionDate,
      item.packageUnit,
      item.labelQuantity,
      item.labelSampledDate,
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

const LABEL_HEADER_LINE_1 = 'ป้ายนำส่งตัวอย่าง บริษัท ไอ ซี พี';
const LABEL_HEADER_LINE_2 = 'ลัดดา จำกัด';
const LABEL_HEADER_TEXT = `${LABEL_HEADER_LINE_1} ${LABEL_HEADER_LINE_2}`;
const DOCUMENT_NUMBER_LABEL = 'เลขที่';

function getQrValue(petition: Petition, item: Petition['items'][number]): string {
  return JSON.stringify({
    id: petition._id,
    petitionNo: petition.petitionNo,
    sampleId: item.sampleId || '',
    itemSeq: item.seq,
  });
}

function PreviewQrCode({
  value,
  sizeClass = 'h-32 w-32',
}: {
  value: string;
  sizeClass?: string;
}) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const modules = Array.from(qr.modules.data as Uint8Array);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`${sizeClass} shrink-0`}
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
        const sampledByName = petition.submittedBy?.name || item.labelSampledBy || '';
        return (
          <div
            key={item.seq}
            className="mx-auto w-full max-w-[760px] rounded-md border border-black bg-white p-4 font-semibold text-black shadow-sm"
            style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex shrink-0 flex-col items-center">
                <div className="border border-black bg-white p-1">
                  <PreviewQrCode value={getQrValue(petition, item)} />
                </div>
                <div className="mt-1 w-32 break-all text-center text-xs font-bold leading-tight">
                  {petition.petitionNo}
                </div>
                {item.batchNo ? (
                  <>
                    <PreviewQrCode value={item.batchNo} sizeClass="mt-1 h-14 w-14" />
                    <div className="mt-1 w-32 break-all text-center text-[10px] font-bold leading-tight">
                      {item.batchNo}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0 px-2 text-center text-[13px] font-bold leading-tight">
                    <span className="block whitespace-nowrap">{LABEL_HEADER_TEXT}</span>
                  </div>
                  <div className="flex items-end gap-1 whitespace-nowrap text-[11px]">
                    <span>{DOCUMENT_NUMBER_LABEL}</span>
                    <span className="inline-block min-w-[2.5rem] border-b border-black px-1 text-center">
                      {item.sampleId || '\u00a0'}
                    </span>
                    <span>/</span>
                    <span className="inline-block min-w-[1.25rem] border-b border-black px-1 text-center">
                      {yearShort}
                    </span>
                  </div>
                </div>
                <div className="text-sm">
                  <PreviewStackedField label="ชื่อผลิตภัณฑ์ และสารสำคัญ" value={productLine} />
                </div>
                <div className="text-sm">
                  <PreviewField label="วัน เดือน ปี ที่ผลิต/นำเข้า" value={toBuddhistShort(item.productionDate)} />
                </div>
                <div className="text-sm">
                  <PreviewField
                    label="Batch No."
                    value={item.batchNo}
                    valueClassName="text-xs leading-tight"
                    multiline
                  />
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <PreviewField label="ผู้ผลิต" value={item.labelManufacturer} />
                  <PreviewField label="ผู้ขาย" value={item.labelSeller} />
                </div>
                <div className="text-sm">
                  <PreviewField label="ปริมาณ" value={item.labelQuantity} />
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-[1.4fr_1fr]">
                  <PreviewField label="สุ่มโดย" value={sampledByName} />
                  <PreviewField label="ว/ด/ป" value={toBuddhistShort(item.labelSampledDate)} />
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <PreviewField label="หมายเหตุ" value={item.labelRemark} />
            </div>

            <div className="mt-3 text-[10px]">F-LAB-01-10 Rev : 01 01/04/67</div>
          </div>
        );
      })}
    </div>
  );
}

function PreviewField({
  label,
  value,
  valueClassName = '',
  multiline = false,
}: {
  label: string;
  value?: string;
  valueClassName?: string;
  multiline?: boolean;
}) {
  const valueBaseClass = multiline
    ? 'min-h-[1.25rem] min-w-0 flex-1 overflow-visible whitespace-normal break-words border-b border-black px-1 font-bold'
    : 'min-h-[1.25rem] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black px-1 font-bold';

  return (
    <div className="flex min-w-0 items-end gap-1">
      <span className="whitespace-nowrap">{label}</span>
      <span className={`${valueBaseClass} ${valueClassName}`}>
        {value || ''}
      </span>
    </div>
  );
}

function PreviewStackedField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <div className="whitespace-nowrap">{label}</div>
      <div className="min-h-[1.25rem] min-w-0 overflow-visible whitespace-normal break-words border-b border-black px-1 font-bold leading-tight">
        {value || ''}
      </div>
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
      uncertaintyValue: '',
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
  const integrationToken = searchParams.get('integrationToken');
  const [postedSearchParams, setPostedSearchParams] = useState<URLSearchParams | null>(null);
  const effectiveSearchParams = postedSearchParams ?? searchParams;
  const { user } = useAuth();
  const prodOrderNosFromState = (location.state as { prodOrderNos?: string[] } | null)?.prodOrderNos;

  useEffect(() => {
    if (!integrationToken) return;
    let alive = true;
    api.get<unknown>(`/production-integration/petitions/${encodeURIComponent(integrationToken)}`)
      .then((res) => {
        if (alive) setPostedSearchParams(objectToSearchParams(res.data.data));
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'โหลดข้อมูลจาก Production ไม่สำเร็จ');
      });
    return () => { alive = false; };
  }, [integrationToken]);

  const prodOrderNosFromQuery = useMemo(() => {
    const plural = getQueryValues(effectiveSearchParams, ['prodOrderNos'], { splitComma: true });
    const singular = getQueryValues(effectiveSearchParams, ['prodOrderNo'], { splitComma: true });
    const mfNo = getSampleOrQueryValues(effectiveSearchParams, ['mfNo'], { splitComma: true });
    return [...plural, ...singular, ...mfNo];
  }, [effectiveSearchParams]);
  const prodOrderNos = prodOrderNosFromState?.length ? prodOrderNosFromState : prodOrderNosFromQuery;
  const productionRequestNo = getQueryValue(effectiveSearchParams, ['requestNo', 'request_no', 'submissionNo']);
  const productionRequesterEmail = getQueryValue(effectiveSearchParams, ['requesterEmail', 'requester_email', 'email']);
  const initialQueryItems = useMemo(() => makeInitialItemsFromQuery(effectiveSearchParams), [effectiveSearchParams]);
  const integrationActor = useMemo(() => {
    const department = getQueryValue(effectiveSearchParams, ['department']);
    const requesterName = getQueryValue(effectiveSearchParams, ['requesterName', 'submittedBy', 'submitterName', 'employeeName']);
    const requesterEmail = getQueryValue(effectiveSearchParams, ['requesterEmail', 'requester_email', 'email', 'requesterMail', 'mail']);
    const requestNo = getQueryValue(effectiveSearchParams, ['requestNo', 'request_no']);
    const mfNo = getQueryValue(effectiveSearchParams, ['mfNo']);
    const ref = requestNo || mfNo;
    return {
      employeeId: ref || 'production-system',
      name: requesterName || (department ? `Production System (${department})` : 'Production System'),
      department,
      email: requesterEmail,
    };
  }, [effectiveSearchParams]);
  const submitterDepartment = integrationMode
    ? integrationActor.department
    : user?.department;
  const deliveryAndBatchRequired = requiresDeliveryAndBatch(submitterDepartment);
  const masterItemSelectionRequired = requiresMasterItemSelection({
    department: submitterDepartment,
    integrationMode,
  });
  const revisionOfId = searchParams.get('revisionOf');
  const [revisionSource, setRevisionSource] = useState<Petition | null>(null);
  const {
    data: masterItemRows = [],
    isLoading: masterItemsLoading,
    isError: masterItemsError,
  } = useQuery({
    queryKey: ['master-items-for-petition-new'],
    queryFn: async () => {
      const res = await api.get<unknown>('/master-items');
      return normalizeMasterItemPayload(res.data.data);
    },
  });
  const masterItemOptions = useMemo(
    () => buildPetitionMasterItemOptions(masterItemRows),
    [masterItemRows],
  );

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

  useEffect(() => {
    if (initialQueryItems.length) setItems(initialQueryItems);
  }, [initialQueryItems]);

  // Pre-fill from a rejected predecessor when ?revisionOf=<id> is present
  useEffect(() => {
    if (!revisionOfId) return;
    let alive = true;
    api.getPetition(revisionOfId)
      .then((source) => {
        if (!alive) return;
        if (source.status !== 'rejected') {
          toast.error('คำร้องต้นทางไม่ได้ถูกส่งกลับให้แก้ไข');
          navigate('/petition');
          return;
        }
        if (
          user?.employeeId &&
          source.submittedBy?.employeeId &&
          user.employeeId !== source.submittedBy.employeeId
        ) {
          toast.error('คุณไม่ใช่ผู้ยื่นของคำร้องต้นทาง');
          navigate('/petition');
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
      })
      .catch(() => {
        if (alive) {
          toast.error('โหลดคำร้องต้นทางไม่สำเร็จ');
          navigate('/petition');
        }
      });
    return () => { alive = false; };
  }, [revisionOfId, navigate, user?.employeeId]);

  const labBatches = useMemo(
    () => (
      isResearchAndDevelopmentDepartment(submitterDepartment)
        ? items
        : items.filter((it) => it.batchNo && isLabBatch(it.batchNo))
    ),
    [items, submitterDepartment],
  );

  const [labRequest, setLabRequest] = useState<LabRequestRowValues | null>(null);

  // sync labRequest with items
  useEffect(() => {
    const labItems = isResearchAndDevelopmentDepartment(submitterDepartment)
      ? items
      : items.filter((it) => it.batchNo && isLabBatch(it.batchNo));
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
  const [labelPrintOpen, setLabelPrintOpen] = useState(false);

  function validateStep(): boolean {
    setStepError(null);
    if (currentStep === 'items') {
      if (!submitter.name.trim()) {
        setStepError('ไม่พบชื่อผู้ยื่นคำขอ กรุณาเข้าสู่ระบบใหม่');
        return false;
      }
      if (deliveryAndBatchRequired && !deliverer.name.trim()) {
        setStepError('กรุณาเลือกผู้นำส่ง');
        return false;
      }
      if (items.length === 0) {
        setStepError('ต้องมีตัวอย่างอย่างน้อย 1 รายการ');
        return false;
      }
      if (masterItemSelectionRequired && masterItemsLoading) {
        setStepError('กำลังโหลด Master Item กรุณารอสักครู่');
        return false;
      }
      if (masterItemSelectionRequired && (masterItemsError || masterItemOptions.length === 0)) {
        setStepError('โหลด Master Item ไม่สำเร็จ กรุณาลองใหม่');
        return false;
      }
      for (const it of items) {
        if (!it.sampleName.trim()) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณากรอกชื่อตัวอย่าง`);
          return false;
        }
        if (masterItemSelectionRequired && !findMatchingPetitionMasterItem(masterItemOptions, it)) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณาเลือกชื่อตัวอย่างจาก Master Item`);
          return false;
        }
        if (deliveryAndBatchRequired && !it.batchNo.trim()) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณากรอกเลขแบช`);
          return false;
        }
        if (!it.commonName.trim()) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณากรอกชื่อสามัญ`);
          return false;
        }
        if (!it.productionDate) {
          setStepError(`ตัวอย่างลำดับ ${it.seq}: กรุณาเลือกวันผลิต/วันที่รับเข้า`);
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
        if (!key) continue;
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
    // items เป็น step ก่อน lab; ถ้าไม่มี batch ส่ง lab ให้บันทึกเลย
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
        items: items.map((it, idx) => ({ ...it, seq: idx + 1 })),
        labRequests: [],
        prodOrderNos,
        productionWorkflow: productionRequestNo ? {
          requestNo: productionRequestNo,
          requesterEmail: productionRequesterEmail || undefined,
        } : undefined,
        cause: '',
        revisionOf: revisionOfId || undefined,
      };
      if (deliveryAndBatchRequired) {
        Object.assign(payload, {
          deliveredBy: {
            employeeId: deliverer.employeeId || undefined,
            name: deliverer.name,
          },
        });
      }
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
      navigate(`/petition/${created._id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'บันทึกคำร้องไม่สำเร็จ';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePageBack() {
    if (publicMode) {
      window.location.href = buildProductionReturnUrl(effectiveSearchParams, createdPetition);
      return;
    }
    navigate('/petition');
  }

  function printCreatedLabels() {
    if (!createdPetition) return;
    setLabelPrintOpen(true);
  }

  const successContent = createdPetition ? (
    <div className="space-y-4">
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

      <PrintPreviewDialog
        open={labelPrintOpen}
        onOpenChange={setLabelPrintOpen}
        docType="sample-label"
      >
        <SampleLabelPrintTemplate petition={createdPetition} />
      </PrintPreviewDialog>
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
                requireDeliveryAndBatch={deliveryAndBatchRequired}
                itemsReadOnly={integrationMode}
                allowManualItemFields={!masterItemSelectionRequired}
                masterItemOptions={masterItemOptions}
                masterItemsLoading={masterItemsLoading}
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
