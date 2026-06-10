import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PETITION_DEPT_LABELS,
  isLabBatch,
  type Petition,
  type QCTestResult,
} from '@/types/petition.types';
import { useAuth } from '@/hooks/useAuth';
import { api, type ParameterItem } from '@/lib/api';
import { normalizeRoles } from "@/lib/roles";
import { matchParametersForItem } from '@/lib/petitionTestItems';
import { useItemGroupMembership } from '@/hooks/useItemGroupMembership';

interface Props { petition: Petition; }

function formatResultValue(value: unknown): string {
  if (value == null || value === '') return '-';
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const display = value === undefined || value === null || value === '' ? '-' : value;
  return (
    <div>
      <p className="text-xs text-grey-500 mb-0.5">{label}</p>
      <div className="text-sm text-black-500">{display}</div>
    </div>
  );
}

export default function PetitionView({ petition: p }: Props) {
  const { user } = useAuth();
  const roles = normalizeRoles(user);
  const canSeeTestItems = roles.length > 0 && roles.some((r) => r !== 'viewer');
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const groupMembership = useItemGroupMembership();
  const idsFor = (it: { sampleId?: string }) =>
    groupMembership.get(String(it?.sampleId ?? '').trim()) ?? [];
  const [results, setResults] = useState<QCTestResult[]>([]);
  useEffect(() => {
    if (!canSeeTestItems) return;
    api.getParameters().then(setParameters).catch(() => {});
  }, [canSeeTestItems]);
  useEffect(() => {
    if (!canSeeTestItems || !p._id) return;
    api.getQCResults(p._id).then(setResults).catch(() => {});
  }, [canSeeTestItems, p._id]);

  const resultsByKey = useMemo(() => {
    const map = new Map<string, QCTestResult>();
    for (const r of results) map.set(`${r.itemSeq}__${r.parameterId}`, r);
    return map;
  }, [results]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">ข้อมูลคำขอ</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="ผู้ยื่นคำขอ" value={p.submittedBy?.name} />
          <Field label="แผนกผู้ยื่น" value={p.submittedBy?.department} />
          <Field
            label="วัน-เวลาที่ส่งคำร้อง"
            value={
              p.submittedBy?.submittedAt
                ? new Date(p.submittedBy.submittedAt).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '-'
            }
          />
          <Field label="แผนก" value={<Badge variant="blue-soft">{PETITION_DEPT_LABELS[p.dept]}</Badge>} />
          <Field label="เลขที่คำร้อง" value={p.petitionNo} />
          <Field label="ผู้นำส่ง" value={p.deliveredBy?.name ?? p.submittedBy?.name} />
          <Field
            label="วันที่นำส่ง"
            value={
              p.sampleSentAt
                ? new Date(p.sampleSentAt).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '-'
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการตัวอย่าง ({p.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.items.map((item) => {
            const lab = item.batchNo && isLabBatch(item.batchNo);
            const matchedParams = canSeeTestItems ? matchParametersForItem(item, parameters, idsFor(item)) : [];
            return (
              <div key={item.seq} className="rounded-[10px] border border-black-50 p-4 space-y-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm font-semibold text-black-500">
                    ตัวอย่างที่ {item.seq}: {item.sampleName || '-'}
                  </p>
                  {item.sampleId && (
                    <span className="text-xs text-primary-500">[{item.sampleId}]</span>
                  )}
                  {lab && <Badge variant="blue-soft">ส่ง lab</Badge>}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Batch No." value={item.batchNo} />
                  <Field label="Lot No." value={item.lotNo} />
                  <Field label="วันที่ผลิต" value={item.productionDate} />
                  <Field label="ขนาดบรรจุ" value={item.packageUnit} />
                  <Field label="ชื่อสามัญ" value={item.commonName} />
                  <Field label="เลขที่ใบนำส่ง" value={item.submissionNo} />
                </div>
                {item.note && <Field label="หมายเหตุ" value={item.note} />}
                {canSeeTestItems && (
                  <Field
                    label="รายการทดลอง / ผลตรวจ"
                    value={
                      matchedParams.length > 0 ? (
                        <div className="space-y-1.5">
                          {matchedParams.map((param) => {
                            const result = param._id
                              ? resultsByKey.get(`${item.seq}__${param._id}`)
                              : undefined;
                            const entries = result
                              ? Object.entries(result.values ?? {}).filter(
                                  ([key]) => !key.endsWith('__note'),
                                )
                              : [];
                            return (
                              <div
                                key={param._id ?? param.name}
                                className="rounded-[8px] border border-grey-200 px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                                        (param.scope ?? 'qc') === 'lab'
                                          ? 'bg-sky-100 text-sky-800'
                                          : 'bg-indigo-100 text-indigo-800'
                                      }`}
                                    >
                                      {(param.scope ?? 'qc') === 'lab' ? 'Lab' : 'QC'}
                                    </span>
                                    <span className="text-sm font-medium text-black-500">
                                      {param.name}
                                    </span>
                                  </div>
                                  {entries.length === 0 && (
                                    <Badge variant="gray-soft">ยังไม่บันทึก</Badge>
                                  )}
                                </div>
                                {entries.length > 0 && (
                                  <div className="mt-1.5 grid gap-1 text-xs text-grey-700 md:grid-cols-2">
                                    {entries.map(([fieldLabel, val]) => (
                                      <div key={fieldLabel} className="flex gap-1.5">
                                        <span className="text-grey-500">{fieldLabel}:</span>
                                        <span className="text-black-500 font-medium">
                                          {formatResultValue(val)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : undefined
                    }
                  />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {p.cause && (
        <Card>
          <CardHeader>
            <CardTitle>สาเหตุการตรวจ / ข้อมูลเพิ่มเติม</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-black-500 whitespace-pre-wrap">{p.cause}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
