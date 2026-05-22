import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import { usePetition } from '@/hooks/usePetition';
import { api, type ParameterItem, type ParameterValueField } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
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

function matchParameters(item: PetitionItem, params: ParameterItem[]): ParameterItem[] {
  if (!item.testItems) return params.filter((p) => p.applyAll && p.status !== 'inactive');
  const names = item.testItems
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return params.filter(
    (p) => p.status !== 'inactive' && names.includes((p.name ?? '').toLowerCase()),
  );
}

function resultKey(itemSeq: number, parameterId: string) {
  return `${itemSeq}__${parameterId}`;
}

export const noteLabelFor = (mainLabel: string) => `${mainLabel}__note`;

interface TestFieldProps {
  field: ParameterValueField;
  value: unknown;
  noteValue: unknown;
  saveInfo?: FieldSaveInfo;
  noteSaveInfo?: FieldSaveInfo;
  onChange: (val: unknown) => void;
  onNoteChange: (val: unknown) => void;
}

function TestField({
  field,
  value,
  noteValue,
  saveInfo,
  noteSaveInfo,
  onChange,
  onNoteChange,
}: TestFieldProps) {
  const strVal = value == null ? '' : String(value);
  const strNote = noteValue == null ? '' : String(noteValue);
  const requireNoteOn = field.requireNoteOn ?? [];
  const showNote = field.type === 'enum' && requireNoteOn.includes(strVal);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-grey-700">
          {field.label}
          {field.unit && <span className="text-grey-400 font-normal ml-1">({field.unit})</span>}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
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
      {field.type === 'enum' ? (
        <Select value={strVal || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
          <SelectTrigger className="h-8 text-sm">
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
          type={field.type === 'number' || field.type === 'float' || field.type === 'timer' ? 'number' : 'text'}
          step={field.type === 'float' ? 'any' : undefined}
          min={field.type !== 'text' ? (field as any).min : undefined}
          max={field.type !== 'text' ? (field as any).max : undefined}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm"
          placeholder={field.standardValue != null ? `มาตรฐาน: ${field.standardValue}` : undefined}
        />
      )}

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
            placeholder={`อธิบายเพิ่มเติมเมื่อเลือก "${strVal}"`}
            className="w-full text-sm rounded border border-amber-300 bg-white px-2 py-1 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-amber-400"
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
    </div>
  );
}

export default function QCTestingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: petition, loading: petitionLoading, error: petitionError } = usePetition(id);
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [savedResults, setSavedResults] = useState<QCTestResult[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  // key: resultKey(itemSeq, parameterId) → { fieldLabel → FieldSaveInfo }
  const [saveStates, setSaveStates] = useState<Record<string, Record<string, FieldSaveInfo>>>({});
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load parameters and existing results
  useEffect(() => {
    api.getParameters().then(setParameters).catch(() => {});
  }, []);

  // Auto-advance status pendingReview → inProgress on entering the page
  const advancedRef = useRef(false);
  useEffect(() => {
    if (!petition || advancedRef.current) return;
    if (petition.status === 'pendingReview') {
      advancedRef.current = true;
      api.patch(`/petitions/${petition._id}`, {
        status: 'inProgress',
        actor: user?.name ?? 'system',
      }).catch(() => {});
    }
  }, [petition, user]);

  useEffect(() => {
    if (!id) return;
    api.getQCResults(id).then((results) => {
      setSavedResults(results);
      // Populate local values state from DB
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

      // Update local value immediately
      setValues((prev) => ({
        ...prev,
        [k]: { ...(prev[k] ?? {}), [fieldLabel]: newVal },
      }));

      // Set saving state
      setSaveStates((prev) => ({
        ...prev,
        [k]: { ...(prev[k] ?? {}), [fieldLabel]: { state: 'saving' } },
      }));

      // Debounce the actual save
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
    [user],
  );

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

  return (
    <AppLayout title={petition.petitionNo}>
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/qc-testing')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FlaskConical className="h-5 w-5 text-primary-500" />
        <h1 className="text-xl font-bold">{petition.petitionNo}</h1>
        <Badge variant="blue-soft">{PETITION_DEPT_LABELS[petition.dept]}</Badge>
        <span className="text-sm text-grey-500 ml-auto">
          ผู้นำส่ง: {petition.submittedBy?.name ?? '-'}
        </span>
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-grey-400">ไม่มีรายการตัวอย่างในคำร้องนี้</div>
      )}

      {/* Each item */}
      {items.map((item) => {
        const matchedParams = matchParameters(item, parameters);
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
                  const fields = param.valueFields ?? [];
                  if (fields.length === 0) return null;
                  return (
                    <div key={param._id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-grey-800 border-b pb-1 flex-1">
                          {param.name}
                        </h3>
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
                })
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
    </AppLayout>
  );
}
