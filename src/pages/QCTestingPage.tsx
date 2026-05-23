import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Search, QrCode } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import { usePetitionList } from '@/hooks/usePetition';
import {
  PETITION_DEPT_LABELS,
  PETITION_STATUS_CONFIG,
  type Petition,
  type PetitionDept,
} from '@/types/petition.types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import QrReceiveModal from '@/components/petition/QrReceiveModal';

const ENTRY_STATUSES = new Set(['pendingReview', 'inProgress']);
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

export default function QCTestingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<PetitionDept | ''>('');
  const [scanOpen, setScanOpen] = useState(false);

  const { data, loading, refresh } = usePetitionList({
    status: 'sampleSent,pendingReview,inProgress',
    search,
    dept: dept || undefined,
    limit: 50,
  });

  const petitions: Petition[] = data?.items ?? [];

  return (
    <AppLayout title="การทดสอบ QC">
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <FlaskConical className="h-6 w-6 text-primary-500" />
        <h1 className="text-2xl font-bold">การทดสอบ QC</h1>
        <Badge variant="blue-soft" className="ml-2">
          {data?.total ?? 0} รายการ
        </Badge>
        <Button variant="primary" className="ml-auto gap-2" onClick={() => setScanOpen(true)}>
          <QrCode className="h-4 w-4" />
          สแกน QR รับตัวอย่าง
        </Button>
      </div>

      {/* Filters */}
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

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เลขที่คำร้อง</TableHead>
              <TableHead>แผนก</TableHead>
              <TableHead>ผู้นำส่ง</TableHead>
              <TableHead>รายการตัวอย่าง</TableHead>
              <TableHead>จำนวนรายการ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">การดำเนินการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-grey-400">
                  กำลังโหลด...
                </TableCell>
              </TableRow>
            ) : petitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-grey-400">
                  ไม่มีคำร้องที่รอตรวจ
                </TableCell>
              </TableRow>
            ) : (
              petitions.map((p) => {
                const statusCfg = PETITION_STATUS_CONFIG[p.status];
                const sampleNames = p.items?.map((it) => it.sampleName).filter(Boolean).join(', ') || '-';
                const canEnter = ENTRY_STATUSES.has(p.status);
                return (
                  <TableRow
                    key={p._id}
                    className={canEnter ? 'cursor-pointer hover:bg-grey-50' : 'hover:bg-grey-50'}
                    onClick={() => { if (canEnter) navigate(`/qc-testing/${p._id}`); }}
                  >
                    <TableCell className="font-semibold text-primary-500">{p.petitionNo}</TableCell>
                    <TableCell>
                      <Badge variant="blue-soft">{PETITION_DEPT_LABELS[p.dept]}</Badge>
                    </TableCell>
                    <TableCell>{p.submittedBy?.name ?? '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-grey-600">
                      {sampleNames}
                    </TableCell>
                    <TableCell>{p.items?.length ?? 0} รายการ</TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canEnter ? (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/qc-testing/${p._id}`);
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
    <QrReceiveModal
      open={scanOpen}
      onClose={() => setScanOpen(false)}
      onReceived={refresh}
    />
    </AppLayout>
  );
}
