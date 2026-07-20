// Step 3 — แบชที่ติ๊กส่งตรวจ ต้องเลือกสินค้าอ้างอิง (ได้ commonName) + รายการทดสอบ
// commonName เป็นตัวขับการจับคู่ simple-method ตอน assign เครื่องมือ จึงต้องมาจาก master item
// ไม่ใช่พิมพ์เอง — ดู CLAUDE.md gotcha เรื่อง simple-method positional
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
const MasterItemPicker = ({ options, loading, commonName, onPick }: {
  options: PetitionMasterItemOption[];
  loading?: boolean;
  commonName: string;
  onPick: (option: PetitionMasterItemOption) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox"
          className="w-full justify-between font-normal">
          <span className={commonName ? '' : 'text-grey-500'}>
            {commonName || (loading ? 'กำลังโหลด Master Item...' : 'เลือกสินค้าอ้างอิง')}
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
                  value={[option.sampleName, option.commonName, option.itemNo].filter(Boolean).join(' ')}
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

  const patch = (batchNo: string, next: Partial<RmTestSelection>) => {
    const existing = find(batchNo);
    const merged: RmTestSelection = {
      batchNo,
      commonName: existing?.commonName ?? '',
      testItems: existing?.testItems ?? '',
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
              <Field label="สินค้าอ้างอิง (Master Item) — ได้ common name">
                <MasterItemPicker
                  options={masterItemOptions}
                  loading={masterItemsLoading}
                  commonName={sel?.commonName ?? ''}
                  onPick={(option) => patch(batchNo, { commonName: option.commonName })} />
              </Field>
              <Field label="รายการทดสอบ">
                <Input value={sel?.testItems ?? ''}
                  onChange={(e) => patch(batchNo, { testItems: e.target.value })} />
              </Field>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
