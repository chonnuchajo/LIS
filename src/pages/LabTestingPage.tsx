import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Search, AlertTriangle } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import { usePetitionList } from '@/hooks/usePetition';
import { api } from '@/lib/api';
import {
  PETITION_DEPT_LABELS,
  PETITION_STATUS_CONFIG,
  type Petition,
  type PetitionDept,
} from '@/types/petition.types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ENTRY_STATUSES = new Set(['pendingReview', 'inProgress']);
const isLabBatchNo = (batchNo?: string | null) => /[16]$/.test(String(batchNo ?? '').trim());
const hasLabItem = (p: Petition) => (p.items ?? []).some((it) => isLabBatchNo(it.batchNo));

export default function LabTestingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<PetitionDept | ''>('');

  const { data, loading } = usePetitionList({
    status: 'sampleSent,pendingReview,inProgress',
    search,
    dept: dept || undefined,
    limit: 50,
  });

  const petitions: Petition[] = (data?.items ?? []).filter(hasLabItem);

  const [abnormalMap, setAbnormalMap] = useState<Record<string, boolean>>({});
  const flaggablePetitionIds = petitions
    .filter((p) => p.status === 'pendingReview' || p.status === 'inProgress')
    .map((p) => p._id);
  const flaggableKey = flaggablePetitionIds.join(',');
  useEffect(() => {
    if (flaggablePetitionIds.length === 0) {
      setAbnormalMap({});
      return;
    }
    let alive = true;
    api.getAbnormalFlags(flaggablePetitionIds)
      .then((map) => { if (alive) setAbnormalMap(map || {}); })
      .catch(() => { if (alive) setAbnormalMap({}); });
    return () => { alive = false; };
  }, [flaggableKey]);

  return (
    <AppLayout title="การทดสอบ Lab">
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <FlaskConical className="h-6 w-6 text-sky-500" />
          <h1 className="text-2xl font-bold">การทดสอบ Lab</h1>
          <Badge variant="blue-soft" className="ml-2">
            {petitions.length} รายการ
          </Badge>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grey-400" />
            <Input
              placeholder="ค้นหาเลขที่คำร้อง / ชื่อตัวอย่าง..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={dept || 'all'} onValueChange={(v) => setDept(v === 'all' ? '' : v as PetitionDept)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="ทุกแผนก" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกแผนก</SelectItem>
              <SelectItem value="production">{PETITION_DEPT_LABELS.production}</SelectItem>
              <SelectItem value="rm">{PETITION_DEPT_LABELS.rm}</SelectItem>
              <SelectItem value="fg">{PETITION_DEPT_LABELS.fg}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>คำร้อง</TableHead>
                <TableHead>รายการตัวอย่าง (Lab)</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">การดำเนินการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-grey-400">
                    กำลังโหลด...
                  </TableCell>
                </TableRow>
              ) : petitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-grey-400">
                    ไม่มีคำร้อง Lab ที่รอตรวจ
                  </TableCell>
                </TableRow>
              ) : (
                petitions.map((p) => {
                  const statusCfg = PETITION_STATUS_CONFIG[p.status];
                  const labItems = (p.items ?? []).filter((it) => isLabBatchNo(it.batchNo));
                  const canEnter = ENTRY_STATUSES.has(p.status);
                  return (
                    <TableRow
                      key={p._id}
                      className={canEnter ? 'cursor-pointer hover:bg-grey-50' : 'hover:bg-grey-50'}
                      onClick={() => { if (canEnter) navigate(`/lab-testing/${p._id}`); }}
                    >
                      <TableCell className="align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sky-600">{p.petitionNo}</span>
                          {abnormalMap[p._id] && (
                            <AlertTriangle
                              className="h-4 w-4 text-red-500 shrink-0"
                              aria-label="พบค่าผิดปกติในผลทดสอบ"
                            />
                          )}
                        </div>
                        <div className="text-xs text-grey-500 mt-0.5">
                          โดย {p.submittedBy?.name ?? '-'} จาก {PETITION_DEPT_LABELS[p.dept]}
                        </div>
                        <div className="text-xs text-grey-500 mt-0.5">{labItems.length} รายการ Lab</div>
                      </TableCell>
                      <TableCell className="max-w-[280px] text-sm text-grey-600 align-top">
                        {labItems.length > 0 ? (
                          <div className="space-y-1">
                            {labItems.map((it) => (
                              <div key={it.seq} className="flex items-center gap-1.5 flex-wrap">
                                <span>{it.commonName || '-'}</span>
                                {it.batchNo && (
                                  <Badge variant="blue-soft" className="font-normal text-[11px] px-1.5 py-0">
                                    {it.batchNo}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {canEnter ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-sky-300 text-sky-700 hover:bg-sky-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/lab-testing/${p._id}`);
                            }}
                          >
                            เข้าตรวจ
                          </Button>
                        ) : (
                          <span className="text-xs text-grey-400">รอสแกนรับ</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
