import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  CheckCircle2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/lis/AppLayout';
import PageHeader from '@/components/lis/PageHeader';
import { usePetition, usePetitionList } from '@/hooks/usePetition';
import { api, type ParameterItem, type ParameterValueField } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useArrivalFlash } from '@/hooks/useArrivalFlash';
import { normalizeRoles } from '@/lib/roles';
import { useConfirm } from '@/context/ConfirmDialog';
import { isFieldAbnormal } from '@/lib/parameterValidation';
import { cn } from '@/lib/utils';
import { TimerField } from '@/components/lis/TimerField';
import { PhaseBanner } from '@/components/lis/PhaseBanner';
import { ReferenceFieldDisplay } from '@/components/lis/ReferenceFieldDisplay';
import { matchParametersForItem, visibleEnumOptions } from '@/lib/petitionTestItems';
import { useItemGroupMembership } from '@/hooks/useItemGroupMembership';
import {
  PETITION_DEPT_LABELS,
  type Petition,
  type PetitionItem,
  type PetitionPhase,
  type QCTestResult,
} from '@/types/petition.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FULL_ACCESS_ROLES = new Set(['admin', 'lab-head']);

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface FieldSaveInfo {
  state: SaveState;
  savedAt?: Date;
  savedBy?: string;
}

function formatTime(d: Date | string | undefined) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

const isLabBatchNo = (batchNo?: string | null) => /[16]$/.test(String(batchNo ?? '').trim());


function resultKey(itemSeq: number, parameterId: string) {
  return `${itemSeq}__${parameterId}`;
}

const noteLabelFor = (mainLabel: string) => `${mainLabel}__note`;

function describeStandard(field: ParameterValueField): string {
  const op = field.standardOperator;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  const unit = field.unit ? ` ${field.unit}` : '';
  switch (op) {
    case 'lt': return `< ${v1}${unit}`;
    case 'lte': return `≤ ${v1}${unit}`;
    case 'eq': return `= ${v1}${unit}`;
    case 'gte': return `≥ ${v1}${unit}`;
    case 'gt': return `> ${v1}${unit}`;
    case 'between': return `${v1} - ${v2}${unit}`;
    case 'tolerance': return `${v1} ± ${v2}%${unit}`;
    default: return '';
  }
}

interface TestFieldProps {
  field: ParameterValueField;
  item: PetitionItem;
  itemGroupIds?: string[];
  value: unknown;
  noteValue: unknown;
  saveInfo?: FieldSaveInfo;
  noteSaveInfo?: FieldSaveInfo;
  onChange: (val: unknown) => void;
  onNoteChange: (val: unknown) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

function TestField({
  field,
  item,
  itemGroupIds = [],
  value,
  noteValue,
  saveInfo,
  noteSaveInfo,
  onChange,
  onNoteChange,
  disabled = false,
  readOnly = false,
}: TestFieldProps) {
  const strVal = value == null ? '' : String(value);
  const strNote = noteValue == null ? '' : String(noteValue);
  const requireNoteOn = field.requireNoteOn ?? [];
  const showNote = field.type === 'enum' && requireNoteOn.includes(strVal);
  const isAbnormal = isFieldAbnormal(field, value);
  const effectivelyDisabled = disabled || readOnly;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-grey-700">
          {field.label}
          {field.unit && <span className="text-grey-400 font-normal ml-1">({field.unit})</span>}
          {field.required && !readOnly && <span className="text-red-500 ml-1">*</span>}
        </label>
        {isAbnormal && (
          <span
            className="inline-flex items-center"
            title={
              field.type === 'enum'
                ? `ค่าผิดปกติ — คาดหวัง: ${(field.expectedValues ?? []).join(', ')}`
                : `ค่าผิดปกติ — คาดหวัง: ${describeStandard(field)}`
            }
          >
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </span>
        )}
        {!readOnly && saveInfo?.state === 'saving' && (
          <Loader2 className="h-3 w-3 animate-spin text-grey-400" />
        )}
        {!readOnly && saveInfo?.state === 'saved' && (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        )}
        {!readOnly && saveInfo?.state === 'error' && (
          <AlertCircle className="h-3 w-3 text-red-400" />
        )}
      </div>

      {field.type === 'timer' ? (
        <TimerField field={field} value={value} onChange={onChange} disabled={effectivelyDisabled} />
      ) : field.type === 'enum' ? (
        <Select
          value={strVal || '__none__'}
          onValueChange={(v) => !readOnly && onChange(v === '__none__' ? '' : v)}
          disabled={effectivelyDisabled}
        >
          <SelectTrigger
            className={cn(
              'h-8 text-sm',
              isAbnormal && 'border-red-400 ring-1 ring-red-200',
              readOnly && 'bg-grey-50 cursor-default',
            )}
          >
            <SelectValue placeholder="เลือกค่า..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— เลือก —</SelectItem>
            {(() => {
              const visible = visibleEnumOptions(field, item, itemGroupIds);
              const savedOutOfScope = strVal && !visible.includes(strVal);
              return (
                <>
                  {visible.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                  {savedOutOfScope && (
                    <SelectItem key="__saved__" value={strVal} disabled>
                      {strVal} (นอกเงื่อนไข — ค่าเดิม)
                    </SelectItem>
                  )}
                </>
              );
            })()}
          </SelectContent>
        </Select>
      ) : field.type === 'photo' ? (
        <div className="text-xs text-grey-400 italic py-1">แนบรูปภาพ (ยังไม่รองรับในเวอร์ชันนี้)</div>
      ) : (
        <Input
          type={field.type === 'number' || field.type === 'float' ? 'number' : 'text'}
          step={field.type === 'float' ? 'any' : undefined}
          value={strVal}
          onChange={(e) => !readOnly && onChange(e.target.value)}
          disabled={effectivelyDisabled}
          className={cn(
            'h-8 text-sm',
            isAbnormal && 'border-red-400 ring-1 ring-red-200',
            readOnly && 'bg-grey-50 cursor-default',
          )}
          placeholder={
            field.standardOperator
              ? `มาตรฐาน: ${describeStandard(field)}`
              : field.standardValue != null
                ? `มาตรฐาน: ${field.standardValue}`
                : undefined
          }
        />
      )}

      {showNote && !readOnly && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-amber-800">
              คำอธิบาย / หมายเหตุ <span className="text-red-500">*</span>
            </label>
            {noteSaveInfo?.state === 'saving' && (
              <Loader2 className="h-3 w-3 animate-spin text-grey-400" />
            )}
            {noteSaveInfo?.state === 'saved' && (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            )}
            {noteSaveInfo?.state === 'error' && (
              <AlertCircle className="h-3 w-3 text-red-400" />
            )}
          </div>
          <textarea
            value={strNote}
            onChange={(e) => onNoteChange(e.target.value)}
            disabled={effectivelyDisabled}
            placeholder={`อธิบายเพิ่มเติมเมื่อเลือก "${strVal}"`}
            className="w-full text-sm rounded border border-amber-300 bg-white px-2 py-1 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:bg-grey-50 disabled:cursor-not-allowed"
          />
          {noteSaveInfo?.state === 'saved' && noteSaveInfo.savedBy && (
            <p className="text-xs text-amber-700">
              กรอกโดย {noteSaveInfo.savedBy} เมื่อ {formatTime(noteSaveInfo.savedAt)}
            </p>
          )}
        </div>
      )}

      {!readOnly && saveInfo?.state === 'saved' && saveInfo.savedBy && (
        <p className="text-xs text-grey-400">
          กรอกโดย {saveInfo.savedBy} เมื่อ {formatTime(saveInfo.savedAt)}
        </p>
      )}
      {!readOnly && saveInfo?.state === 'error' && (
        <p className="text-xs text-red-400">บันทึกไม่สำเร็จ</p>
      )}
    </div>
  );
}

export default function LabTestingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const flashClass = useArrivalFlash();

  const { data: petition, loading: petitionLoading, error: petitionError } = usePetition(id);
  const { data: worklistData } = usePetitionList({
    status: 'pendingReview,inProgress',
    limit: 20,
  });

  const [allParameters, setAllParameters] = useState<ParameterItem[]>([]);
  const groupMembership = useItemGroupMembership();
  const idsFor = (it: { sampleId?: string }) =>
    groupMembership.get(String(it?.sampleId ?? '').trim()) ?? [];
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const [savedResults, setSavedResults] = useState<QCTestResult[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [valuesPhase2, setValuesPhase2] = useState<Record<string, Record<string, unknown>>>({});
  const [saveStates, setSaveStates] = useState<Record<string, Record<string, FieldSaveInfo>>>({});
  const [saveStatesPhase2, setSaveStatesPhase2] = useState<Record<string, Record<string, FieldSaveInfo>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [wasReturned, setWasReturned] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<PetitionPhase>(1);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load all parameters, filter for Lab scope + shared QC params
  useEffect(() => {
    api.getParameters()
      .then((all) => {
        const labParams = all.filter(
          (p) => p.scope === 'lab' || (p.scope === 'qc' && p.shareWithLab === true),
        );
        setAllParameters(labParams);
      })
      .catch(() => {})
      .finally(() => setParamsLoaded(true));
  }, []);

  // Auto-advance status pendingReview → inProgress when Lab enters the first value
  const advancedRef = useRef(false);
  const advanceToInProgress = useCallback(() => {
    if (!petition || advancedRef.current) return;
    if (petition.status !== 'pendingReview') return;
    advancedRef.current = true;
    api.patch(`/petitions/${petition._id}`, {
      status: 'inProgress',
      actor: user?.name ?? 'system',
    }).catch(() => {
      advancedRef.current = false;
    });
  }, [petition, user]);

  // Default the visible phase tab to the petition's current phase
  useEffect(() => {
    if (!petition) return;
    setSelectedPhase((petition.currentPhase ?? 1) as PetitionPhase);
  }, [petition?._id, petition?.currentPhase]);

  // Detect if this petition was previously sent back from QC Approval
  useEffect(() => {
    if (!petition?._id) {
      setWasReturned(false);
      return;
    }
    let alive = true;
    api.getReturnedFlags([petition._id])
      .then((map) => { if (alive) setWasReturned(!!map[petition._id]); })
      .catch(() => { if (alive) setWasReturned(false); });
    return () => { alive = false; };
  }, [petition?._id]);

  useEffect(() => {
    if (!id) return;
    api.getQCResults(id).then((results) => {
      setSavedResults(results);
      const v: Record<string, Record<string, unknown>> = {};
      const v2: Record<string, Record<string, unknown>> = {};
      const s: Record<string, Record<string, FieldSaveInfo>> = {};
      const s2: Record<string, Record<string, FieldSaveInfo>> = {};
      results.forEach((r) => {
        const k = resultKey(r.itemSeq, r.parameterId);
        v[k] = { ...(r.values as Record<string, unknown>) };
        v2[k] = { ...((r.valuesPhase2 ?? {}) as Record<string, unknown>) };
        s[k] = {};
        s2[k] = {};
        const stamp: FieldSaveInfo = {
          state: 'saved',
          savedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
          savedBy: r.updatedBy?.name || r.enteredBy?.name,
        };
        Object.keys(r.values as object).forEach((label) => { s[k][label] = stamp; });
        Object.keys(r.valuesPhase2 ?? {}).forEach((label) => { s2[k][label] = stamp; });
      });
      setValues(v);
      setValuesPhase2(v2);
      setSaveStates(s);
      setSaveStatesPhase2(s2);
    }).catch(() => {});
  }, [id]);

  const handleFieldChange = useCallback(
    (
      petition: Petition,
      item: PetitionItem,
      param: ParameterItem,
      fieldLabel: string,
      newVal: unknown,
      phase: PetitionPhase = 1,
    ) => {
      const k = resultKey(item.seq, param._id!);

      advanceToInProgress();

      const setValuesFn = phase === 2 ? setValuesPhase2 : setValues;
      const setStatesFn = phase === 2 ? setSaveStatesPhase2 : setSaveStates;

      setValuesFn((prev) => ({
        ...prev,
        [k]: { ...(prev[k] ?? {}), [fieldLabel]: newVal },
      }));

      setStatesFn((prev) => ({
        ...prev,
        [k]: { ...(prev[k] ?? {}), [fieldLabel]: { state: 'saving' } },
      }));

      const debounceKey = `${k}__${fieldLabel}__p${phase}`;
      clearTimeout(debounceRefs.current[debounceKey]);
      debounceRefs.current[debounceKey] = setTimeout(async () => {
        try {
          await api.saveQCResult({
            petitionId: petition._id!,
            petitionNo: petition.petitionNo,
            itemSeq: item.seq,
            sampleId: item.sampleId,
            sampleName: item.sampleName,
            parameterId: param._id!,
            parameterName: param.name,
            fieldLabel,
            value: newVal,
            enteredBy: {
              name: user?.name ?? 'Unknown',
              email: user?.email ?? '',
            },
            phase,
          });
          const now = new Date();
          setStatesFn((prev) => ({
            ...prev,
            [k]: {
              ...(prev[k] ?? {}),
              [fieldLabel]: {
                state: 'saved',
                savedAt: now,
                savedBy: user?.name ?? 'Unknown',
              },
            },
          }));
        } catch {
          setStatesFn((prev) => ({
            ...prev,
            [k]: { ...(prev[k] ?? {}), [fieldLabel]: { state: 'error' } },
          }));
        }
      }, 800);
    },
    [user, advanceToInProgress],
  );

  if (petitionLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
        </div>
      </AppLayout>
    );
  }

  if (petitionError || !petition) {
    return (
      <AppLayout>
        <div className="text-center text-grey-500">
          {petitionError || 'ไม่พบข้อมูลคำร้อง'}
        </div>
      </AppLayout>
    );
  }

  // Show only Lab items: lab-batch (batchNo 1/6) AND have at least one
  // lab-scope or QC-shared-with-lab parameter matching the item's classification.
  // Items with no Lab-readable params should not appear here.
  const allLabBatchItems = (petition.items ?? []).filter((it) => isLabBatchNo(it.batchNo));
  const labItems = paramsLoaded
    ? allLabBatchItems.filter(
        (it) => matchParametersForItem(it, allParameters, idsFor(it)).length > 0,
      )
    : allLabBatchItems;

  // 2-phase support: does any matched parameter use hasPhases?
  const hasAnyPhasedParam = labItems.some((item) =>
    matchParametersForItem(item, allParameters, idsFor(item)).some((p) => p.hasPhases),
  );
  const currentPhase: PetitionPhase = (petition.currentPhase ?? 1) as PetitionPhase;
  // If user hasn't picked a tab, default to current phase
  const effectivePhase: PetitionPhase = hasAnyPhasedParam ? selectedPhase : 1;

  // Returns fields visible in the given phase for a parameter.
  // Non-phased parameters always show all fields in Phase 1.
  const visibleFields = (param: ParameterItem, phase: PetitionPhase): ParameterValueField[] => {
    const fields = param.valueFields ?? [];
    if (!param.hasPhases) return phase === 1 ? fields : [];
    return fields.filter((f) => {
      const p = f.phase ?? 'both';
      if (p === 'both') return true;
      return phase === 1 ? p === 'before' : p === 'after';
    });
  };

  const valuesForPhase = (phase: PetitionPhase) => (phase === 2 ? valuesPhase2 : values);
  const savesForPhase = (phase: PetitionPhase) => (phase === 2 ? saveStatesPhase2 : saveStates);

  // Resolve a reference field's value from another parameter's saved result on the same item
  const resolveReference = (itemSeq: number, field: ParameterValueField) => {
    if (!field.refParameterId || !field.refFieldLabel) {
      return { value: '' as unknown, sourceName: undefined as string | undefined };
    }
    const refKey = resultKey(itemSeq, field.refParameterId);
    const sourceDict = field.refPhase === 2 ? valuesPhase2 : values;
    const value = sourceDict[refKey]?.[field.refFieldLabel] ?? '';
    const sourceName = savedResults.find(
      (r) => r.parameterId === field.refParameterId && r.itemSeq === itemSeq,
    )?.parameterName;
    return { value, sourceName };
  };

  const countAbnormal = (): number => {
    let count = 0;
    labItems.forEach((item) => {
      const matched = matchParametersForItem(item, allParameters, idsFor(item));
      matched.forEach((param) => {
        if (param.scope !== 'lab') return; // skip read-only shared QC params
        const k = resultKey(item.seq, param._id!);
        // Check Phase 1 values for all non-after fields
        const p1Values = values[k] ?? {};
        (param.valueFields ?? []).forEach((field) => {
          if ((field.phase ?? 'both') === 'after') return;
          if (isFieldAbnormal(field, p1Values[field.label])) count += 1;
        });
        // Check Phase 2 values for both/after fields if phased
        if (param.hasPhases) {
          const p2Values = valuesPhase2[k] ?? {};
          (param.valueFields ?? []).forEach((field) => {
            const ph = field.phase ?? 'both';
            if (ph === 'before') return;
            if (isFieldAbnormal(field, p2Values[field.label])) count += 1;
          });
        }
      });
    });
    return count;
  };
  const abnormalCount = countAbnormal();

  // Validate the currently-active phase only — Phase 2 submit doesn't require Phase 1 re-edit.
  const validate = (phaseToCheck: PetitionPhase): string[] => {
    const missing: string[] = [];
    const phaseValues = valuesForPhase(phaseToCheck);
    labItems.forEach((item) => {
      const matched = matchParametersForItem(item, allParameters, idsFor(item));
      matched.forEach((param) => {
        if (param.scope !== 'lab') return; // only validate Lab-owned params
        const k = resultKey(item.seq, param._id!);
        const itemValues = phaseValues[k] ?? {};
        visibleFields(param, phaseToCheck).forEach((field) => {
          if (field.type === 'reference') return; // reference fields are auto-resolved
          const val = itemValues[field.label];
          if (field.required && (val == null || String(val).trim() === '')) {
            missing.push(`รายการ ${item.seq} › ${param.name} › ${field.label}`);
            return;
          }
          if (
            field.type === 'enum' &&
            (field.requireNoteOn ?? []).includes(String(val ?? ''))
          ) {
            const noteVal = itemValues[noteLabelFor(field.label)];
            if (!noteVal || String(noteVal).trim() === '') {
              missing.push(`รายการ ${item.seq} › ${param.name} › ${field.label} (คำอธิบาย)`);
            }
          }
        });
      });
    });
    return missing;
  };

  const handleSaveDraft = () => {
    toast.success('บันทึกแบบร่างเรียบร้อย', {
      description: 'ค่าที่กรอกถูกบันทึกอัตโนมัติแล้ว',
    });
    navigate('/lab-testing');
  };

  const handleSubmitResult = async () => {
    const missing = validate(effectivePhase);
    if (missing.length > 0) {
      toast.error('กรอกข้อมูลไม่ครบ', {
        description: `ขาด ${missing.length} ช่อง:\n${missing.slice(0, 5).join('\n')}${missing.length > 5 ? `\n…และอีก ${missing.length - 5}` : ''}`,
      });
      return;
    }
    if (abnormalCount > 0) {
      const ok = await confirm({
        title: 'พบค่าผิดปกติ',
        description: `พบค่าผิดปกติ ${abnormalCount} รายการ ยืนยันบันทึกผล?`,
      });
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/petitions/${petition._id}`, {
        status: 'success',
        actor: user?.name ?? 'system',
      });
      toast.success('บันทึกผลเรียบร้อย');
      navigate('/lab-testing');
    } catch {
      toast.error('บันทึกผลไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const isFullAccess = normalizeRoles(user).some((r) => FULL_ACCESS_ROLES.has(r));
  const isAssigned = isFullAccess || petition.assignedTo?.name === user?.name;
  const isLocked = petition.status === 'success' || !isAssigned;

  return (
    <AppLayout title={petition.petitionNo}>
      <div className={`space-y-6 pb-20 ${flashClass}`}>
        {/* Header */}
        <PageHeader
          onBack={() => navigate('/lab-testing')}
          title={
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-sky-500" />
              {petition.petitionNo}
            </span>
          }
          actions={
            <span className="text-sm text-grey-500">
              ผู้นำส่ง: {petition.submittedBy?.name ?? '-'}
            </span>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="blue-soft">{PETITION_DEPT_LABELS[petition.dept]}</Badge>
          {wasReturned && (
            <span
              className="inline-flex items-center text-orange-500"
              title="ส่งกลับมาบันทึกผลใหม่"
              aria-label="ส่งกลับมาบันทึกผลใหม่"
            >
              <RotateCcw className="h-4 w-4" />
            </span>
          )}
          {abnormalCount > 0 && (
            <span
              className="inline-flex items-center text-red-500"
              title={`พบค่าผิดปกติ ${abnormalCount} รายการ`}
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
        </div>

        {!isAssigned && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              คุณไม่ได้ถูก assign งานนี้
              {petition.assignedTo?.name && ` — มอบหมายให้: ${petition.assignedTo.name}`}
            </AlertDescription>
          </Alert>
        )}

        {/* Worklist tab strip */}
        {worklistData && worklistData.items.filter((p) =>
          (p.items ?? []).some(
            (it) =>
              isLabBatchNo(it.batchNo) &&
              matchParametersForItem(it, allParameters, idsFor(it)).length > 0,
          )
        ).length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mt-2">
            <span className="text-xs text-grey-500 shrink-0 mr-1">สลับไป:</span>
            {worklistData.items
              .filter((p) =>
                (p.items ?? []).some(
                  (it) =>
                    isLabBatchNo(it.batchNo) &&
                    matchParametersForItem(it, allParameters, idsFor(it)).length > 0,
                ),
              )
              .map((p) => {
                const isActive = p._id === petition._id;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => navigate(`/lab-testing/${p._id}`)}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition-colors',
                      isActive
                        ? 'bg-sky-500 text-white border-sky-500 cursor-default'
                        : 'bg-white text-grey-700 border-grey-200 hover:border-sky-300 hover:bg-sky-50',
                    )}
                    disabled={isActive}
                  >
                    <span className={cn('h-2 w-2 rounded-full', p.status === 'inProgress' ? 'bg-amber-400' : 'bg-blue-400')} />
                    <span className="font-semibold">{p.petitionNo}</span>
                  </button>
                );
              })}
          </div>
        )}

        {labItems.length === 0 && (
          <div className="text-center py-12 text-grey-400">ไม่มีรายการ Lab ในคำร้องนี้</div>
        )}

        {hasAnyPhasedParam && (
          <PhaseBanner
            currentPhase={currentPhase}
            selectedPhase={selectedPhase}
            onSelectPhase={setSelectedPhase}
            phase2DueAt={petition.phase2DueAt}
            phase2UnlockedAt={petition.phase2UnlockedAt}
            triggeredByName={petition.phase2TriggeredBy?.parameterName}
          />
        )}

        {/* Each Lab item */}
        {labItems.map((item) => {
          const matchedParams = matchParametersForItem(item, allParameters, idsFor(item));
          const labOwnedParams = matchedParams.filter((p) => p.scope === 'lab');
          const sharedQcParams = matchedParams.filter((p) => p.scope === 'qc' && p.shareWithLab);
          const phaseValues = valuesForPhase(effectivePhase);
          const phaseSaves = savesForPhase(effectivePhase);
          // Phase 2 is locked until petition.currentPhase advances
          const phaseLocked = effectivePhase === 2 && currentPhase === 1;
          return (
            <Card key={item.seq} className="overflow-hidden">
              <CardHeader className="bg-sky-50/60 pb-3">
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <span>รายการที่ {item.seq}: {item.sampleName || '-'}</span>
                  {item.batchNo && (
                    <Badge variant="blue-soft" className="font-normal">
                      Batch: {item.batchNo}
                    </Badge>
                  )}
                  {item.sampleId && (
                    <Badge variant="primary-soft" className="font-normal text-xs">
                      {item.sampleId}
                    </Badge>
                  )}
                </CardTitle>
                {item.testItems && (
                  <p className="text-xs text-grey-500 mt-1">รายการทดสอบ: {item.testItems}</p>
                )}
              </CardHeader>

              <CardContent className="pt-4 space-y-5">
                {matchedParams.length === 0 ? (
                  <p className="text-sm text-grey-400 italic">
                    ไม่พบพารามิเตอร์ Lab ที่ตรงกับรายการทดสอบ
                  </p>
                ) : (
                  <>
                    {/* Lab-owned parameters (editable) */}
                    {labOwnedParams.map((param) => {
                      const k = resultKey(item.seq, param._id!);
                      const fields = visibleFields(param, effectivePhase);
                      if (fields.length === 0) return null;
                      return (
                        <div key={param._id} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-grey-800 border-b pb-1 flex-1">
                              {param.name}
                            </h3>
                            <Badge className="bg-sky-100 text-sky-800 text-[10px] font-semibold uppercase hover:bg-sky-100">
                              Lab
                            </Badge>
                            {param.hasPhases && (
                              <Badge className="bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase hover:bg-amber-100">
                                Phase {effectivePhase}
                              </Badge>
                            )}
                            {param.note && (
                              <span className="text-xs text-grey-400">{param.note}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-2">
                            {fields.map((field) => {
                              if (field.type === 'reference') {
                                const { value: refValue, sourceName } = resolveReference(item.seq, field);
                                return (
                                  <ReferenceFieldDisplay
                                    key={field.label}
                                    field={field}
                                    resolvedValue={refValue}
                                    sourceName={sourceName}
                                  />
                                );
                              }
                              const noteLabel = noteLabelFor(field.label);
                              const beforeRef =
                                param.hasPhases &&
                                effectivePhase === 2 &&
                                (field.phase ?? 'both') === 'both'
                                  ? (values[k]?.[field.label] ?? '')
                                  : null;
                              return (
                                <div key={field.label}>
                                  <TestField
                                    field={field}
                                    item={item}
                                    itemGroupIds={idsFor(item)}
                                    value={phaseValues[k]?.[field.label] ?? ''}
                                    noteValue={phaseValues[k]?.[noteLabel] ?? ''}
                                    saveInfo={phaseSaves[k]?.[field.label]}
                                    noteSaveInfo={phaseSaves[k]?.[noteLabel]}
                                    disabled={isLocked || phaseLocked}
                                    onChange={(val) =>
                                      handleFieldChange(petition, item, param, field.label, val, effectivePhase)
                                    }
                                    onNoteChange={(val) =>
                                      handleFieldChange(petition, item, param, noteLabel, val, effectivePhase)
                                    }
                                  />
                                  {beforeRef != null && beforeRef !== '' ? (
                                    <p className="text-[10px] text-grey-400 mt-0.5">
                                      ก่อน: <span className="font-mono">{String(beforeRef)}</span>
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Shared QC parameters (read-only) */}
                    {sharedQcParams.map((param) => {
                      const k = resultKey(item.seq, param._id!);
                      const fields = visibleFields(param, effectivePhase);
                      if (fields.length === 0) return null;
                      return (
                        <div key={param._id} className="space-y-3 rounded-lg bg-indigo-50/40 border border-indigo-100 p-3">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-grey-800 flex-1">
                              {param.name}
                            </h3>
                            <Badge className="bg-indigo-100 text-indigo-800 text-[10px] font-semibold uppercase hover:bg-indigo-100">
                              QC กรอกแล้ว
                            </Badge>
                            {param.hasPhases && (
                              <Badge className="bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase hover:bg-amber-100">
                                Phase {effectivePhase}
                              </Badge>
                            )}
                            {param.note && (
                              <span className="text-xs text-grey-400">{param.note}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-2">
                            {fields.map((field) => {
                              if (field.type === 'reference') {
                                const { value: refValue, sourceName } = resolveReference(item.seq, field);
                                return (
                                  <ReferenceFieldDisplay
                                    key={field.label}
                                    field={field}
                                    resolvedValue={refValue}
                                    sourceName={sourceName}
                                  />
                                );
                              }
                              const noteLabel = noteLabelFor(field.label);
                              return (
                                <TestField
                                  key={field.label}
                                  field={field}
                                  item={item}
                                  itemGroupIds={idsFor(item)}
                                  value={phaseValues[k]?.[field.label] ?? ''}
                                  noteValue={phaseValues[k]?.[noteLabel] ?? ''}
                                  saveInfo={phaseSaves[k]?.[field.label]}
                                  noteSaveInfo={phaseSaves[k]?.[noteLabel]}
                                  readOnly
                                  onChange={() => {}}
                                  onNoteChange={() => {}}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Action buttons */}
        {labItems.length > 0 && petition.status !== 'success' && (
          <div className="fixed bottom-0 left-0 right-0 z-50 md:left-72 px-4 sm:px-6 py-3 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={submitting}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              บันทึกแบบร่าง
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitResult}
              disabled={submitting}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              บันทึกผล
            </Button>
          </div>
        )}

        {petition.status === 'success' && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="text-sm font-semibold text-green-700">บันทึกผลแล้ว</p>
            {abnormalCount > 0 && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                คำร้องนี้มีค่าผิดปกติ — ตรวจสอบก่อนอนุมัติ
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
