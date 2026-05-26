import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FlaskConical,
  CheckCircle2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Save,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/lis/AppLayout';
import { usePetition, usePetitionList } from '@/hooks/usePetition';
import { api, type ParameterItem, type ParameterValueField } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isFieldAbnormal } from '@/lib/parameterValidation';
import { cn } from '@/lib/utils';
import { TimerField } from '@/components/lis/TimerField';
import {
  PETITION_DEPT_LABELS,
  type Petition,
  type PetitionItem,
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

function matchLabParameters(item: PetitionItem, params: ParameterItem[]): ParameterItem[] {
  const active = params.filter((p) => p.status !== 'inactive');
  if (!item.testItems) return active.filter((p) => p.applyAll);
  const names = item.testItems
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return active.filter((p) => names.includes((p.name ?? '').toLowerCase()));
}

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
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
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

  const { data: petition, loading: petitionLoading, error: petitionError } = usePetition(id);
  const { data: worklistData } = usePetitionList({
    status: 'pendingReview,inProgress',
    limit: 20,
  });

  const [allParameters, setAllParameters] = useState<ParameterItem[]>([]);
  const [savedResults, setSavedResults] = useState<QCTestResult[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [saveStates, setSaveStates] = useState<Record<string, Record<string, FieldSaveInfo>>>({});
  const [submitting, setSubmitting] = useState(false);
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

  useEffect(() => {
    if (!id) return;
    api.getQCResults(id).then((results) => {
      setSavedResults(results);
      const v: Record<string, Record<string, unknown>> = {};
      const s: Record<string, Record<string, FieldSaveInfo>> = {};
      results.forEach((r) => {
        const k = resultKey(r.itemSeq, r.parameterId);
        v[k] = { ...(r.values as Record<string, unknown>) };
        s[k] = {};
        Object.keys(r.values as object).forEach((fieldLabel) => {
          s[k][fieldLabel] = {
            state: 'saved',
            savedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
            savedBy: r.updatedBy?.name || r.enteredBy?.name,
          };
        });
      });
      setValues(v);
      setSaveStates(s);
    }).catch(() => {});
  }, [id]);

  const handleFieldChange = useCallback(
    (
      petition: Petition,
      item: PetitionItem,
      param: ParameterItem,
      fieldLabel: string,
      newVal: unknown,
    ) => {
      const k = resultKey(item.seq, param._id!);

      advanceToInProgress();

      setValues((prev) => ({
        ...prev,
        [k]: { ...(prev[k] ?? {}), [fieldLabel]: newVal },
      }));

      setSaveStates((prev) => ({
        ...prev,
        [k]: { ...(prev[k] ?? {}), [fieldLabel]: { state: 'saving' } },
      }));

      const debounceKey = `${k}__${fieldLabel}`;
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
          });
          const now = new Date();
          setSaveStates((prev) => ({
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
          setSaveStates((prev) => ({
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

  // Show only Lab batch items (batchNo ending in 1 or 6)
  const labItems = (petition.items ?? []).filter((it) => isLabBatchNo(it.batchNo));

  const countAbnormal = (): number => {
    let count = 0;
    labItems.forEach((item) => {
      const matched = matchLabParameters(item, allParameters);
      matched.forEach((param) => {
        if (param.scope !== 'lab') return; // skip read-only shared QC params
        const k = resultKey(item.seq, param._id!);
        const itemValues = values[k] ?? {};
        (param.valueFields ?? []).forEach((field) => {
          if (isFieldAbnormal(field, itemValues[field.label])) count += 1;
        });
      });
    });
    return count;
  };
  const abnormalCount = countAbnormal();

  const validate = (): string[] => {
    const missing: string[] = [];
    labItems.forEach((item) => {
      const matched = matchLabParameters(item, allParameters);
      matched.forEach((param) => {
        if (param.scope !== 'lab') return; // only validate Lab-owned params
        const k = resultKey(item.seq, param._id!);
        const itemValues = values[k] ?? {};
        (param.valueFields ?? []).forEach((field) => {
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
    const missing = validate();
    if (missing.length > 0) {
      toast.error('กรอกข้อมูลไม่ครบ', {
        description: `ขาด ${missing.length} ช่อง:\n${missing.slice(0, 5).join('\n')}${missing.length > 5 ? `\n…และอีก ${missing.length - 5}` : ''}`,
      });
      return;
    }
    if (abnormalCount > 0) {
      const ok = window.confirm(`พบค่าผิดปกติ ${abnormalCount} รายการ ยืนยันบันทึกผล?`);
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

  const isLocked = petition.status === 'success';

  return (
    <AppLayout title={petition.petitionNo}>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/lab-testing')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FlaskConical className="h-5 w-5 text-sky-500" />
          <h1 className="text-lg md:text-xl font-bold">{petition.petitionNo}</h1>
          <Badge variant="blue-soft">{PETITION_DEPT_LABELS[petition.dept]}</Badge>
          {abnormalCount > 0 && (
            <span
              className="inline-flex items-center text-red-500"
              title={`พบค่าผิดปกติ ${abnormalCount} รายการ`}
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
          <span className="text-sm text-grey-500 ml-auto">
            ผู้นำส่ง: {petition.submittedBy?.name ?? '-'}
          </span>
        </div>

        {/* Worklist tab strip */}
        {worklistData && worklistData.items.filter((p) =>
          (p.items ?? []).some((it) => isLabBatchNo(it.batchNo))
        ).length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mt-2">
            <span className="text-xs text-grey-500 shrink-0 mr-1">สลับไป:</span>
            {worklistData.items
              .filter((p) => (p.items ?? []).some((it) => isLabBatchNo(it.batchNo)))
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

        {/* Each Lab item */}
        {labItems.map((item) => {
          const matchedParams = matchLabParameters(item, allParameters);
          const labOwnedParams = matchedParams.filter((p) => p.scope === 'lab');
          const sharedQcParams = matchedParams.filter((p) => p.scope === 'qc' && p.shareWithLab);
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
                      const fields = param.valueFields ?? [];
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
                            {param.note && (
                              <span className="text-xs text-grey-400">{param.note}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-2">
                            {fields.map((field) => {
                              const noteLabel = noteLabelFor(field.label);
                              return (
                                <TestField
                                  key={field.label}
                                  field={field}
                                  value={values[k]?.[field.label] ?? ''}
                                  noteValue={values[k]?.[noteLabel] ?? ''}
                                  saveInfo={saveStates[k]?.[field.label]}
                                  noteSaveInfo={saveStates[k]?.[noteLabel]}
                                  disabled={isLocked}
                                  onChange={(val) =>
                                    handleFieldChange(petition, item, param, field.label, val)
                                  }
                                  onNoteChange={(val) =>
                                    handleFieldChange(petition, item, param, noteLabel, val)
                                  }
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Shared QC parameters (read-only) */}
                    {sharedQcParams.map((param) => {
                      const k = resultKey(item.seq, param._id!);
                      const fields = param.valueFields ?? [];
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
                            {param.note && (
                              <span className="text-xs text-grey-400">{param.note}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-2">
                            {fields.map((field) => {
                              const noteLabel = noteLabelFor(field.label);
                              return (
                                <TestField
                                  key={field.label}
                                  field={field}
                                  value={values[k]?.[field.label] ?? ''}
                                  noteValue={values[k]?.[noteLabel] ?? ''}
                                  saveInfo={saveStates[k]?.[field.label]}
                                  noteSaveInfo={saveStates[k]?.[noteLabel]}
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
