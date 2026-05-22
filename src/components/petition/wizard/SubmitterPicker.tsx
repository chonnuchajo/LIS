import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, AlertCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useEmployeeOptions, type EmployeeOption } from '@/hooks/useExternalLookups';

export interface SubmitterValues {
  employeeId?: string;
  name: string;
}

interface Props {
  value: SubmitterValues;
  onChange: (v: SubmitterValues) => void;
  readOnly?: boolean;
}

export default function SubmitterPicker({ value, onChange, readOnly }: Props) {
  const { options, loading } = useEmployeeOptions();
  const [open, setOpen] = useState(false);

  const selected = useMemo<EmployeeOption | null>(() => {
    if (!value.employeeId && !value.name) return null;
    return (
      options.find((o) => o.id === value.employeeId) ??
      options.find((o) => o.name === value.name) ??
      null
    );
  }, [options, value.employeeId, value.name]);

  function pick(opt: EmployeeOption) {
    onChange({ ...value, employeeId: opt.id, name: opt.name });
    setOpen(false);
  }

  if (readOnly) {
    return (
      <div className="grid gap-3">
        <div>
          <Label>ผู้ยื่นคำขอ</Label>
          <div className="mt-1 rounded-[10px] border border-black-50 bg-grey-50 px-3 py-2 text-sm text-black-500">
            {value.name || '-'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div>
        <Label>ผู้นำส่ง (เลือกจากระบบ HR)</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
              disabled={loading}
            >
              <span className={cn('truncate', !selected && 'text-grey-400')}>
                {loading
                  ? 'กำลังโหลดรายชื่อ...'
                  : selected
                    ? selected.label
                    : 'เลือกพนักงาน'}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="พิมพ์ชื่อ / รหัสพนักงาน..." />
              <CommandList>
                <CommandEmpty>ไม่พบพนักงาน</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={opt.label}
                      onSelect={() => pick(opt)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selected?.id === opt.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {!loading && options.length === 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-yellow-600">
            <AlertCircle className="h-3 w-3" />
            โหลดรายชื่อจาก API ไม่สำเร็จ — โปรดลองใหม่
          </p>
        )}
        {selected && (
          <p className="text-xs text-grey-500 mt-1">รหัส: {selected.id}</p>
        )}
      </div>
    </div>
  );
}
