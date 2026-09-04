import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  findMatchingPetitionMasterItem,
  type PetitionMasterItemOption,
} from '@/lib/petitionMasterItem';
import { isLabBatch } from '@/types/petition.types';
import SubmitterPicker, { type SubmitterValues } from './SubmitterPicker';

export interface ItemRowValues {
  seq: number;
  // รหัส Master Item (RO-0123) ของแถวที่เลือก — ขับ "หมวดหมู่ย่อย (prefix code)" +
  // "กลุ่ม Item" ของ parameter. ตามของที่เลือกเสมอ ไม่ใช่ค่าที่คนพิมพ์เอง
  itemNo?: string;
  sampleName: string;
  commonName: string;
  batchNo: string;
  lotNo: string;
  productionDate: string | null;
  packageUnit: string;
  submissionNo: string;
  testUnit: string;
  testItems: string;
  note: string;
  labelQuantity?: string;
  labelSampledDate?: string;
  submittedQuantity?: string;
  submittedUnit?: string;
}

interface Props {
  value: ItemRowValues[];
  onChange: (v: ItemRowValues[]) => void;
  submitter: SubmitterValues;
  onSubmitterChange: (v: SubmitterValues) => void;
  submitterReadOnly?: boolean;
  submitterDepartment?: string;
  deliverer: SubmitterValues;
  onDelivererChange: (v: SubmitterValues) => void;
  requireDeliveryAndBatch?: boolean;
  itemsReadOnly?: boolean;
  allowManualItemFields?: boolean;
  masterItemOptions?: PetitionMasterItemOption[];
  masterItemsLoading?: boolean;
}

export default function ItemsStep({
  value,
  onChange,
  submitter,
  onSubmitterChange,
  submitterReadOnly,
  submitterDepartment,
  deliverer,
  onDelivererChange,
  requireDeliveryAndBatch = true,
  itemsReadOnly = false,
  allowManualItemFields = false,
  masterItemOptions = [],
  masterItemsLoading = false,
}: Props) {
  function setItem(idx: number, patch: Partial<ItemRowValues>) {
    onChange(value.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function fillEmptyMasterFields(
    item: ItemRowValues,
    option: PetitionMasterItemOption,
    patch: Partial<ItemRowValues> = {},
  ): Partial<ItemRowValues> {
    return {
      ...patch,
      // itemNo คือตัวตนของ master item ที่เลือก — ตามของที่เลือกเสมอ ต่างจากอีก 3 ฟิลด์
      // ที่เติมเฉพาะช่องว่างเพื่อไม่ทับสิ่งที่ R&D พิมพ์เอง
      itemNo: option.itemNo,
      sampleName: item.sampleName.trim() ? (patch.sampleName ?? item.sampleName) : option.sampleName,
      commonName: item.commonName.trim() ? item.commonName : option.commonName,
      packageUnit: item.packageUnit.trim() ? item.packageUnit : option.packageUnit,
    };
  }

  function handleManualSampleNameChange(idx: number, sampleName: string) {
    const item = value[idx];
    const match = findMatchingPetitionMasterItem(masterItemOptions, { sampleName });
    if (!match) {
      // ล้างรหัสเก่าทิ้ง ไม่งั้นชื่อที่พิมพ์ใหม่จะยังลาก parameter ของสินค้าตัวก่อนมาด้วย
      setItem(idx, { sampleName, itemNo: '' });
      return;
    }
    setItem(idx, fillEmptyMasterFields(item, match, { sampleName }));
  }

  function addItem() {
    onChange([
      ...value,
      {
        seq: value.length + 1,
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
      },
    ]);
  }

  function removeItem(idx: number) {
    onChange(value.filter((_, i) => i !== idx).map((it, i) => ({ ...it, seq: i + 1 })));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">ผู้ยื่นคำขอ และ ผู้นำส่ง</h2>
        <p className="text-sm text-grey-500">
          ผู้ยื่นคำขอ = ผู้ใช้งานที่เข้าสู่ระบบ · ผู้นำส่ง = ผู้ที่จะถือตัวอย่างไปส่ง (เลือกจากระบบ HR)
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <SubmitterPicker value={submitter} onChange={onSubmitterChange} readOnly={submitterReadOnly} department={submitterDepartment} />
          {requireDeliveryAndBatch && (
            <SubmitterPicker value={deliverer} onChange={onDelivererChange} />
          )}
        </div>
      </div>

      <div className="border-t border-grey-200 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">รายการตัวอย่าง</h2>
          <p className="text-sm text-grey-500">
            {allowManualItemFields
              ? 'กรอกข้อมูลตัวอย่างเอง หรือเลือกจาก Master Item เพื่อเติมชื่อตัวอย่าง ชื่อสามัญ และขนาดบรรจุ'
              : 'เลือกชื่อตัวอย่างจาก Master Item และกรอกเลข batch — batch ที่ลงท้ายด้วย 1 หรือ 6 จะถูกขอใบคำขอรับบริการในขั้นถัดไป'}
          </p>
        </div>
        <Button size="sm" variant="primary-outline" onClick={addItem} disabled={itemsReadOnly}>
          <Plus className="h-4 w-4" />
          เพิ่มตัวอย่าง
        </Button>
      </div>

      <div className="space-y-4">
        {value.map((it, idx) => {
          const lab = requireDeliveryAndBatch ? isLabBatch(it.batchNo) : true;
          const sampleNameId = `sample-name-${idx}`;
          const commonNameId = `common-name-${idx}`;
          return (
            <div key={idx} className="rounded-[10px] border border-grey-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold">ตัวอย่างที่ {it.seq}</div>
                  {lab && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      {requireDeliveryAndBatch ? `ส่ง lab (ลงท้าย ${it.batchNo.slice(-1)})` : 'ส่ง lab'}
                    </span>
                  )}
                </div>
                {value.length > 1 && !itemsReadOnly && (
                  <Button size="sm" variant="danger-outline" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                    ลบ
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={sampleNameId}>ชื่อตัวอย่าง</Label>
                  {allowManualItemFields ? (
                    <Input
                      id={sampleNameId}
                      value={it.sampleName}
                      onChange={(e) => handleManualSampleNameChange(idx, e.target.value)}
                      disabled={itemsReadOnly}
                      placeholder="กรอกชื่อตัวอย่าง"
                    />
                  ) : (
                    <MasterItemPicker
                      id={sampleNameId}
                      value={it}
                      options={masterItemOptions}
                      loading={masterItemsLoading}
                      disabled={itemsReadOnly}
                      onPick={(option) => setItem(idx, {
                        itemNo: option.itemNo,
                        sampleName: option.sampleName,
                        commonName: option.commonName,
                        packageUnit: option.packageUnit,
                      })}
                    />
                  )}
                </div>
                {requireDeliveryAndBatch && (
                  <div>
                    <Label>เลขแบช (Batch No.)</Label>
                    <Input
                      value={it.batchNo}
                      onChange={(e) => setItem(idx, { batchNo: e.target.value })}
                      disabled={itemsReadOnly}
                      placeholder="เช่น BN240601"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor={commonNameId}>ชื่อสามัญ / Active Ingredient</Label>
                  {allowManualItemFields ? (
                    <ManualActiveIngredientMasterPicker
                      id={commonNameId}
                      value={it}
                      options={masterItemOptions}
                      loading={masterItemsLoading}
                      disabled={itemsReadOnly}
                      onActiveIngredientChange={(commonName) => setItem(idx, { commonName })}
                      onPick={(option) => setItem(idx, fillEmptyMasterFields(it, option))}
                    />
                  ) : (
                    <Input
                      id={commonNameId}
                      value={it.commonName}
                      onChange={(e) => setItem(idx, { commonName: e.target.value })}
                      disabled
                      placeholder="เติมอัตโนมัติจาก Master Item"
                    />
                  )}
                </div>
                <div>
                  <Label>วันผลิต/วันที่รับเข้า</Label>
                  <Input
                    type="date"
                    value={it.productionDate ?? ''}
                    onChange={(e) => setItem(idx, { productionDate: e.target.value || null })}
                    disabled={itemsReadOnly}
                  />
                </div>
                <div>
                  <Label>ขนาดบรรจุ / จำนวน</Label>
                  <Input
                    value={it.packageUnit}
                    onChange={(e) => setItem(idx, { packageUnit: e.target.value })}
                    disabled={itemsReadOnly || !allowManualItemFields}
                    placeholder={allowManualItemFields ? 'กรอกขนาดบรรจุ หรือเลือกจาก Master Item' : 'เติมอัตโนมัติจาก Master Item'}
                  />
                </div>
                {(it.submittedQuantity || it.submittedUnit) && (
                  <>
                    <div>
                      <Label htmlFor={`submitted-quantity-${idx}`}>ปริมาณที่ส่งตัวอย่าง</Label>
                      <Input id={`submitted-quantity-${idx}`} value={it.submittedQuantity ?? ''} disabled />
                    </div>
                    <div>
                      <Label htmlFor={`submitted-unit-${idx}`}>หน่วยที่นำส่ง</Label>
                      <Input id={`submitted-unit-${idx}`} value={it.submittedUnit ?? ''} disabled />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    rows={2}
                    value={it.note}
                    onChange={(e) => setItem(idx, { note: e.target.value })}
                    disabled={itemsReadOnly}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MasterItemPicker({
  id,
  value,
  options,
  loading,
  disabled,
  compact = false,
  onPick,
}: {
  id?: string;
  value: Pick<ItemRowValues, 'sampleName' | 'commonName' | 'packageUnit'>;
  options: PetitionMasterItemOption[];
  loading: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPick: (option: PetitionMasterItemOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => {
    if (!value.sampleName) return null;
    return options.find((option) => (
      option.sampleName === value.sampleName &&
      (!value.commonName || option.commonName === value.commonName) &&
      (!value.packageUnit || option.packageUnit === value.packageUnit)
    )) ?? null;
  }, [options, value.commonName, value.packageUnit, value.sampleName]);

  function pick(option: PetitionMasterItemOption) {
    onPick(option);
    setOpen(false);
  }

  return (
    <Popover open={open && !disabled} onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-label="ชื่อตัวอย่าง"
          aria-expanded={open}
          className={cn(compact ? 'shrink-0 justify-center px-3' : 'w-full justify-between font-normal')}
          disabled={disabled || loading}
        >
          {compact ? (
            <span>Master</span>
          ) : (
            <span className={cn('truncate text-left', !value.sampleName && 'text-grey-400')}>
              {loading
                ? 'กำลังโหลด Master Item...'
                : value.sampleName || 'พิมพ์เพื่อค้นหาจาก Master Item'}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหาชื่อตัวอย่างจาก Master Item..." />
          <CommandList>
            <CommandEmpty>ไม่พบชื่อตัวอย่างใน Master Item</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selectedOption = selected === option;
                const commandValue = [
                  option.sampleName,
                  option.commonName,
                  option.packageUnit,
                  option.itemNo,
                ].filter(Boolean).join(' ');
                return (
                  <CommandItem
                    key={`${option.itemNo}-${option.sampleName}-${option.commonName}-${option.packageUnit}`}
                    value={commandValue}
                    onSelect={() => pick(option)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedOption ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{option.sampleName}</span>
                      <span className="block truncate text-xs text-grey-500">
                        {[option.commonName, option.packageUnit].filter(Boolean).join(' · ') || option.itemNo}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ManualActiveIngredientMasterPicker({
  id,
  value,
  options,
  loading,
  disabled,
  onActiveIngredientChange,
  onPick,
}: {
  id: string;
  value: Pick<ItemRowValues, 'sampleName' | 'commonName' | 'packageUnit'>;
  options: PetitionMasterItemOption[];
  loading: boolean;
  disabled?: boolean;
  onActiveIngredientChange: (commonName: string) => void;
  onPick: (option: PetitionMasterItemOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => {
    if (!value.sampleName) return null;
    return options.find((option) => (
      option.sampleName === value.sampleName &&
      (!value.commonName || option.commonName === value.commonName) &&
      (!value.packageUnit || option.packageUnit === value.packageUnit)
    )) ?? null;
  }, [options, value.commonName, value.packageUnit, value.sampleName]);

  function pick(option: PetitionMasterItemOption) {
    onPick(option);
    setOpen(false);
  }

  return (
    <Popover open={open && !disabled} onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            id={id}
            value={value.commonName}
            onChange={(e) => onActiveIngredientChange(e.target.value)}
            disabled={disabled}
            placeholder={loading ? 'กำลังโหลด Master Item...' : 'กรอกชื่อสามัญ หรือเลือกจาก Master Item'}
            className="pr-9"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-master-options`}
            aria-autocomplete="list"
          />
          <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="ค้นหาชื่อตัวอย่างจาก Master Item..." />
          <CommandList id={`${id}-master-options`}>
            <CommandEmpty>{loading ? 'กำลังโหลด Master Item...' : 'ไม่พบชื่อตัวอย่างใน Master Item'}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selectedOption = selected === option;
                const commandValue = [
                  option.sampleName,
                  option.commonName,
                  option.packageUnit,
                  option.itemNo,
                ].filter(Boolean).join(' ');
                return (
                  <CommandItem
                    key={`${option.itemNo}-${option.sampleName}-${option.commonName}-${option.packageUnit}`}
                    value={commandValue}
                    onSelect={() => pick(option)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedOption ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{option.sampleName}</span>
                      <span className="block truncate text-xs text-grey-500">
                        {[option.commonName, option.packageUnit].filter(Boolean).join(' · ') || option.itemNo}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
