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
import { api, type ParameterItem, type ParameterValueField, type InstrumentSource, type InstrumentReading, type ValueProvenance } from '@/lib/api';
import InstrumentFetchButton from '@/components/lis/InstrumentFetchButton';
import { useAuth } from '@/hooks/useAuth';
import { useArrivalFlash } from '@/hooks/useArrivalFlash';
import { normalizeRoles } from '@/lib/roles';
import { isAssignedTo } from '@/lib/assignment';
import { labReceivedBy } from '@/lib/receiveStatus';
import { useConfirm } from '@/context/ConfirmDialog';
import { isFieldAbnormal, expandFieldForItem, resolveFieldStandard, resolveStandard, getEntryValues } from '@/lib/parameterValidation';
import { SG_FIELD_LABEL, FORM_ENTRY_INDEX_KEY } from '@/lib/formSpecificGravity';
import type { ConditionContext } from '@/lib/parameterValidation';
import { describeResolvedStandard } from '@/lib/standardOperators';
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
// Provenance for an instrument-pulled value is stored as a sibling field (same
// QCResult map) so it persists with no schema change — mirrors noteLabelFor.
const sourceLabelFor = (mainLabel: string) => `${mainLabel}__source`;

// Parse the JSON provenance blob stored in a __source sibling field.
function parseProvenance(raw: unknown): ValueProvenance | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && p.source ? (p as ValueProvenance) : undefined;
  } catch {
    return undefined;
  }
}

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
  conditionalPending?: boolean;
  resolvedStandardText?: string;
  // Instrument pull: present only when this field's label matches a configured
  // & enabled InstrumentSource. onPull receives the live reading.
  instrumentSource?: InstrumentSource;
  provenance?: ValueProvenance;
  onPull?: (reading: InstrumentReading) => void;
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
  conditionalPending,
  resolvedStandardText,
  instrumentSource,
  provenance,
  onPull,
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
        <div className="flex items-center gap-2">
          <Input
            type={field.type === 'number' || field.type === 'float' ? 'number' : 'text'}
            step={field.type === 'float' ? 'any' : undefined}
            value={strVal}
            onChange={(e) => !readOnly && onChange(e.target.value)}
            // เลื่อนเมาส์ (wheel) ห้ามเปลี่ยนค่าตัวเลข — พิมพ์อย่างเดียว: blur ทิ้งโฟกัสตอน scroll
            onWheel={(e) => {
              if (field.type === 'number' || field.type === 'float') {
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
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
          {instrumentSource && onPull && !readOnly && (
            <InstrumentFetchButton
              paramKey={instrumentSource.key}
              instrumentName={instrumentSource.instrumentName}
              onPulled={onPull}
              disabled={effectivelyDisabled}
            />
          )}
        </div>
      )}

      {/* Provenance badge: shows where an instrument-pulled value came from. */}
      {provenance && (
        <p className="text-[11px] text-indigo-600">
          {provenance.source === 'instrument-edited' ? '✎ แก้ด้วยมือ' : '📡 จากเครื่อง'}
          {provenance.instrument ? ` • ${provenance.instrument}` : ''}
          {provenance.fetchedAt
            ? ` • ${new Date(provenance.fetchedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
            : ''}
          {provenance.source === 'instrument-edited' && provenance.rawValue != null
            ? ` (เครื่อง: ${provenance.rawValue})`
            : ''}
        </p>
      )}

      {/* Live resolved-criterion line for conditionalMode fields */}
      {conditionalPending ? (
        <p className="text-[11px] text-amber-600">ยังกำหนดเกณฑ์ไม่ได้ — รอกรอกช่องเงื่อนไข</p>
      ) : resolvedStandardText ? (
        <p className="text-[11px] text-emerald-600">เกณฑ์: {resolvedStandardText}</p>
      ) : null}

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
  // Instrument sources (config) → lookup by key for the "ดึงค่า" pull button.
  // Loaded once via useEffect, mirroring the getParameters pattern below.
  const [instrumentSources, setInstrumentSources] = useState<InstrumentSource[]>([]);
  const sourceFor = useCallback(
    (fieldLabel: string): InstrumentSource | undefined =>
      instrumentSources.find((s) => s.enabled !== false && s.key === fieldLabel),
    [instrumentSources],
  );
  const groupMembership = useItemGroupMembership();
  const idsFor = (it: { sampleId?: string }) =>
    groupMembership.get(String(it?.sampleId ?? '').trim()) ?? [];
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const [savedResults, setSavedResults] = useState<QCTestResult[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [valuesPhase2, setValuesPhase2] = useState<Record<string, Record<string, unknown>>>({});
  // Local mirror of QCTestResult.entries for multiEntry params, keyed by resultKey.
  const [entriesByKey, setEntriesByKey] = useState<Record<string, Record<string, unknown>[]>>({});
  // How many entry cards to show per multiEntry resultKey (user-driven via "เพิ่มรายการ").
  // Effective count = max(this, savedEntries.length, 1) — never hides saved data, always ≥1 empty form.
  const [entryRowCounts, setEntryRowCounts] = useState<Record<string, number>>({});
  const [saveStates, setSaveStates] = useState<Record<string, Record<string, FieldSaveInfo>>>({});
  const [saveStatesPhase2, setSaveStatesPhase2] = useState<Record<string, Record<string, FieldSaveInfo>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [wasReturned, setWasReturned] = useState(false);
  const [redoExplanation, setRedoExplanation] = useState('');
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

  // Load instrument sources once (for the live-pull button).
  useEffect(() => {
    api.getInstrumentSources()
      .then((rows) => setInstrumentSources(rows ?? []))
      .catch(() => {});
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

  const loadResults = useCallback((petitionId: string) => {
    return api.getQCResults(petitionId).then((results) => {
      setSavedResults(results);
      const v: Record<string, Record<string, unknown>> = {};
      const v2: Record<string, Record<string, unknown>> = {};
      const en: Record<string, Record<string, unknown>[]> = {};
      const s: Record<string, Record<string, FieldSaveInfo>> = {};
      const s2: Record<string, Record<string, FieldSaveInfo>> = {};
      results.forEach((r) => {
        const k = resultKey(r.itemSeq, r.parameterId);
        v[k] = { ...(r.values as Record<string, unknown>) };
        v2[k] = { ...((r.valuesPhase2 ?? {}) as Record<string, unknown>) };
        if (Array.isArray(r.entries)) {
          en[k] = (r.entries as Record<string, unknown>[]).map((e) => ({ ...(e ?? {}) }));
        }
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
      setEntriesByKey(en);
      setSaveStates(s);
      setSaveStatesPhase2(s2);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    loadResults(id);
  }, [id, loadResults]);

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

  // multiEntry write: field write into entry `entryIndex` of a multiEntry param.
  // Optimistically mirrors entriesByKey and persists via saveQCResult({ entryIndex }).
  const handleEntryFieldChange = useCallback(
    (
      petition: Petition,
      item: PetitionItem,
      param: ParameterItem,
      entryIndex: number,
      fieldLabel: string,
      newVal: unknown,
    ) => {
      const k = resultKey(item.seq, param._id!);
      advanceToInProgress();

      setEntriesByKey((prev) => {
        const list = (prev[k] ?? []).map((e) => ({ ...(e ?? {}) }));
        while (list.length <= entryIndex) list.push({});
        list[entryIndex] = { ...list[entryIndex], [fieldLabel]: newVal };
        return { ...prev, [k]: list };
      });

      const debounceKey = `${k}__entry${entryIndex}__${fieldLabel}`;
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
            entryIndex,
            enteredBy: { name: user?.name ?? 'Unknown', email: user?.email ?? '' },
          });
          if (id) await loadResults(id);
        } catch {
          toast.error('บันทึกค่าไม่สำเร็จ');
        }
      }, 800);
    },
    [user, advanceToInProgress, id, loadResults],
  );

  // multiEntry remove: trim entry `entryIndex` then persist the whole array.
  const handleRemoveEntry = useCallback(
    async (
      petition: Petition,
      item: PetitionItem,
      param: ParameterItem,
      entryIndex: number,
    ) => {
      const k = resultKey(item.seq, param._id!);
      const current = getEntryValues({ entries: entriesByKey[k] }, param);
      const trimmed = current.filter((_, i) => i !== entryIndex);
      setEntriesByKey((prev) => ({ ...prev, [k]: trimmed.map((e) => ({ ...(e ?? {}) })) }));
      try {
        await api.saveQCEntries({
          petitionId: petition._id!,
          petitionNo: petition.petitionNo,
          itemSeq: item.seq,
          sampleId: item.sampleId,
          sampleName: item.sampleName,
          parameterId: param._id!,
          parameterName: param.name,
          entries: trimmed,
          enteredBy: { name: user?.name ?? 'Unknown', email: user?.email ?? '' },
        });
        if (id) await loadResults(id);
      } catch {
        toast.error('ลบรายการไม่สำเร็จ');
      }
    },
    [user, entriesByKey, id, loadResults],
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

  // current array value for a `multiple` field (always returns an array for editing)
  const readMultiple = (vals: Record<string, unknown> | undefined, label: string): unknown[] => {
    const v = vals?.[label];
    return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);
  };

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

  // Count abnormal values across one value-object's render units.
  // Handles field-level `multiple` (each array element counts individually).
  const countAbnormalInValues = (
    fieldsToScan: ParameterValueField[],
    item: PetitionItem,
    src: Record<string, unknown>,
  ): number => {
    let count = 0;
    fieldsToScan.forEach((field) => {
      expandFieldForItem(field, item.commonName).forEach((unit) => {
        if (unit.field.multiple) {
          readMultiple(src, unit.key).forEach((v) => {
            if (isFieldAbnormal(unit.field, v)) count += 1;
          });
        } else if (isFieldAbnormal(unit.field, src[unit.key])) {
          count += 1;
        }
      });
    });
    return count;
  };

  const countAbnormal = (): number => {
    let count = 0;
    labItems.forEach((item) => {
      const matched = matchParametersForItem(item, allParameters, idsFor(item));
      matched.forEach((param) => {
        if (param.scope !== 'lab') return; // skip read-only shared QC params
        const k = resultKey(item.seq, param._id!);
        const p1Fields = (param.valueFields ?? []).filter((f) => (f.phase ?? 'both') !== 'after');
        // multiEntry: scan every entry; otherwise the flat phase-1 dict.
        if (param.multiEntry) {
          getEntryValues({ entries: entriesByKey[k] }, param).forEach((entryValues) => {
            count += countAbnormalInValues(p1Fields, item, entryValues);
          });
        } else {
          count += countAbnormalInValues(p1Fields, item, values[k] ?? {});
        }
        // Check Phase 2 values for both/after fields if phased
        if (param.hasPhases) {
          const p2Values = valuesPhase2[k] ?? {};
          const p2Fields = (param.valueFields ?? []).filter((f) => (f.phase ?? 'both') !== 'before');
          count += countAbnormalInValues(p2Fields, item, p2Values);
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
        // multiEntry params validate each existing entry; otherwise the flat dict.
        // (For multiEntry we only consider phase 1 — multiEntry + phases don't combine.)
        const valueObjs: { values: Record<string, unknown>; suffix: string }[] =
          param.multiEntry
            ? getEntryValues({ entries: entriesByKey[k] }, param).map((e, i) => ({
                values: e,
                suffix: ` (รายการที่ ${i + 1})`,
              }))
            : [{ values: phaseValues[k] ?? {}, suffix: '' }];
        visibleFields(param, phaseToCheck).forEach((field) => {
          if (field.type === 'reference') return; // reference fields are auto-resolved
          expandFieldForItem(field, item.commonName).forEach((unit) => {
            valueObjs.forEach(({ values: itemValues, suffix }) => {
              const val = itemValues[unit.key];
              // field-level `multiple` — required means at least one non-empty element
              if (unit.field.multiple) {
                if (unit.field.required) {
                  const arr = readMultiple(itemValues, unit.key);
                  const hasOne = arr.some((v) => v != null && String(v).trim() !== '');
                  if (!hasOne) {
                    missing.push(`รายการ ${item.seq} › ${param.name} › ${unit.field.label}${suffix}`);
                  }
                }
                return;
              }
              if (unit.field.required && (val == null || String(val).trim() === '')) {
                missing.push(`รายการ ${item.seq} › ${param.name} › ${unit.field.label}${suffix}`);
                return;
              }
              if (
                unit.field.type === 'enum' &&
                (unit.field.requireNoteOn ?? []).includes(String(val ?? ''))
              ) {
                const noteVal = itemValues[noteLabelFor(unit.key)];
                if (!noteVal || String(noteVal).trim() === '') {
                  missing.push(`รายการ ${item.seq} › ${param.name} › ${unit.field.label} (คำอธิบาย)${suffix}`);
                }
              }
            });
          });
        });
      });
    });
    return missing;
  };

  // required ครบทุกช่องของ phase ปัจจุบัน → ปุ่มเปลี่ยนจาก "บันทึกแบบร่าง" เป็น "บันทึก" (ปิด track)
  const isComplete = validate(effectivePhase).length === 0;

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
    if (petition.labReturnNote && !redoExplanation.trim()) {
      toast.error('กรุณาอธิบายว่าทำใหม่อย่างไร', { description: 'คำร้องนี้เคยถูกส่งกลับให้แก้ไข' });
      return;
    }
    // ปิด track แล้วหน้าจะ lock แก้ไม่ได้ → confirm ทุกครั้ง (รวมเตือนค่าผิดปกติใน dialog เดียว)
    const ok = await confirm({
      title: 'ยืนยันบันทึกผล',
      description:
        abnormalCount > 0
          ? `พบค่าผิดปกติ ${abnormalCount} รายการ — หลังบันทึกแล้วจะแก้ไขไม่ได้ ยืนยันบันทึกผล?`
          : 'หลังบันทึกแล้วจะแก้ไขไม่ได้ ยืนยันบันทึกผล?',
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      const updated = await api.completePetitionTrack(
        petition._id, 'lab', user?.name ?? 'system', redoExplanation.trim() || undefined,
      );
      toast.success(
        updated.status === 'success'
          ? 'บันทึกผล Lab เรียบร้อย — ส่งให้หัวหน้า QC ยืนยัน'
          : 'บันทึกผล Lab เรียบร้อย — รอหัวหน้า Lab อนุมัติ',
      );
      navigate('/lab-testing');
    } catch {
      toast.error('บันทึกผลไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const isFullAccess = normalizeRoles(user).some((r) => FULL_ACCESS_ROLES.has(r));
  const isAssigned = isFullAccess || isAssignedTo(petition.assignedTo, user);
  const isLocked = petition.status === 'success' || !!petition.labCompletedAt || !isAssigned;

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
              {labReceivedBy(petition) && ` · ผู้รับงาน: ${labReceivedBy(petition)}`}
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
                      // Build the condition context for resolving conditionalMode standards:
                      // sameParam = this parameter's live values; otherParams = each OTHER
                      // matched parameter's live values for the same item, keyed by parameterId.
                      const condCtx: ConditionContext = {
                        sameParam: phaseValues[k] ?? {},
                        otherParams: (() => {
                          const out: Record<string, Record<string, unknown>> = {};
                          matchedParams.forEach((p) => {
                            if (!p._id || p._id === param._id) return;
                            out[String(p._id)] = phaseValues[resultKey(item.seq, p._id)] ?? {};
                          });
                          return out;
                        })(),
                      };
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
                          {(() => {
                            const fieldDisabled = isLocked || phaseLocked;

                            // Render a single editable render-unit. `srcValues` is the
                            // value-object to read/display from; `onUnitChange` persists a
                            // write. For multiEntry params these target an entry value-
                            // object (instrument-pull/provenance/beforeRef omitted there);
                            // otherwise the flat phase dict (full scalar behavior).
                            const renderEditUnit = (
                              unit: { key: string; field: ParameterValueField },
                              srcValues: Record<string, unknown>,
                              onUnitChange: (label: string, val: unknown) => void,
                              saveInfoSrc: Record<string, FieldSaveInfo> | undefined,
                              scalarExtras: boolean,
                            ) => {
                              const noteLabel = noteLabelFor(unit.key);
                              const effectiveField = unit.field.conditionalMode
                                ? resolveFieldStandard(unit.field, condCtx)
                                : unit.field;
                              const resolved = unit.field.conditionalMode
                                ? resolveStandard(unit.field, condCtx)
                                : null;
                              const resolvedStandardText = resolved
                                ? `${describeResolvedStandard(resolved, unit.field.unit ?? '')}${resolved.matchedRuleLabel ? ` (${resolved.matchedRuleLabel})` : ''}`
                                : undefined;

                              // Field-level `multiple` — repeatable list of bare value rows.
                              // Each row shares the field's standard/abnormal rule; per-row
                              // save stamps / instrument-pull / beforeRef are intentionally
                              // omitted (mirrors QC). The field value is the WHOLE array.
                              if (unit.field.multiple) {
                                const arr = readMultiple(srcValues, unit.key);
                                const rows = [...arr, '']; // trailing empty row to add next
                                const writeRow = (i: number, rowVal: unknown) => {
                                  const next = [...readMultiple(srcValues, unit.key)];
                                  while (next.length <= i) next.push('');
                                  next[i] = rowVal;
                                  onUnitChange(unit.key, next);
                                };
                                const removeRow = (i: number) => {
                                  const next = readMultiple(srcValues, unit.key).filter((_, idx) => idx !== i);
                                  onUnitChange(unit.key, next);
                                };
                                return (
                                  <div key={unit.key} className="space-y-2 rounded-md border border-grey-200 p-2">
                                    <p className="text-sm font-medium text-grey-700">
                                      {unit.field.label}
                                      {unit.field.unit && <span className="text-grey-400 font-normal ml-1">({unit.field.unit})</span>}
                                    </p>
                                    {rows.map((rowVal, i) => {
                                      const isExisting = i < arr.length;
                                      return (
                                        <div key={i} className="flex items-end gap-2">
                                          <div className="flex-1">
                                            <TestField
                                              field={{ ...effectiveField, label: `ค่าที่ ${i + 1}`, multiple: false, required: false }}
                                              item={item}
                                              itemGroupIds={idsFor(item)}
                                              value={rowVal ?? ''}
                                              noteValue={''}
                                              disabled={fieldDisabled}
                                              onChange={(val) => writeRow(i, val)}
                                              onNoteChange={() => {}}
                                            />
                                          </div>
                                          {isExisting && !fieldDisabled && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="text-red-500 hover:text-red-600"
                                              onClick={() => removeRow(i)}
                                            >
                                              ลบ
                                            </Button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }

                              // scalar path — full feature set only for the flat phase dict
                              // (scalarExtras); multiEntry entries route writes via onUnitChange.
                              const beforeRef =
                                scalarExtras &&
                                param.hasPhases &&
                                effectivePhase === 2 &&
                                (unit.field.phase ?? 'both') === 'both'
                                  ? (values[k]?.[unit.key] ?? '')
                                  : null;
                              const srcField = scalarExtras ? sourceFor(unit.field.label) : undefined;
                              const sourceLabel = sourceLabelFor(unit.key);
                              const provenance = scalarExtras
                                ? parseProvenance(srcValues[sourceLabel])
                                : undefined;
                              return (
                                <div key={unit.key}>
                                  <TestField
                                    field={effectiveField}
                                    item={item}
                                    itemGroupIds={idsFor(item)}
                                    value={srcValues[unit.key] ?? ''}
                                    noteValue={srcValues[noteLabel] ?? ''}
                                    saveInfo={saveInfoSrc?.[unit.key]}
                                    noteSaveInfo={saveInfoSrc?.[noteLabel]}
                                    disabled={fieldDisabled}
                                    instrumentSource={srcField}
                                    provenance={provenance}
                                    onPull={
                                      scalarExtras
                                        ? (reading) => {
                                            onUnitChange(unit.key, String(reading.value ?? ''));
                                            const prov: ValueProvenance = {
                                              source: 'instrument',
                                              instrument: reading.instrument,
                                              rawValue: reading.value,
                                              fetchedAt: reading.readingAt ?? new Date().toISOString(),
                                              fetchedBy: user?.name ?? 'Unknown',
                                            };
                                            onUnitChange(sourceLabel, JSON.stringify(prov));
                                          }
                                        : undefined
                                    }
                                    onChange={(val) => {
                                      onUnitChange(unit.key, val);
                                      // Manual edit after a pull → mark provenance as edited (once).
                                      if (scalarExtras && provenance && provenance.source === 'instrument' && String(val) !== String(provenance.rawValue ?? '')) {
                                        onUnitChange(sourceLabel, JSON.stringify({ ...provenance, source: 'instrument-edited' }));
                                      }
                                    }}
                                    onNoteChange={(val) => onUnitChange(noteLabel, val)}
                                    conditionalPending={!!unit.field.conditionalMode && !resolved}
                                    resolvedStandardText={resolvedStandardText}
                                  />
                                  {beforeRef != null && beforeRef !== '' ? (
                                    <p className="text-[10px] text-grey-400 mt-0.5">
                                      ก่อน: <span className="font-mono">{String(beforeRef)}</span>
                                    </p>
                                  ) : null}
                                </div>
                              );
                            };

                            // Field-grid for one value-object (flat dict or one entry).
                            const renderEditGrid = (
                              srcValues: Record<string, unknown>,
                              onUnitChange: (label: string, val: unknown) => void,
                              saveInfoSrc: Record<string, FieldSaveInfo> | undefined,
                              scalarExtras: boolean,
                            ) => (
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
                                  const units = expandFieldForItem(field, item.commonName);
                                  return units.map((unit) => renderEditUnit(unit, srcValues, onUnitChange, saveInfoSrc, scalarExtras));
                                })}
                              </div>
                            );

                            if (param.multiEntry) {
                              // Per-entry rendering. Saved entries come from entries[]; the
                              // number of cards shown is user-driven (เพิ่มรายการ), never auto.
                              // Entry writes route through handleEntryFieldChange (no instrument-pull).
                              const savedRows = entriesByKey[k] ?? [];
                              const savedCount = savedRows.length;
                              const shown = Math.max(entryRowCounts[k] ?? 0, savedCount, 1);
                              const removeRow = (ei: number) => {
                                if (ei < savedCount) handleRemoveEntry(petition, item, param, ei);
                                setEntryRowCounts((c) =>
                                  c[k] == null ? c : { ...c, [k]: Math.max(c[k] - 1, 1) },
                                );
                              };
                              return (
                                <div className="space-y-4">
                                  {Array.from({ length: shown }, (_, ei) => {
                                    const entryValues = savedRows[ei] ?? {};
                                    const canRemove = !fieldDisabled && (shown > 1 || ei < savedCount);
                                    return (
                                      <div key={ei} className="rounded-lg border border-grey-200 p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-grey-600 flex-1">
                                            รายการที่ {ei + 1}
                                          </span>
                                          {canRemove && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="text-red-500 hover:text-red-600"
                                              onClick={() => removeRow(ei)}
                                            >
                                              ลบรายการ
                                            </Button>
                                          )}
                                        </div>
                                        {renderEditGrid(
                                          entryValues,
                                          (label, val) => handleEntryFieldChange(petition, item, param, ei, label, val),
                                          undefined,
                                          false,
                                        )}
                                      </div>
                                    );
                                  })}
                                  {!fieldDisabled && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEntryRowCounts((c) => ({ ...c, [k]: shown + 1 }))}
                                    >
                                      + เพิ่มรายการ
                                    </Button>
                                  )}
                                </div>
                              );
                            }

                            return renderEditGrid(
                              phaseValues[k] ?? {},
                              (label, val) => handleFieldChange(petition, item, param, label, val, effectivePhase),
                              phaseSaves[k],
                              true,
                            );
                          })()}
                        </div>
                      );
                    })}

                    {/* Shared QC parameters (read-only) */}
                    {sharedQcParams.map((param) => {
                      const k = resultKey(item.seq, param._id!);
                      const fields = visibleFields(param, effectivePhase);
                      if (fields.length === 0) return null;
                      // Build the condition context for resolving conditionalMode standards:
                      // sameParam = this parameter's live values; otherParams = each OTHER
                      // matched parameter's live values for the same item, keyed by parameterId.
                      const condCtx: ConditionContext = {
                        sameParam: phaseValues[k] ?? {},
                        otherParams: (() => {
                          const out: Record<string, Record<string, unknown>> = {};
                          matchedParams.forEach((p) => {
                            if (!p._id || p._id === param._id) return;
                            out[String(p._id)] = phaseValues[resultKey(item.seq, p._id)] ?? {};
                          });
                          return out;
                        })(),
                      };
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
                          {(() => {
                            // Read-only render of one render-unit from a value-object.
                            // Field-level `multiple` lists each array value read-only
                            // (no add/remove inputs); scalar uses the read-only TestField.
                            const renderReadUnit = (
                              unit: { key: string; field: ParameterValueField },
                              srcValues: Record<string, unknown>,
                              saveInfoSrc: Record<string, FieldSaveInfo> | undefined,
                            ) => {
                              const noteLabel = noteLabelFor(unit.key);
                              const effectiveField = unit.field.conditionalMode
                                ? resolveFieldStandard(unit.field, condCtx)
                                : unit.field;
                              const resolved = unit.field.conditionalMode
                                ? resolveStandard(unit.field, condCtx)
                                : null;
                              const resolvedStandardText = resolved
                                ? `${describeResolvedStandard(resolved, unit.field.unit ?? '')}${resolved.matchedRuleLabel ? ` (${resolved.matchedRuleLabel})` : ''}`
                                : undefined;

                              if (unit.field.multiple) {
                                const arr = readMultiple(srcValues, unit.key);
                                return (
                                  <div key={unit.key} className="space-y-2 rounded-md border border-grey-200 p-2">
                                    <p className="text-sm font-medium text-grey-700">
                                      {unit.field.label}
                                      {unit.field.unit && <span className="text-grey-400 font-normal ml-1">({unit.field.unit})</span>}
                                    </p>
                                    {arr.length === 0 ? (
                                      <p className="text-xs text-grey-400 italic">— ไม่มีค่า —</p>
                                    ) : (
                                      arr.map((rowVal, i) => (
                                        <TestField
                                          key={i}
                                          field={{ ...effectiveField, label: `ค่าที่ ${i + 1}`, multiple: false, required: false }}
                                          item={item}
                                          itemGroupIds={idsFor(item)}
                                          value={rowVal ?? ''}
                                          noteValue={''}
                                          readOnly
                                          onChange={() => {}}
                                          onNoteChange={() => {}}
                                        />
                                      ))
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <TestField
                                  key={unit.key}
                                  field={effectiveField}
                                  item={item}
                                  itemGroupIds={idsFor(item)}
                                  value={srcValues[unit.key] ?? ''}
                                  noteValue={srcValues[noteLabel] ?? ''}
                                  saveInfo={saveInfoSrc?.[unit.key]}
                                  noteSaveInfo={saveInfoSrc?.[noteLabel]}
                                  readOnly
                                  onChange={() => {}}
                                  onNoteChange={() => {}}
                                  conditionalPending={!!unit.field.conditionalMode && !resolved}
                                  resolvedStandardText={resolvedStandardText}
                                />
                              );
                            };

                            const renderReadGrid = (
                              srcValues: Record<string, unknown>,
                              saveInfoSrc: Record<string, FieldSaveInfo> | undefined,
                            ) => (
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
                                  const units = expandFieldForItem(field, item.commonName);
                                  return units.map((unit) => renderReadUnit(unit, srcValues, saveInfoSrc));
                                })}
                              </div>
                            );

                            if (param.multiEntry) {
                              // Read-only: one card per saved entry (no trailing add card).
                              const entryRows = getEntryValues({ entries: entriesByKey[k] }, param);
                              if (entryRows.length === 0) {
                                return <p className="text-xs text-grey-400 italic pl-2">— QC ยังไม่กรอกรายการ —</p>;
                              }
                              // ถ้าเป็นพารามิเตอร์ ค่า ถพ. และมีหลายค่า → ให้ Lab เลือกค่าที่จะลงในใบคำขอรับบริการ
                              const isSgParam = (param.valueFields ?? []).some((f) => f.label === SG_FIELD_LABEL);
                              const showFormPicker = isSgParam && entryRows.length > 1;
                              const rawChosen = Number(values[k]?.[FORM_ENTRY_INDEX_KEY] ?? 0);
                              const chosenIdx =
                                Number.isFinite(rawChosen) && rawChosen >= 0 && rawChosen < entryRows.length
                                  ? rawChosen
                                  : 0;
                              return (
                                <div className="space-y-4">
                                  {showFormPicker && (
                                    <div className="flex items-center gap-2 rounded-md bg-white border border-indigo-200 px-3 py-2">
                                      <span className="text-xs font-semibold text-grey-700">ค่าที่ใช้ในใบคำขอรับบริการ:</span>
                                      <Select
                                        value={String(chosenIdx)}
                                        onValueChange={(v) =>
                                          handleFieldChange(petition, item, param, FORM_ENTRY_INDEX_KEY, Number(v), 1)
                                        }
                                        disabled={isLocked}
                                      >
                                        <SelectTrigger className="h-8 w-40 text-sm">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {entryRows.map((ev, ei) => (
                                            <SelectItem key={ei} value={String(ei)}>
                                              รายการที่ {ei + 1}
                                              {ev?.[SG_FIELD_LABEL] != null && ev[SG_FIELD_LABEL] !== ''
                                                ? ` (${ev[SG_FIELD_LABEL]})`
                                                : ''}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {entryRows.map((entryValues, ei) => (
                                    <div
                                      key={ei}
                                      className={`rounded-lg border p-3 space-y-2 ${
                                        showFormPicker && ei === chosenIdx
                                          ? 'border-indigo-400 bg-indigo-50/60'
                                          : 'border-grey-200'
                                      }`}
                                    >
                                      <span className="text-xs font-semibold text-grey-600">
                                        รายการที่ {ei + 1}
                                        {showFormPicker && ei === chosenIdx && (
                                          <span className="ml-1 text-indigo-700">← ใช้บนฟอร์ม</span>
                                        )}
                                      </span>
                                      {renderReadGrid(entryValues, undefined)}
                                    </div>
                                  ))}
                                </div>
                              );
                            }

                            return renderReadGrid(phaseValues[k] ?? {}, phaseSaves[k]);
                          })()}
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* banner เหตุผลส่งกลับ + ช่องอธิบายทำใหม่ (เฉพาะตอนยังกรอก/แก้อยู่) */}
        {!petition.labCompletedAt && petition.labReturnNote && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-orange-700 flex items-center gap-1">
              <RotateCcw className="h-4 w-4" /> ถูกส่งกลับให้แก้ไข
            </p>
            <p className="text-sm text-orange-800">{petition.labReturnNote}</p>
            <label className="block text-xs font-medium text-gray-600 mt-2">อธิบายว่าทำใหม่อย่างไร (จำเป็น)</label>
            <textarea
              value={redoExplanation}
              onChange={(e) => setRedoExplanation(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-orange-400"
              placeholder="เช่น คาลิเบรตเครื่องใหม่แล้วทดสอบซ้ำ"
            />
          </div>
        )}

        {/* Action buttons — เฉพาะตอนผู้ทดสอบยังไม่ยืนยัน */}
        {labItems.length > 0 && !petition.labCompletedAt && (
          <div className="fixed bottom-0 left-0 right-0 z-50 md:left-72 px-4 sm:px-6 py-3 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Button
              variant={isComplete ? 'primary' : 'outline'}
              onClick={isComplete ? handleSubmitResult : handleSaveDraft}
              disabled={submitting}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isComplete ? <Send className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {isComplete ? 'บันทึก' : 'บันทึกแบบร่าง'}
            </Button>
          </div>
        )}

        {/* รอหัวหน้า Lab อนุมัติ */}
        {labItems.length > 0 && petition.labCompletedAt && !petition.labApprovedAt && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 className="h-6 w-6 text-amber-500" />
              <p className="text-sm font-semibold text-amber-700">บันทึกผลแล้ว — รอหัวหน้า Lab อนุมัติ</p>
              {abnormalCount > 0 && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5" />คำร้องนี้มีค่าผิดปกติ {abnormalCount} รายการ
                </p>
              )}
            </div>
          </div>
        )}

        {/* Lab อนุมัติแล้ว */}
        {petition.labApprovedAt && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="text-sm font-semibold text-green-700">Lab อนุมัติแล้ว</p>
            {petition.labApprovedBy && <p className="text-xs text-gray-500">โดย {petition.labApprovedBy}</p>}
          </div>
        )}

      </div>
    </AppLayout>
  );
}
