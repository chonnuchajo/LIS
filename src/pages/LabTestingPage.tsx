import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, AlertTriangle, QrCode, RotateCcw } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import { usePetitionList } from '@/hooks/usePetition';
import { useAuth } from '@/hooks/useAuth';
import { api, type ParameterItem } from '@/lib/api';
import { matchParametersForItem } from '@/lib/petitionTestItems';
import { useItemGroupMembership } from '@/hooks/useItemGroupMembership';
import {
  PETITION_DEPT_LABELS,
  type Petition,
  type PetitionDept,
  type PetitionItem,
} from '@/types/petition.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PageHeader from '@/components/lis/PageHeader';
import PageToolbar from '@/components/lis/PageToolbar';
import { DataTable, type DataTableColumn } from '@/components/lis/DataTable';
import { statusBadge } from '@/lib/statusBadge';
import LabScanAcceptModal from '@/components/petition/LabScanAcceptModal';
import { normalizeRoles } from '@/lib/roles';
import { isAssignedTo } from '@/lib/assignment';
import { useArrivalFlashId } from '@/hooks/useArrivalFlash';

const FULL_ACCESS_ROLES = new Set(['admin', 'lab-head']);

const ENTRY_STATUSES = new Set(['pendingReview', 'inProgress']);
const isLabBatchNo = (batchNo?: string | null) => /[16]$/.test(String(batchNo ?? '').trim());
const isLabReadableItem = (
  it: PetitionItem,
  params: ParameterItem[],
  itemGroupIds: string[] = [],
) =>
  isLabBatchNo(it.batchNo) && matchParametersForItem(it, params, itemGroupIds).length > 0;

export default function LabTestingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const flashId = useArrivalFlashId();
  const isFullAccess = normalizeRoles(user).some((r) => FULL_ACCESS_ROLES.has(r));
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<PetitionDept | ''>('');
  const [scanOpen, setScanOpen] = useState(false);
  const [labParams, setLabParams] = useState<ParameterItem[]>([]);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const groupMembership = useItemGroupMembership();
  const idsFor = (it: { sampleId?: string }) =>
    groupMembership.get(String(it?.sampleId ?? '').trim()) ?? [];

  useEffect(() => {
    api.getParameters()
      .then((all) =>
        setLabParams(
          all.filter(
            (p) => p.scope === 'lab' || (p.scope === 'qc' && p.shareWithLab === true),
          ),
        ),
      )
      .catch(() => {})
      .finally(() => setParamsLoaded(true));
  }, []);

  const { data, loading, refresh } = usePetitionList({
    status: 'sampleSent,pendingReview,inProgress',
    search,
    dept: dept || undefined,
    limit: 50,
  });

  const petitions: Petition[] = (data?.items ?? [])
    .filter((p) =>
      paramsLoaded
        ? (p.items ?? []).some((it) => isLabReadableItem(it, labParams, idsFor(it)))
        : (p.items ?? []).some((it) => isLabBatchNo(it.batchNo)),
    )
    .filter((p) => isFullAccess || isAssignedTo(p.assignedTo, user));

  const [abnormalMap, setAbnormalMap] = useState<Record<string, boolean>>({});
  const [returnedMap, setReturnedMap] = useState<Record<string, boolean>>({});
  const flaggablePetitionIds = petitions
    .filter((p) => p.status === 'pendingReview' || p.status === 'inProgress')
    .map((p) => p._id);
  const flaggableKey = flaggablePetitionIds.join(',');
  useEffect(() => {
    if (flaggablePetitionIds.length === 0) {
      setAbnormalMap({});
      setReturnedMap({});
      return;
    }
    let alive = true;
    api.getAbnormalFlags(flaggablePetitionIds)
      .then((map) => { if (alive) setAbnormalMap(map || {}); })
      .catch(() => { if (alive) setAbnormalMap({}); });
    api.getReturnedFlags(flaggablePetitionIds)
      .then((map) => { if (alive) setReturnedMap(map || {}); })
      .catch(() => { if (alive) setReturnedMap({}); });
    return () => { alive = false; };
  }, [flaggableKey]);

  const columns: DataTableColumn<Petition>[] = [
    {
      key: 'petition',
      header: 'คำร้อง',
      className: 'align-top',
      cell: (p) => {
        const labItems = (p.items ?? []).filter((it) =>
          paramsLoaded ? isLabReadableItem(it, labParams, idsFor(it)) : isLabBatchNo(it.batchNo),
        );
        return (
          <>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sky-600">{p.petitionNo}</span>
              {returnedMap[p._id] && (
                <RotateCcw className="h-4 w-4 text-orange-500 shrink-0" aria-label="ส่งกลับมาบันทึกผลใหม่" />
              )}
              {abnormalMap[p._id] && (
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" aria-label="พบค่าผิดปกติในผลทดสอบ" />
              )}
            </div>
            <div className="text-xs text-grey-500 mt-0.5">
              โดย {p.submittedBy?.name ?? '-'} จาก {PETITION_DEPT_LABELS[p.dept]}
            </div>
            <div className="text-xs text-grey-500 mt-0.5">{labItems.length} รายการ Lab</div>
          </>
        );
      },
    },
    {
      key: 'items',
      header: 'รายการตัวอย่าง (Lab)',
      className: 'max-w-[280px] text-sm text-grey-600 align-top',
      cell: (p) => {
        const labItems = (p.items ?? []).filter((it) =>
          paramsLoaded ? isLabReadableItem(it, labParams, idsFor(it)) : isLabBatchNo(it.batchNo),
        );
        return labItems.length > 0 ? (
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
        ) : (
          '-'
        );
      },
    },
    {
      key: 'status',
      header: 'สถานะ',
      className: 'align-top',
      cell: (p) => {
        const b = statusBadge(p.status);
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
    },
    {
      key: 'action',
      header: 'การดำเนินการ',
      className: 'text-right align-top',
      cell: (p) =>
        ENTRY_STATUSES.has(p.status) ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/lab-testing/${p._id}`);
            }}
          >
            เข้าตรวจ
          </Button>
        ) : (
          <span className="text-xs text-grey-400">รอสแกนรับ</span>
        ),
    },
  ];

  return (
    <AppLayout title="การทดสอบ Lab">
      <LabScanAcceptModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onAccepted={() => { setScanOpen(false); refresh(); }}
      />
      <div className="space-y-6">
        <PageHeader
          title={
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-sky-500" />
              การทดสอบ Lab
            </span>
          }
          description={`${petitions.length} รายการ`}
          actions={
            <Button variant="primary" className="gap-2" onClick={() => setScanOpen(true)}>
              <QrCode className="h-4 w-4" />
              สแกน QR รับงาน
            </Button>
          }
        />

        <PageToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'ค้นหาเลขที่คำร้อง / ชื่อตัวอย่าง...',
          }}
          filters={
            <Select value={dept || 'all'} onValueChange={(v) => setDept(v === 'all' ? '' : (v as PetitionDept))}>
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
          }
        />

        <DataTable
          columns={columns}
          data={petitions}
          rowKey={(p) => p._id}
          isLoading={loading}
          rowClassName={(p) => (p._id === flashId ? 'animate-flash-bg' : undefined)}
          onRowClick={(p) => {
            if (ENTRY_STATUSES.has(p.status)) navigate(`/lab-testing/${p._id}`);
          }}
          emptyTitle="ไม่มีคำร้อง Lab ที่รอตรวจ"
        />
      </div>
    </AppLayout>
  );
}
