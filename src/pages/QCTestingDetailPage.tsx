import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { FlaskConical, CheckCircle2, Loader2, AlertCircle, AlertTriangle, RotateCcw, Save, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/lis/AppLayout';
import PageHeader from '@/components/lis/PageHeader';
import { usePetition, usePetitionList } from '@/hooks/usePetition';
import { api, type ParameterItem, type ParameterValueField } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useArrivalFlash } from '@/hooks/useArrivalFlash';
import { useConfirm } from '@/context/ConfirmDialog';
import { isFieldAbnormal, expandFieldForItem, resolveFieldStandard, resolveStandard } from '@/lib/parameterValidation';
import type { ConditionContext } from '@/lib/parameterValidation';
import { describeResolvedStandard } from '@/lib/standardOperators';
import { cn } from '@/lib/utils';
import { TimerField } from '@/components/lis/TimerField';
import { PhotoField } from '@/components/lis/PhotoField';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RevisionRequestDialog } from '@/components/petition/RevisionRequestDialog';
import { buildPreviousValueLookup, getPreviousValue, type PreviousValueLookup } from '@/lib/revisionHelpers';
import { qcReceivedBy } from '@/lib/receiveStatus';
import { AiOutlierBadge } from '@/components/lis/AiOutlierBadge';
import { checkOutlier, getOllamaStatus, streamAnalyzeQC, type OutlierCheckResult } from '@/lib/aiApi';

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

function resultKey(itemSeq: number, parameterId: string) {
  return `${itemSeq}__${parameterId}`;
}

export const noteLabelFor = (mainLabel: string) => `${mainLabel}__note`;

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
  previousValue?: unknown;
  conditionalPending?: boolean;
  resolvedStandardText?: string;
  lastBatchValue?: unknown;
  lastBatchLabel?: string;
  outlierResult?: OutlierCheckResult | null;
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
  previousValue,
  conditionalPending,
  resolvedStandardText,
  lastBatchValue,
  lastBatchLabel,
  outlierResult,
}: TestFieldProps) {
  const strVal = value == null ? '' : String(value);
  const strNote = noteValue == null ? '' : String(noteValue);
  const requireNoteOn = field.requireNoteOn ?? [];
  const showNote = field.type === 'enum' && requireNoteOn.includes(strVal);
  const isAbnormal = isFieldAbnormal(field, value);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-grey-700">
          {field.label}
          {field.unit && <span className="text-grey-400 font-normal ml-1">({field.unit})</span>}
          {field.required && <span className="text-red-500 ml-1">*</span>}
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
        {/* save state indicator */}
        {saveInfo?.state === 'saving' && (
          <Loader2 className="h-3 w-3 animate-spin text-grey-400" />
        )}
        {saveInfo?.state === 'saved' && (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        )}
        {saveInfo?.state === 'error' && (
          <AlertCircle className="h-3 w-3 text-red-400" />
        )}
      </div>

      {/* Input by type */}
      {field.type === 'timer' ? (
        <TimerField field={field} value={value} onChange={onChange} disabled={disabled} />
      ) : field.type === 'enum' ? (
        <Select value={strVal || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)} disabled={disabled}>
          <SelectTrigger
            className={cn(
              'h-8 text-sm',
              isAbnormal && 'border-red-400 ring-1 ring-red-200',
            )}
          >
            <SelectValue placeholder="เลือกค่า..." />
          </SelectTrigger>
          <SelectContent>
            {/* onSelect fires on every selection (even same value) so the latest editor is always recorded */}
            <SelectItem value="__none__" onSelect={() => onChange('')}>— เลือก —</SelectItem>
            {(() => {
              const visible = visibleEnumOptions(field, item, itemGroupIds);
              const savedOutOfScope = strVal && !visible.includes(strVal);
              return (
                <>
                  {visible.map((opt) => (
                    <SelectItem key={opt} value={opt} onSelect={() => onChange(opt)}>{opt}</SelectItem>
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
        <PhotoField
          field={field}
          value={Array.isArray(value) ? value as string[] : []}
          onChange={onChange as (urls: string[]) => void}
          disabled={disabled}
        />
      ) : (
        <Input
          type={field.type === 'number' || field.type === 'float' ? 'number' : 'text'}
          step={field.type === 'float' ? 'any' : undefined}
          min={field.type !== 'text' ? (field as any).min : undefined}
          max={field.type !== 'text' ? (field as any).max : undefined}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'h-8 text-sm',
            isAbnormal && 'border-red-400 ring-1 ring-red-200',
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

      {/* Live resolved-criterion line for conditionalMode fields */}
      {conditionalPending ? (
        <p className="text-[11px] text-amber-600">ยังกำหนดเกณฑ์ไม่ได้ — รอกรอกช่องเงื่อนไข</p>
      ) : resolvedStandardText ? (
        <p className="text-[11px] text-emerald-600">เกณฑ์: {resolvedStandardText}</p>
      ) : null}

      {field.showLastBatch && lastBatchValue != null && String(lastBatchValue) !== "" && (
        <p className="text-[11px] text-sky-600">
          แบชก่อน{lastBatchLabel ? ` (${lastBatchLabel})` : ""}: {String(lastBatchValue)}{field.unit ? ` ${field.unit}` : ""}
        </p>
      )}
      <AiOutlierBadge result={outlierResult} />

      {/* Conditional note input — appears when enum value requires explanation */}
      {showNote && (
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
            disabled={disabled}
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

      {/* who saved */}
      {saveInfo?.state === 'saved' && saveInfo.savedBy && (
        <p className="text-xs text-grey-400">
          กรอกโดย {saveInfo.savedBy} เมื่อ {formatTime(saveInfo.savedAt)}
        </p>
      )}
      {saveInfo?.state === 'error' && (
        <p className="text-xs text-red-400">บันทึกไม่สำเร็จ</p>
      )}
      {previousValue !== undefined && previousValue !== '' && previousValue !== null && (
        <p
          className={cn(
            'mt-1 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-sm',
            isFieldAbnormal(field, previousValue)
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-grey-200 bg-grey-50 text-grey-700',
          )}
        >
          <span className="font-medium">ค่าเดิม:</span>
          <span className="font-mono font-semibold text-base">{String(previousValue)}</span>
          {isFieldAbnormal(field, previousValue) && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </p>
      )}
    </div>
  );
}

export default function QCTestingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const flashClass = useArrivalFlash();

  const { data: petition, loading: petitionLoading, error: petitionError } = usePetition(id);
  // Active worklist for tab-strip switcher (other petitions currently in QC)
  const { data: worklistData } = usePetitionList({
    status: 'pendingReview,inProgress',
    limit: 20,
  });
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const groupMembership = useItemGroupMembership();
  const idsFor = (it: { sampleId?: string }) =>
    groupMembership.get(String(it?.sampleId ?? '').trim()) ?? [];
  const [savedResults, setSavedResults] = useState<QCTestResult[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [valuesPhase2, setValuesPhase2] = useState<Record<string, Record<string, unknown>>>({});
  // key: resultKey(itemSeq, parameterId) → { fieldLabel → FieldSaveInfo }
  const [saveStates, setSaveStates] = useState<Record<string, Record<string, FieldSaveInfo>>>({});
  const [saveStatesPhase2, setSaveStatesPhase2] = useState<Record<string, Record<string, FieldSaveInfo>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [wasReturned, setWasReturned] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<PetitionPhase>(1);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [previousLookup, setPreviousLookup] = useState<PreviousValueLookup>(new Map());
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [outlierResults, setOutlierResults] = useState<Record<string, OutlierCheckResult>>({});
  const [copyPasteWarnings, setCopyPasteWarnings] = useState<Record<string, boolean>>({});
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeText, setAnalyzeText] = useState('');

  // Load parameters and existing results (QC scope only)
  useEffect(() => {
    api.getParameters()
      .then((all) => setParameters(all.filter((p) => (p.scope ?? 'qc') === 'qc')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getOllamaStatus().then((s) => setOllamaAvailable(s.available));
  }, []);

  // Auto-advance status pendingReview → inProgress when QC enters the first value
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

  // Resolve the predecessor petition for inline comparison.
  // Two paths: explicit (petition.revisionOf set via "ยื่นแก้ไขใหม่" button) OR
  // implicit (a rejected petition exists with same submitter employeeId + a
  // matching batchNo). QC sees the link either way; the submitter need not know.
  const [implicitPredecessorNo, setImplicitPredecessorNo] = useState<string | null>(null);
  useEffect(() => {
    if (!petition) {
      setPreviousLookup(new Map());
      setImplicitPredecessorNo(null);
      setWasReturned(false);
      return;
    }
    let alive = true;

    const loadFromPredecessor = async (predecessorId: string, predecessorNo?: string) => {
      try {
        const [prevPetition, prevResults] = await Promise.all([
          api.getPetition(predecessorId),
          api.getQCResults(predecessorId),
        ]);
        if (!alive) return;
        setPreviousLookup(buildPreviousValueLookup(prevPetition.items, prevResults));
        setImplicitPredecessorNo(predecessorNo ?? prevPetition.petitionNo ?? null);
        setWasReturned(true);
      } catch {
        if (alive) {
          setPreviousLookup(new Map());
          setImplicitPredecessorNo(null);
        }
      }
    };

    if (petition.revisionOf) {
      loadFromPredecessor(String(petition.revisionOf));
      return () => { alive = false; };
    }

    // No explicit revisionOf — try to detect via batch + submitter
    const submitterEmpId = petition.submittedBy?.employeeId?.trim();
    const batches = Array.from(
      new Set((petition.items ?? []).map((it) => it.batchNo?.trim()).filter((b): b is string => !!b)),
    );
    if (!submitterEmpId || batches.length === 0) {
      setPreviousLookup(new Map());
      setImplicitPredecessorNo(null);
      setWasReturned(false);
      return;
    }
    (async () => {
      try {
        const results = await Promise.all(
          batches.map((b) => api.findRejectedByBatch(b, submitterEmpId).catch(() => [] as typeof petition[])),
        );
        if (!alive) return;
        const flat = results.flat().filter((p) => p._id !== petition._id);
        if (flat.length === 0) {
          setPreviousLookup(new Map());
          setImplicitPredecessorNo(null);
          setWasReturned(false);
          return;
        }
        // Pick the most recently rejected (endpoint already sorts by rejectedAt desc)
        const predecessor = flat[0];
        await loadFromPredecessor(predecessor._id, predecessor.petitionNo);
      } catch {
        if (alive) {
          setPreviousLookup(new Map());
          setImplicitPredecessorNo(null);
          setWasReturned(false);
        }
      }
    })();
    return () => { alive = false; };
  }, [petition?._id, petition?.revisionOf, petition?.submittedBy?.employeeId, petition?.items]);

  // Default the visible phase tab to the petition's current phase
  useEffect(() => {
    if (!petition) return;
    setSelectedPhase((petition.currentPhase ?? 1) as PetitionPhase);
  }, [petition?._id, petition?.currentPhase]);

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
            commonName: item.commonName,
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

  const handleOutlierCheck = useCallback(
    async (
      commonName: string,
      parameterId: string,
      fieldLabel: string,
      value: unknown,
      fieldType: string,
    ) => {
      if (fieldType !== 'number' && fieldType !== 'float') return;
      const num = Number(value);
      if (isNaN(num) || value === '' || value == null) return;
      const result = await checkOutlier({ commonName, parameterId, fieldLabel, value: num });
      const key = `${parameterId}__${fieldLabel}`;
      setOutlierResults((prev) => ({ ...prev, [key]: result }));
    },
    [],
  );

  // ── Feature B: last-batch reference values (display-only) ──────────────────
  // Build the unique (commonName, parameterId) pairs that need a prior-batch
  // lookup: only params that have at least one field with showLastBatch and a
  // truthy commonName. Deduped on commonName+parameterId since last-values only
  // depends on those two.
  const lastBatchPairs = useMemo(() => {
    if (!petition) return [] as { commonName: string; parameterId: string }[];
    const seen = new Set<string>();
    const pairs: { commonName: string; parameterId: string }[] = [];
    (petition.items ?? []).forEach((item) => {
      const commonName = item.commonName?.trim();
      if (!commonName) return;
      const matched = matchParametersForItem(item, parameters, idsFor(item));
      matched.forEach((param) => {
        if (!param._id) return;
        const hasLastBatchField = (param.valueFields ?? []).some((f) => f.showLastBatch);
        if (!hasLastBatchField) return;
        const parameterId = String(param._id);
        const dedupeKey = `${commonName}__${parameterId}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        pairs.push({ commonName, parameterId });
      });
    });
    return pairs;
    // idsFor is a render-scoped closure over groupMembership; we depend on
    // groupMembership directly so the pair list recomputes once membership
    // resolves (listing idsFor would defeat memoization).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petition, parameters, groupMembership]);

  const lastBatchQueries = useQueries({
    queries: lastBatchPairs.map((p) => ({
      queryKey: ['qc-last-values', p.commonName, p.parameterId, id],
      queryFn: () => api.getLastBatchValues(p.commonName, p.parameterId, id ?? ''),
      staleTime: 5 * 60 * 1000,
      enabled: !!p.commonName && !!id,
    })),
  });

  const lastBatchByKey = useMemo(() => {
    const map = new Map<string, { petitionNo?: string; values?: Record<string, unknown> } | undefined>();
    lastBatchPairs.forEach((p, i) => {
      map.set(`${p.commonName}__${p.parameterId}`, lastBatchQueries[i]?.data);
    });
    return map;
  }, [lastBatchPairs, lastBatchQueries]);

  // Detect copy-paste: warn when all numeric field values match the last batch exactly
  useEffect(() => {
    const warnings: Record<string, boolean> = {};
    // values keys look like `${itemSeq}__${parameterId}`
    Object.entries(values).forEach(([rKey, fieldValues]) => {
      const matchingEntry = [...lastBatchByKey.entries()].find(([lbKey]) => {
        // lbKey = `${commonName}__${parameterId}`
        // rKey = `${itemSeq}__${parameterId}` — extract parameterId (last segment)
        const parts = rKey.split('__');
        const paramId = parts[parts.length - 1];
        return lbKey.endsWith(`__${paramId}`);
      });
      if (!matchingEntry) return;
      const lastBatchValues = matchingEntry[1]?.values ?? {};

      // Get all numeric fields that have values
      const numericPairs = Object.entries(fieldValues as Record<string, unknown>).filter(([, v]) => {
        const n = Number(v);
        return v !== '' && v != null && !isNaN(n);
      });
      if (numericPairs.length < 2) return; // need at least 2 fields to flag

      const allMatch = numericPairs.every(([label, val]) => {
        const lastVal = lastBatchValues[label];
        return lastVal != null && String(lastVal) === String(val);
      });
      if (allMatch) warnings[rKey] = true;
    });
    setCopyPasteWarnings(warnings);
  }, [values, lastBatchByKey]);

  if (petitionLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
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

  const items = petition.items ?? [];

  // 2-phase support
  const hasAnyPhasedParam = items.some((item) =>
    matchParametersForItem(item, parameters, idsFor(item)).some((p) => p.hasPhases),
  );
  const currentPhase: PetitionPhase = (petition.currentPhase ?? 1) as PetitionPhase;
  const effectivePhase: PetitionPhase = hasAnyPhasedParam ? selectedPhase : 1;

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
    items.forEach((item) => {
      const matched = matchParametersForItem(item, parameters, idsFor(item));
      matched.forEach((param) => {
        const k = resultKey(item.seq, param._id!);
        const p1Values = values[k] ?? {};
        (param.valueFields ?? []).forEach((field) => {
          if ((field.phase ?? 'both') === 'after') return;
          expandFieldForItem(field, item.commonName).forEach((unit) => {
            if (isFieldAbnormal(unit.field, p1Values[unit.key])) count += 1;
          });
        });
        if (param.hasPhases) {
          const p2Values = valuesPhase2[k] ?? {};
          (param.valueFields ?? []).forEach((field) => {
            const ph = field.phase ?? 'both';
            if (ph === 'before') return;
            expandFieldForItem(field, item.commonName).forEach((unit) => {
              if (isFieldAbnormal(unit.field, p2Values[unit.key])) count += 1;
            });
          });
        }
      });
    });
    return count;
  };
  const abnormalCount = countAbnormal();

  const validate = (phaseToCheck: PetitionPhase): string[] => {
    const missing: string[] = [];
    const phaseValues = valuesForPhase(phaseToCheck);
    items.forEach((item) => {
      const matched = matchParametersForItem(item, parameters, idsFor(item));
      matched.forEach((param) => {
        const k = resultKey(item.seq, param._id!);
        const itemValues = phaseValues[k] ?? {};
        visibleFields(param, phaseToCheck).forEach((field) => {
          if (field.type === 'reference') return; // reference fields are auto-resolved
          expandFieldForItem(field, item.commonName).forEach((unit) => {
            const val = itemValues[unit.key];
            if (unit.field.required && (val == null || String(val).trim() === '')) {
              missing.push(`รายการ ${item.seq} › ${param.name} › ${unit.field.label}`);
              return;
            }
            if (
              unit.field.type === 'enum' &&
              (unit.field.requireNoteOn ?? []).includes(String(val ?? ''))
            ) {
              const noteVal = itemValues[noteLabelFor(unit.key)];
              if (!noteVal || String(noteVal).trim() === '') {
                missing.push(`รายการ ${item.seq} › ${param.name} › ${unit.field.label} (คำอธิบาย)`);
              }
            }
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
    navigate('/qc-testing');
  };

  const handleSubmitResult = async () => {
    const missing = validate(effectivePhase);
    if (missing.length > 0) {
      toast.error('กรอกข้อมูลไม่ครบ', {
        description: `ขาด ${missing.length} ช่อง:\n${missing.slice(0, 5).join('\n')}${missing.length > 5 ? `\n…และอีก ${missing.length - 5}` : ''}`,
      });
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
      const updated = await api.completePetitionTrack(petition._id, 'qc', user?.name ?? 'system');
      toast.success(
        updated.status === 'success'
          ? 'บันทึกผล QC เรียบร้อย — ส่งให้หัวหน้า QC ยืนยัน'
          : 'บันทึกผล QC เรียบร้อย — รอ Lab ตรวจให้ครบ',
      );
      navigate('/qc-testing');
    } catch {
      toast.error('บันทึกผลไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!(await confirm({ title: 'อนุมัติคำร้อง', description: 'อนุมัติคำร้องนี้?' }))) return;
    setSubmitting(true);
    try {
      await api.approvePetition(petition._id, user?.name ?? 'system');
      toast.success('อนุมัติเรียบร้อย');
      navigate('/qc-approval');
    } catch {
      toast.error('อนุมัติไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (note: string) => {
    try {
      await api.rejectPetition(petition._id, user?.name ?? 'system', note);
      toast.success('ส่งกลับให้แก้ไขเรียบร้อย', {
        description: `ส่งให้ ${petition.submittedBy?.name ?? 'ผู้ยื่น'}`,
      });
      navigate('/qc-approval');
    } catch {
      toast.error('ส่งกลับไม่สำเร็จ');
      throw new Error('reject failed');
    }
  };

  // Locked once QC has submitted its results (read-only while waiting for Lab /
  // หัวหน้า QC), or after the petition is fully complete.
  const isLocked = petition.status === 'success' || !!petition.qcCompletedAt;

  return (
    <AppLayout title={petition.petitionNo}>
    <div className={`space-y-6 pb-20 ${flashClass}`}>
      {/* Header */}
      <PageHeader
        onBack={() => navigate('/qc-testing')}
        title={
          <span className="inline-flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary-500" />
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
            title={implicitPredecessorNo
              ? `อ้างอิงจากคำร้อง ${implicitPredecessorNo} (batch เดิม)`
              : 'ส่งกลับมาบันทึกผลใหม่'}
            aria-label="คำร้องแก้ไข"
          >
            <RotateCcw className="h-4 w-4" />
          </span>
        )}
        {abnormalCount > 0 && (
          <span
            className="inline-flex items-center text-red-500"
            title={`พบค่าผิดปกติ ${abnormalCount} รายการ`}
            aria-label={`พบค่าผิดปกติ ${abnormalCount} รายการ`}
          >
            <AlertTriangle className="h-4 w-4" />
          </span>
        )}
      </div>

      {wasReturned && implicitPredecessorNo && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 flex items-center gap-2 -mt-2">
          <RotateCcw className="h-4 w-4 text-orange-500 shrink-0" />
          <p className="text-sm text-orange-800">
            คำร้องนี้ใช้เลขแบชเดียวกับคำร้อง{' '}
            <button
              type="button"
              onClick={() => navigate(`/petitions/${implicitPredecessorNo}`)}
              className="font-semibold underline hover:text-orange-900"
            >
              {implicitPredecessorNo}
            </button>{' '}
            ที่เคยถูกส่งให้แก้ไข — ค่าเดิมแสดงใต้แต่ละช่อง
          </p>
        </div>
      )}

      {/* Active worklist tab strip — switch between petitions currently in QC */}
      {worklistData && worklistData.items.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mt-2">
          <span className="text-xs text-grey-500 shrink-0 mr-1">สลับไป:</span>
          {worklistData.items.map((p) => {
            const isActive = p._id === petition._id;
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => navigate(`/qc-testing/${p._id}`)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition-colors',
                  isActive
                    ? 'bg-primary-500 text-white border-primary-500 cursor-default'
                    : 'bg-white text-grey-700 border-grey-200 hover:border-primary-300 hover:bg-primary-50',
                )}
                disabled={isActive}
                title={`${PETITION_DEPT_LABELS[p.dept]} · ${p.items?.length ?? 0} รายการ`}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    p.status === 'inProgress' ? 'bg-amber-400' : 'bg-blue-400',
                  )}
                />
                <span className="font-semibold">{p.petitionNo}</span>
                <span className={cn(isActive ? 'text-white/80' : 'text-grey-400')}>
                  ·{p.items?.length ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-12 text-grey-400">ไม่มีรายการตัวอย่างในคำร้องนี้</div>
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

      {ollamaAvailable && (
        <div className="mb-4 space-y-2">
          <button
            type="button"
            disabled={analyzeLoading}
            onClick={async () => {
              setAnalyzeLoading(true);
              setAnalyzeText('');
              try {
                await streamAnalyzeQC(id!, (chunk) => {
                  setAnalyzeText((prev) => prev + chunk);
                });
              } catch {
                setAnalyzeText('(เกิดข้อผิดพลาด — กรุณาลองใหม่)');
              } finally {
                setAnalyzeLoading(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-50"
          >
            {analyzeLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            วิเคราะห์ผล (AI)
          </button>

          {analyzeText && (
            <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 whitespace-pre-wrap">
              {analyzeText}
            </div>
          )}
        </div>
      )}

      {/* Each item */}
      {items.map((item) => {
        const matchedParams = matchParametersForItem(item, parameters, idsFor(item));
        const phaseValues = valuesForPhase(effectivePhase);
        const phaseSaves = savesForPhase(effectivePhase);
        const phaseLocked = effectivePhase === 2 && currentPhase === 1;
        return (
          <Card key={item.seq} className="overflow-hidden">
            <CardHeader className="bg-grey-50 pb-3">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <span>รายการที่ {item.seq}: {item.sampleName || '-'}</span>
                {item.batchNo && (
                  <Badge variant="gray-soft" className="font-normal">
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
                <p className="text-xs text-grey-500 mt-1">
                  รายการทดสอบ: {item.testItems}
                </p>
              )}
            </CardHeader>

            <CardContent className="pt-4 space-y-5">
              {matchedParams.length === 0 ? (
                <p className="text-sm text-grey-400 italic">
                  ไม่พบพารามิเตอร์ที่ตรงกับรายการทดสอบ
                  {!item.testItems && ' (ไม่ได้ระบุ testItems)'}
                </p>
              ) : (
                matchedParams.map((param) => {
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
                  const lastBatch = lastBatchByKey.get(`${item.commonName}__${String(param._id)}`);
                  return (
                    <div key={param._id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-grey-800 border-b pb-1 flex-1">
                          {param.name}
                        </h3>
                        {param.hasPhases && (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase hover:bg-amber-100">
                            Phase {effectivePhase}
                          </Badge>
                        )}
                        {param.note && (
                          <span className="text-xs text-grey-400">{param.note}</span>
                        )}
                      </div>
                      {copyPasteWarnings[k] && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 mb-2">
                          <span>🔔</span>
                          <span>ค่าทุกตัวเหมือน batch ก่อนหน้า — กรุณาตรวจสอบว่าไม่ได้ copy ค่าเดิม</span>
                        </div>
                      )}
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
                          return units.map((unit) => {
                            const noteLabel = noteLabelFor(unit.key);
                            // Resolve conditional standards from sibling/other-param values.
                            // For non-conditional fields effectiveField === unit.field and
                            // both new props are falsy, so behavior is unchanged.
                            const effectiveField = unit.field.conditionalMode
                              ? resolveFieldStandard(unit.field, condCtx)
                              : unit.field;
                            const resolved = unit.field.conditionalMode
                              ? resolveStandard(unit.field, condCtx)
                              : null;
                            const beforeRef =
                              param.hasPhases &&
                              effectivePhase === 2 &&
                              (field.phase ?? 'both') === 'both'
                                ? (values[k]?.[unit.key] ?? '')
                                : null;
                            return (
                              <div key={unit.key}>
                                <TestField
                                  field={effectiveField}
                                  item={item}
                                  itemGroupIds={idsFor(item)}
                                  value={phaseValues[k]?.[unit.key] ?? ''}
                                  noteValue={phaseValues[k]?.[noteLabel] ?? ''}
                                  saveInfo={phaseSaves[k]?.[unit.key]}
                                  noteSaveInfo={phaseSaves[k]?.[noteLabel]}
                                  disabled={isLocked || phaseLocked}
                                  onChange={(val) => {
                                    handleFieldChange(petition, item, param, unit.key, val, effectivePhase);
                                    handleOutlierCheck(
                                      item.commonName ?? '',
                                      String(param._id),
                                      unit.field.label,
                                      val,
                                      unit.field.type,
                                    );
                                  }}
                                  onNoteChange={(val) =>
                                    handleFieldChange(petition, item, param, noteLabel, val, effectivePhase)
                                  }
                                  previousValue={getPreviousValue(previousLookup, item, param._id!, unit.key)}
                                  conditionalPending={!!unit.field.conditionalMode && !resolved}
                                  resolvedStandardText={
                                    resolved
                                      ? `${describeResolvedStandard(resolved, unit.field.unit ?? '')}${resolved.matchedRuleLabel ? ` (${resolved.matchedRuleLabel})` : ''}`
                                      : undefined
                                  }
                                  lastBatchValue={
                                    unit.field.showLastBatch
                                      ? lastBatch?.values?.[unit.field.label]
                                      : undefined
                                  }
                                  lastBatchLabel={lastBatch?.petitionNo}
                                  outlierResult={outlierResults[`${String(param._id)}__${unit.field.label}`]}
                                />
                                {beforeRef != null && beforeRef !== '' ? (
                                  <p className="text-[10px] text-grey-400 mt-0.5">
                                    ก่อน: <span className="font-mono">{String(beforeRef)}</span>
                                  </p>
                                ) : null}
                              </div>
                            );
                          });
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Action buttons */}
      {items.length > 0 && petition.status !== 'success' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:left-72 px-4 sm:px-6 py-3 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Button
            variant={isComplete ? 'primary' : 'outline'}
            onClick={isComplete ? handleSubmitResult : handleSaveDraft}
            disabled={submitting}
            className="gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isComplete ? (
              <Send className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isComplete ? 'บันทึก' : 'บันทึกแบบร่าง'}
          </Button>
        </div>
      )}

      {petition.status === 'success' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="text-sm font-semibold text-green-700">บันทึกผลแล้ว — รออนุมัติ</p>
            <p className="text-xs text-grey-500">
              {qcReceivedBy(petition)
                ? `ผู้รับงาน: ${qcReceivedBy(petition)}`
                : 'ไม่ระบุผู้รับงาน'}
            </p>
            {abnormalCount > 0 && (
              <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                คำร้องนี้มีค่าผิดปกติ {abnormalCount} รายการ
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevisionDialogOpen(true)}
              disabled={submitting}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              ส่งให้แก้ไข
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApprove}
              disabled={submitting}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              อนุมัติคำร้อง
            </Button>
          </div>
        </div>
      )}

      {(petition.status === 'approved' || petition.status === 'rejected') && (
        <div className={`rounded-lg border p-4 flex flex-col items-center gap-2 ${
          petition.status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        }`}>
          {petition.status === 'approved' ? (
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          ) : (
            <RotateCcw className="h-6 w-6 text-red-500" />
          )}
          <p className={`text-sm font-semibold ${
            petition.status === 'approved' ? 'text-green-700' : 'text-red-700'
          }`}>
            {petition.status === 'approved' ? 'อนุมัติแล้ว' : 'ส่งกลับให้แก้ไขแล้ว'}
          </p>
        </div>
      )}

      <RevisionRequestDialog
        open={revisionDialogOpen}
        onOpenChange={setRevisionDialogOpen}
        petitionNo={petition.petitionNo}
        submitterName={petition.submittedBy?.name ?? 'ผู้ยื่น'}
        onConfirm={handleReject}
      />
    </div>
    </AppLayout>
  );
}
