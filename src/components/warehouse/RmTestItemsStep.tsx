// Step 3 — แบชที่ติ๊กส่งตรวจ ต้องเลือกสินค้าอ้างอิง (ได้ commonName) จาก Master Item
// commonName เป็นตัวขับการจับคู่พารามิเตอร์ (classification-based เหมือน production — ดู
// petitionTestItems.ts) และการจับคู่ simple-method ตอน assign เครื่องมือ จึงต้องมาจาก master item
// ไม่ใช่พิมพ์เอง — ดู CLAUDE.md gotcha เรื่อง simple-method positional
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown } from 'lucide-react';
import type { ProductBatch } from '@/types/goodsReceipt.types';
import type { RmTestSelection } from '@/lib/rmPetitionMapping';
import type { PetitionMasterItemOption } from '@/lib/petitionMasterItem';
import { Field } from './formControls';

interface Props {
  batches: ProductBatch[];
  value: RmTestSelection[];
  onChange: (next: RmTestSelection[]) => void;
  masterItemOptions: PetitionMasterItemOption[];
  masterItemsLoading?: boolean;
}

// combobox เลือก master item — pattern เดียวกับ ItemsStep.tsx:244-298
// trigger ต้องโชว์ sampleName (ชื่อตัวอย่างจาก master item ที่เลือก) ไม่ใช่ commonName —
// commonName มัก short/generic กว่า sampleName และบาง master item ตั้ง commonName ว่างไว้
// (ตัวเลือกแบบนั้นถูกกรองออกจาก options ก่อนส่งเข้ามาแล้ว ดู usableMasterItemOptions ด้านล่าง)
const MasterItemPicker = ({ options, loading, sampleName, onPick }: {
  options: PetitionMasterItemOption[];
  loading?: boolean;
  sampleName: string;
  onPick: (option: PetitionMasterItemOption) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox"
          className="w-full justify-between font-normal">
          <span className={sampleName ? '' : 'text-grey-500'}>
            {sampleName || (loading ? 'กำลังโหลด Master Item...' : 'เลือกสินค้าอ้างอิง')}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหาชื่อตัวอย่างจาก Master Item..." />
          <CommandList>
            <CommandEmpty>ไม่พบชื่อตัวอย่างใน Master Item</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={`${option.itemNo}-${option.sampleName}-${option.commonName}-${option.packageUnit}`}
                  value={[option.sampleName, option.commonName, option.packageUnit, option.itemNo]
                    .filter(Boolean).join(' ')}
                  onSelect={() => { onPick(option); setOpen(false); }}>
                  <div className="flex flex-col">
                    <span>{option.sampleName}</span>
                    <span className="text-xs text-grey-500">
                      {[option.commonName, option.packageUnit].filter(Boolean).join(' · ') || option.itemNo}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function RmTestItemsStep({
  batches, value, onChange, masterItemOptions, masterItemsLoading,
}: Props) {
  const find = (batchNo: string) => value.find((s) => s.batchNo === batchNo);

  // master item ที่ commonName ว่างเลือกไปก็ใช้งานไม่ได้ (buildRmPetitionItems บังคับ commonName
  // ไม่ว่าง) — กรองออกจากตัวเลือกไปเลย กันไม่ให้คลิกได้ทางเข้าตันที่แก้เองไม่ได้ (ดู CLAUDE.md
  // Fix 2: เลือกวิธีกรองออก แทนที่จะปล่อยเลือกได้แล้วค่อยฟ้อง error ทีหลัง)
  const usableMasterItemOptions = useMemo(
    () => masterItemOptions.filter((o) => o.commonName?.trim()),
    [masterItemOptions],
  );

  const patch = (batchNo: string, next: Partial<RmTestSelection>) => {
    const existing = find(batchNo);
    const merged: RmTestSelection = {
      batchNo,
      commonName: existing?.commonName ?? '',
      sampleName: existing?.sampleName,
      ...next,
    };
    onChange([...value.filter((s) => s.batchNo !== batchNo), merged]);
  };

  if (batches.length === 0) {
    return <p className="text-sm text-grey-600">ยังไม่ได้ติ๊กแบชที่ส่งตรวจในขั้นตอนใบรับสินค้า</p>;
  }

  return (
    <div className="space-y-3">
      {batches.map((b) => {
        const batchNo = String(b.batchNo ?? '').trim();
        const sel = find(batchNo);
        return (
          <Card key={batchNo}>
            <CardHeader><CardTitle className="text-base">แบช {batchNo}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="สินค้าอ้างอิง (Master Item)">
                <MasterItemPicker
                  options={usableMasterItemOptions}
                  loading={masterItemsLoading}
                  sampleName={sel?.sampleName ?? ''}
                  onPick={(option) => patch(batchNo, {
                    commonName: option.commonName,
                    sampleName: option.sampleName,
                  })} />
              </Field>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
