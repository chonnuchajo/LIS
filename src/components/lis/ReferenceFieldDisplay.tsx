import { Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ParameterValueField } from '@/lib/api';

interface ReferenceFieldDisplayProps {
  field: ParameterValueField;
  resolvedValue: unknown;
  sourceName?: string;
}

export function ReferenceFieldDisplay({
  field,
  resolvedValue,
  sourceName,
}: ReferenceFieldDisplayProps) {
  const display = resolvedValue == null || resolvedValue === '' ? '' : String(resolvedValue);
  const phaseLabel = field.refPhase === 2 ? ' · Phase 2' : '';
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-grey-700 flex items-center gap-1">
          <Link2 className="h-3 w-3 text-emerald-500" aria-hidden />
          {field.label}
          {field.unit && (
            <span className="text-grey-400 font-normal ml-1">({field.unit})</span>
          )}
        </label>
      </div>
      <Input
        value={display}
        readOnly
        disabled
        className="h-8 text-sm bg-emerald-50/40 border-emerald-200 cursor-default"
        placeholder={display === '' ? '(รอ parameter ต้นทางกรอกค่า)' : undefined}
      />
      <p className="text-[10px] text-emerald-700/80 truncate">
        ← {sourceName ? `${sourceName} · ` : ''}
        {field.refFieldLabel ?? ''}
        {phaseLabel}
      </p>
    </div>
  );
}
