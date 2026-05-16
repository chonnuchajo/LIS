import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NativeSelect } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { petitionFormSchema, type PetitionFormValues } from '@/lib/validations';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  defaultValues?: Partial<PetitionFormValues>;
  onSubmit: (values: PetitionFormValues) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
}

const emptyItem: PetitionFormValues['items'][number] = {
  seq: 1,
  sampleName: '',
  commonName: '',
  batchNo: '',
  productionDate: null,
  submissionNo: '',
  packageUnit: '',
  testUnit: '',
  testItems: '',
  note: '',
  labelManufacturer: '',
  labelSeller: '',
  labelQuantity: '',
  labelSampledBy: '',
  labelSampledDate: '',
  labelRemark: '',
};

const MF_LOT_API_URLS = [
  { source: 'LDI', url: 'https://n8n-plant.icpladda.com/webhook/API/findlot-ldi' },
  { source: 'MF', url: 'https://n8n-plant.icpladda.com/webhook/API/findlot' },
] as const;
const EMPLOYEE_API_URL = 'https://n8n-plant.icpladda.com/webhook/api/employee';

const ICP_LADDA_COMPANY = 'ICP Ladda Co., LTD.';
const ICP_INTERTRADE_COMPANY = 'ICP Ladda Intertrade Co., LTD.';
const ICP_LADDA_ADDRESS = '151 ม.8 ต.สามควายเผือก อ.เมืองนครปฐม จ.นครปฐม 73000';
const ICP_INTERTRADE_ADDRESS = '28 ม.8 ต.สามควายเผือก อ.เมืองนครปฐม จ.นครปฐม 73000';

interface MfLotOption {
  id: string;
  source: string;
  label: string;
  sampleName: string;
  batchNo: string;
  productionDate: string | null;
  packageUnit: string;
  commonName: string;
  note: string;
}

interface EmployeeOption {
  id: string;
  label: string;
  name: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rowsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(asRecord);
  const obj = asRecord(payload);
  for (const key of ['value', 'data', 'items', 'rows', 'result']) {
    if (Array.isArray(obj[key])) return (obj[key] as unknown[]).map(asRecord);
  }
  return Object.keys(obj).length ? [obj] : [];
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeDate(value: string): string | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return null;
}

function normalizeLotOptions(payload: unknown, source: string): MfLotOption[] {
  return rowsFromPayload(payload)
    .map((row, idx) => {
      const productName = pickString(row, [
        'prod_descript',
        'product_name',
        'item_name',
        'trade_name',
        'name',
        'description',
        'prod_descript2',
      ]);
      const packsize = pickString(row, ['packsize', 'packageUnit', 'package_unit', 'uom_code']);
      const commonName = pickString(row, ['common_name', 'commonName', 'active_ingredient']);
      const sampleName = [productName, packsize, commonName].filter(Boolean).join(' · ');
      const batchNo = pickString(row, [
        'lot_no',
        'lotNo',
        'lot',
        'LOT_NO',
        'batch_no',
        'batchNo',
        'batch',
      ]);
      const productionDate = normalizeDate(
        pickString(row, ['productionDate', 'production_date', 'mfg_date', 'manufacture_date', 'create_date']),
      );
      const itemNo = pickString(row, ['item_no', 'itemNo', 'code', 'short_dm1_code']);
      const labelParts = [sampleName, batchNo ? `Lot ${batchNo}` : '', itemNo ? `Item ${itemNo}` : ''];

      return {
        id: `${source}-${batchNo || itemNo || idx}`,
        source,
        label: `[${source}] ${labelParts.filter(Boolean).join(' | ')}`,
        sampleName,
        batchNo,
        productionDate,
        packageUnit: packsize,
        commonName,
        note: itemNo ? `${source}: ${itemNo}` : source,
      };
    })
    .filter((option) => option.sampleName);
}

function normalizeEmployeeOptions(payload: unknown): EmployeeOption[] {
  return rowsFromPayload(payload)
    .map((row, idx) => {
      const employeeId = pickString(row, ['employee_id', 'employeeId', 'code', 'id']);
      const name = pickString(row, ['name', 'employee_name', 'fullName']);
      const department = pickString(row, ['department', 'department_name']);
      const position = pickString(row, ['position']);
      const detail = [employeeId, department, position].filter(Boolean).join(' | ');
      return {
        id: employeeId || String(idx),
        label: detail ? `${name} (${detail})` : name,
        name,
      };
    })
    .filter((option) => option.name);
}

const FIELD_LABELS = {
  fullName: 'ชื่อ-นามสกุล',
  department: 'แผนก',
  address: 'ที่อยู่',
  phone: 'เบอร์โทรศัพท์',
  email: 'อีเมล',
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-black-500 block mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function ErrorMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

function getCompanyAddress(companyName?: string): string {
  return companyName === ICP_INTERTRADE_COMPANY ? ICP_INTERTRADE_ADDRESS : ICP_LADDA_ADDRESS;
}

function RadioOption({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-black-500">
      <RadioGroupItem value={value} />
      <span>{children}</span>
    </label>
  );
}

function TestItemsField({
  idx,
  control,
}: {
  idx: number;
  control: ReturnType<typeof useForm<PetitionFormValues>>['control'];
}) {
  const [explicitMode, setExplicitMode] = useState<'ai' | 'other' | null>(null);
  return (
    <Controller
      control={control}
      name={`items.${idx}.testItems` as const}
      render={({ field }) => {
        const derivedMode: 'ai' | 'other' | null =
          field.value === '%AI' ? 'ai' : field.value ? 'other' : null;
        const mode = explicitMode ?? derivedMode;
        return (
          <div className="space-y-2">
            <RadioGroup
              value={mode ?? ''}
              onValueChange={(value) => {
                if (value === 'ai') {
                  setExplicitMode('ai');
                  field.onChange('%AI');
                } else {
                  setExplicitMode('other');
                  field.onChange(field.value === '%AI' ? '' : field.value || '');
                }
              }}
              className="flex flex-wrap gap-x-8 gap-y-3"
            >
              <RadioOption value="ai">%AI</RadioOption>
              <RadioOption value="other">อื่นๆ (โปรดระบุ)</RadioOption>
            </RadioGroup>
            {mode === 'other' && (
              <Textarea
                rows={3}
                value={field.value === '%AI' ? '' : field.value || ''}
                onChange={field.onChange}
                placeholder="ระบุรายการทดสอบ"
              />
            )}
          </div>
        );
      }}
    />
  );
}

export default function PetitionForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel = 'บันทึก',
}: Props) {
  const { user } = useAuth();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<PetitionFormValues>({
    resolver: zodResolver(petitionFormSchema),
    defaultValues: {
      serviceAgreement: {
        sampleDelivery: 'self',
        testMethod: 'standard',
        testMethodDoneBefore: null,
        testMethodDetail: '',
        testDuration: 'normal',
        testDurationDays: null,
        requireUncertainty: false,
        ...defaultValues?.serviceAgreement,
      },
      requester: {
        fullName: defaultValues?.requester?.fullName ?? user?.name ?? '',
        department: defaultValues?.requester?.department ?? user?.department ?? '',
        address:
          defaultValues?.requester?.address ??
          '151 ม.8 ตำบลสามควายเผือก อำเภอเมือง จังหวัดนครปฐม 73000',
        phone: defaultValues?.requester?.phone ?? '034-305281-2',
        fax: defaultValues?.requester?.fax ?? '',
        email: defaultValues?.requester?.email ?? user?.email ?? '',
        contactName: defaultValues?.requester?.contactName ?? defaultValues?.requester?.fullName ?? user?.name ?? '',
        position: defaultValues?.requester?.position ?? '',
      },
      sampleReturn: defaultValues?.sampleReturn ?? 'return',
      testDelivery: defaultValues?.testDelivery ?? ['email'],
      reportCustomerName: defaultValues?.reportCustomerName ?? ICP_LADDA_COMPANY,
      reportAddressType: defaultValues?.reportAddressType ?? 'default',
      reportAddressOther: defaultValues?.reportAddressOther ?? '',
      invoiceAddressType: defaultValues?.invoiceAddressType ?? 'default',
      invoiceAddressOther: defaultValues?.invoiceAddressOther ?? '',
      storageCondition: defaultValues?.storageCondition,
      packageType: defaultValues?.packageType,
      packageTypeOther: defaultValues?.packageTypeOther ?? '',
      sampleSubmittedBy: defaultValues?.sampleSubmittedBy ?? '',
      sampleSubmittedDate: defaultValues?.sampleSubmittedDate ?? null,
      items: defaultValues?.items?.length ? defaultValues.items : [emptyItem],
      cause: defaultValues?.cause ?? '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [lotOptions, setLotOptions] = useState<MfLotOption[]>([]);
  const [lotLoading, setLotLoading] = useState(false);
  const [lotError, setLotError] = useState<string | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const lotOptionMap = useMemo(() => {
    const map = new Map<string, MfLotOption>();
    for (const option of lotOptions) {
      map.set(option.label, option);
      map.set(option.sampleName, option);
    }
    return map;
  }, [lotOptions]);
  const employeeOptionMap = useMemo(() => {
    const map = new Map<string, EmployeeOption>();
    for (const option of employeeOptions) {
      map.set(option.label, option);
      map.set(option.name, option);
    }
    return map;
  }, [employeeOptions]);

  useEffect(() => {
    let alive = true;
    setLotLoading(true);
    setLotError(null);

    Promise.allSettled(
      MF_LOT_API_URLS.map(async ({ source, url }) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${source} HTTP ${res.status}`);
        return normalizeLotOptions(await res.json(), source);
      }),
    )
      .then((results) => {
        if (!alive) return;
        const options = results.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : [],
        );
        const failed = results.filter((result) => result.status === 'rejected').length;
        setLotOptions(options);
        setLotError(failed ? 'โหลดตัวเลือกจาก MF API ได้ไม่ครบทุกแหล่ง' : null);
      })
      .catch((e: Error) => {
        if (alive) setLotError(e.message);
      })
      .finally(() => alive && setLotLoading(false));

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setEmployeeLoading(true);

    fetch(EMPLOYEE_API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Employee HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (alive) setEmployeeOptions(normalizeEmployeeOptions(payload));
      })
      .catch(() => {
        if (alive) setEmployeeOptions([]);
      })
      .finally(() => alive && setEmployeeLoading(false));

    return () => {
      alive = false;
    };
  }, []);

  // when defaultValues change (eg. arriving from PendingSample), reset
  useEffect(() => {
    if (defaultValues) reset({ ...watch(), ...defaultValues });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const submit: SubmitHandler<PetitionFormValues> = (values) => {
    // re-sequence items 1..N before submit
    values.items = values.items.map((it, idx) => ({ ...it, seq: idx + 1 }));
    return onSubmit(values);
  };

  const sa = watch('serviceAgreement');
  const selectedReportCompany = watch('reportCustomerName');
  const defaultReportAddress = getCompanyAddress(selectedReportCompany);
  const applyLotOption = (idx: number, value: string, onChange: (value: string) => void) => {
    const option = lotOptionMap.get(value);
    if (!option) {
      onChange(value);
      return;
    }
    onChange(option.sampleName);
    setValue(`items.${idx}.commonName`, option.commonName, { shouldDirty: true });
    // Batch / Lot No. is intentionally NOT auto-populated — user fills it in
    setValue(`items.${idx}.productionDate`, option.productionDate, { shouldDirty: true });
    setValue(`items.${idx}.packageUnit`, option.packageUnit, { shouldDirty: true });
    setValue(`items.${idx}.note`, option.note, { shouldDirty: true });
  };
  const applyEmployeeOption = (value: string, onChange: (value: string) => void) => {
    const option = employeeOptionMap.get(value);
    onChange(option ? option.name : value);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {/* ===== Service Agreement ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">ส่วนที่ 1: การทบทวนข้อตกลงการบริการทดสอบ</CardTitle>
          <p className="text-sm text-grey-500">
            สำหรับลูกค้ากรอก (หากลูกค้าไม่สะดวก ให้เจ้าหน้าที่ห้องปฏิบัติการกรอกแทนโดยสอบถามข้อมูล และให้ลงนามทั้งผู้สอบถามและลูกค้า)
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <FieldLabel>1. ตัวอย่างนำส่งห้องปฏิบัติการโดย</FieldLabel>
            <Controller
              control={control}
              name="serviceAgreement.sampleDelivery"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-x-8 gap-y-3"
                >
                  <RadioOption value="self">1.1 ลูกค้านำเอง</RadioOption>
                  <RadioOption value="courier">1.2 จัดส่งทางไปรษณีย์</RadioOption>
                </RadioGroup>
              )}
            />
          </div>

          <div className="space-y-3">
            <FieldLabel>2. วิธีทดสอบโปรดระบุ</FieldLabel>
            <Controller
              control={control}
              name="serviceAgreement.testMethod"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-x-8 gap-y-3"
                >
                  <RadioOption value="standard">2.1 วิธีปกติ (กรณีลูกค้าไม่ระบุวิธี)</RadioOption>
                  <RadioOption value="custom">2.2 วิธีเฉพาะตามเอกสารของลูกค้า</RadioOption>
                </RadioGroup>
              )}
            />
            {sa?.testMethod === 'custom' && (
              <Textarea
                {...register('serviceAgreement.testMethodDetail')}
                rows={2}
                placeholder="ระบุวิธีเฉพาะหรือเอกสารอ้างอิงของลูกค้า"
              />
            )}
          </div>

          <div className="space-y-3">
            <FieldLabel>3. ระยะเวลาดำเนินการทดสอบ</FieldLabel>
            <Controller
              control={control}
              name="serviceAgreement.testDuration"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-x-8 gap-y-3"
                >
                  <RadioOption value="normal">3.1 ปกติ</RadioOption>
                  <RadioOption value="extended">3.2 ช้ากว่าปกติได้ (ภายใน ... วัน)</RadioOption>
                  <RadioOption value="urgent">3.3 เร็วกว่าปกติได้ (ภายใน ... วัน)</RadioOption>
                </RadioGroup>
              )}
            />
            {(sa?.testDuration === 'extended' || sa?.testDuration === 'urgent') && (
              <div>
                <FieldLabel>ระบุจำนวนวัน (ข้อ 3.2/3.3)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  {...register('serviceAgreement.testDurationDays', { valueAsNumber: true })}
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <FieldLabel>4. ค่า Uncertainty</FieldLabel>
            <Controller
              control={control}
              name="serviceAgreement.requireUncertainty"
              render={({ field }) => (
                <RadioGroup
                  value={field.value ? 'yes' : 'no'}
                  onValueChange={(value) => field.onChange(value === 'yes')}
                  className="flex flex-wrap gap-x-8 gap-y-3"
                >
                  <RadioOption value="yes">ต้องการ</RadioOption>
                  <RadioOption value="no">ไม่ต้องการ</RadioOption>
                </RadioGroup>
              )}
            />
          </div>

          <div className="space-y-2 text-sm text-grey-600">
            <p className="font-semibold text-black-500">เงื่อนไขการให้บริการ</p>
            <ol className="list-decimal space-y-1 pl-6">
              <li>ห้องปฏิบัติการฯให้บริการทดสอบตัวอย่างด้วยวิธีการตามเอกสาร วิธีวิเคราะห์สารเคมีกำจัดศัตรูพืชของห้องปฏิบัติการฯ (FM-QP-07-01-002)</li>
              <li>การรายงานผลทดสอบจะไม่มีบริการด้านการให้ความเห็น และการแปรผลไปตัดสินผล</li>
              <li>ปริมาณตัวอย่างขั้นตํ่าที่นำส่ง 500 ml, 500 g</li>
              <li>ระยะเวลาในการออกผลการทดสอบ ภายใน 3 วัน (กรณีหากมีข้อสงสัยในผลการวิเคราะห์ ขอขยายเวลาออกไปอีก 3 วัน)</li>
              <li>ส่งตัวอย่างไม่เกิน 15.00 น. ของทุกวัน</li>
              <li>ห้องปฏิบัติการรับผิดชอบผลการทดสอบเฉพาะกับตัวอย่างที่นำมาทดสอบเท่านั้น</li>
              <li>ยินยอมให้เปิดเผยข้อมูลตัวอย่าง และผลทดสอบแก่หน่วยงานอื่น (กรณีลูกค้าภายในองค์กร)</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* ===== Request Form ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">ส่วนที่ 2: ใบคำขอรับบริการ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <FieldLabel>ชื่อบริษัทผู้ส่งตัวอย่างที่ระบุในใบรายงานผล</FieldLabel>
            <NativeSelect {...register('reportCustomerName')}>
              <option value={ICP_LADDA_COMPANY}>{ICP_LADDA_COMPANY}</option>
              <option value={ICP_INTERTRADE_COMPANY}>{ICP_INTERTRADE_COMPANY}</option>
              <option value="other">อื่นๆ → โปรดระบุ</option>
            </NativeSelect>
          </div>

          <div className="space-y-3">
            <FieldLabel>ที่อยู่ที่ระบุในใบรายงานผล</FieldLabel>
            <Controller
              control={control}
              name="reportAddressType"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-3">
                  <RadioOption value="default">{defaultReportAddress}</RadioOption>
                  <RadioOption value="other">อื่นๆ → โปรดระบุ</RadioOption>
                </RadioGroup>
              )}
            />
            {watch('reportAddressType') === 'other' && (
              <Input {...register('reportAddressOther')} placeholder="โปรดระบุที่อยู่ในใบรายงานผล" />
            )}
          </div>

          <div className="space-y-3">
            <FieldLabel>ที่อยู่ในการออกใบกำกับภาษี</FieldLabel>
            <Controller
              control={control}
              name="invoiceAddressType"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-3">
                  <RadioOption value="default">{defaultReportAddress}</RadioOption>
                  <RadioOption value="other">อื่นๆ → โปรดระบุ</RadioOption>
                </RadioGroup>
              )}
            />
            {watch('invoiceAddressType') === 'other' && (
              <Input {...register('invoiceAddressOther')} placeholder="โปรดระบุที่อยู่ในการออกใบกำกับภาษี" />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>{FIELD_LABELS.phone}</FieldLabel>
              <Input {...register('requester.phone')} />
            </div>
            <div>
              <FieldLabel>โทรสาร</FieldLabel>
              <Input {...register('requester.fax')} />
            </div>
            <div>
              <FieldLabel>{FIELD_LABELS.email}</FieldLabel>
              <Input type="email" {...register('requester.email')} />
              <ErrorMsg msg={errors.requester?.email?.message} />
            </div>
            <div>
              <FieldLabel>ชื่อ-สกุลผู้ติดต่อ</FieldLabel>
              <Controller
                control={control}
                name="requester.contactName"
                render={({ field }) => (
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      setValue('requester.fullName', e.target.value, { shouldDirty: true });
                    }}
                  />
                )}
              />
            </div>
            <div>
              <FieldLabel>ตำแหน่ง</FieldLabel>
              <Input {...register('requester.position')} />
            </div>
            <div>
              <FieldLabel required>{FIELD_LABELS.department}</FieldLabel>
              <Input {...register('requester.department')} />
              <ErrorMsg msg={errors.requester?.department?.message} />
            </div>
            <div className="md:col-span-2 hidden">
              <FieldLabel required>{FIELD_LABELS.fullName}</FieldLabel>
              <Input {...register('requester.fullName')} />
              <Textarea rows={2} {...register('requester.address')} />
            </div>
          </div>

          <div className="space-y-3">
            <FieldLabel>ตัวอย่างหลังการทดสอบ</FieldLabel>
            <Controller
              control={control}
              name="sampleReturn"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-x-8 gap-y-3"
                >
                  <RadioOption value="return">ขอรับคืน (ภายใน 3 วันหลังจากได้รับผลทดสอบ)</RadioOption>
                  <RadioOption value="discard">ไม่ขอรับคืน / No return</RadioOption>
                </RadioGroup>
              )}
            />
          </div>

          <div className="space-y-3">
            <FieldLabel>รายละเอียดการทดสอบ (การส่งผล)</FieldLabel>
            <Controller
              control={control}
              name="testDelivery"
              render={({ field }) => {
                const value = field.value ?? [];
                const toggle = (v: 'self' | 'mail' | 'email' | 'report' | 'fax' | 'taxInvoice') => {
                  field.onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
                };
                const options = [
                  ['self', 'มารับผลเอง'],
                  ['mail', 'ส่งทางไปรษณีย์'],
                  ['email', 'E-Mail'],
                  ['report', 'ใบรายงานผล'],
                  ['taxInvoice', 'ใบกำกับภาษี'],
                ] as const;
                return (
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    {options.map(([opt, label]) => (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={value.includes(opt)} onCheckedChange={() => toggle(opt)} />
                        {label}
                      </label>
                    ))}
                  </div>
                );
              }}
            />
          </div>

          <div className="space-y-3">
            <FieldLabel required>การเก็บรักษาตัวอย่าง</FieldLabel>
            <Controller
              control={control}
              name="storageCondition"
              render={({ field }) => (
                <RadioGroup value={field.value ?? ''} onValueChange={field.onChange} className="flex flex-wrap gap-x-8 gap-y-3">
                  <RadioOption value="room">อุณหภูมิห้อง</RadioOption>
                  <RadioOption value="chilled">แช่เย็น</RadioOption>
                </RadioGroup>
              )}
            />
            <ErrorMsg msg={errors.storageCondition?.message} />
          </div>

          <div className="space-y-3">
            <FieldLabel required>ภาชนะบรรจุ</FieldLabel>
            <Controller
              control={control}
              name="packageType"
              render={({ field }) => (
                <RadioGroup value={field.value ?? ''} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-3">
                  <RadioOption value="plasticBag">ถุงพลาสติก</RadioOption>
                  <RadioOption value="glassBottle">ขวดแก้ว</RadioOption>
                  <RadioOption value="plasticBottle">ขวดพลาสติก</RadioOption>
                  <RadioOption value="can">กระป๋อง</RadioOption>
                  <RadioOption value="other">อื่นๆ ระบุ</RadioOption>
                </RadioGroup>
              )}
            />
            {watch('packageType') === 'other' && (
              <Input {...register('packageTypeOther')} placeholder="โปรดระบุ" />
            )}
            <ErrorMsg msg={errors.packageType?.message} />
          </div>
        </CardContent>
      </Card>

      {/* ===== Items ===== */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>รายการตัวอย่าง</CardTitle>
            <span className="text-xs text-grey-500">
              {lotLoading ? 'กำลังโหลดตัวเลือก MF...' : `${lotOptions.length} MF options`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <datalist id="mf-lot-options">
            {lotOptions.map((option) => (
              <option key={option.id} value={option.label} />
            ))}
          </datalist>
          <datalist id="employee-options">
            {employeeOptions.map((option) => (
              <option key={option.id} value={option.label} />
            ))}
          </datalist>
          {lotError && (
            <div className="rounded-[8px] border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
              {lotError}
            </div>
          )}
          {fields.map((f, idx) => (
            <div key={f.id} className="rounded-[10px] border border-black-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary-500">ตัวอย่างที่ {idx + 1}</p>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="danger-outline"
                    size="icon-sm"
                    onClick={() => remove(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel required>ชื่อตัวอย่าง</FieldLabel>
                  <Controller
                    control={control}
                    name={`items.${idx}.sampleName` as const}
                    render={({ field }) => (
                      <Input
                        {...field}
                        list="mf-lot-options"
                        placeholder="เลือกจาก MF API หรือพิมพ์เอง"
                        onChange={(e) => applyLotOption(idx, e.target.value, field.onChange)}
                      />
                    )}
                  />
                  <ErrorMsg msg={errors.items?.[idx]?.sampleName?.message} />
                </div>
                <div>
                  <FieldLabel required>Batch / Lot No.</FieldLabel>
                  <Input {...register(`items.${idx}.batchNo` as const)} />
                  <ErrorMsg msg={errors.items?.[idx]?.batchNo?.message} />
                </div>
                <div>
                  <FieldLabel>วันที่ผลิต</FieldLabel>
                  <Input type="date" {...register(`items.${idx}.productionDate` as const)} />
                </div>
                <div>
                  <FieldLabel>ขนาดบรรจุ</FieldLabel>
                  <Input {...register(`items.${idx}.packageUnit` as const)} />
                </div>
                <div>
                  <FieldLabel>หน่วยทดสอบ</FieldLabel>
                  <Input {...register(`items.${idx}.testUnit` as const)} />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel required>รายการทดสอบ</FieldLabel>
                  <TestItemsField idx={idx} control={control} />
                  <ErrorMsg msg={errors.items?.[idx]?.testItems?.message} />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>หมายเหตุ</FieldLabel>
                  <Input {...register(`items.${idx}.note` as const)} />
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="primary-outline"
            size="sm"
            onClick={() => append({ ...emptyItem, seq: fields.length + 1 })}
          >
            <Plus className="h-4 w-4" />
            เพิ่มตัวอย่าง
          </Button>
          {errors.items?.message && <ErrorMsg msg={errors.items.message as string} />}
        </CardContent>
      </Card>

      {/* ===== Cause ===== */}
      <Card>
        <CardHeader>
          <CardTitle>สาเหตุการตรวจ / ข้อมูลเพิ่มเติม</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={3} {...register('cause')} placeholder="โปรดระบุ (ถ้ามี)" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลผู้นำตัวอย่าง</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel required>ผู้นำส่งตัวอย่าง</FieldLabel>
            <Controller
              control={control}
              name="sampleSubmittedBy"
              render={({ field }) => (
                <Input
                  {...field}
                  list="employee-options"
                  placeholder={employeeLoading ? 'กำลังโหลดรายชื่อพนักงาน...' : 'ค้นหาชื่อหรือรหัสพนักงาน'}
                  onChange={(e) => applyEmployeeOption(e.target.value, field.onChange)}
                />
              )}
            />
            <ErrorMsg msg={errors.sampleSubmittedBy?.message} />
          </div>
          <div>
            <FieldLabel required>วันที่</FieldLabel>
            <Input type="date" {...register('sampleSubmittedDate')} />
            <ErrorMsg msg={errors.sampleSubmittedDate?.message} />
          </div>
        </CardContent>
      </Card>

      <Separator />
      <div className="flex justify-end gap-2 pb-4">
        <Button type="submit" disabled={submitting} variant="primary">
          {submitting ? 'กำลังบันทึก...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
