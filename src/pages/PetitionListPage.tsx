import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, FilePlus2, Search, X } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/lis/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/lis/DataTable';
import { statusBadge } from '@/lib/statusBadge';
import { usePetitionList } from '@/hooks/usePetition';
import { useAuth } from '@/hooks/useAuth';
import { useCanAccessPath } from '@/hooks/useCanAccessPath';
import { useNotifications } from '@/context/NotificationContext';
import { api, type ParameterItem } from '@/lib/api';
import { normalizeRoles } from "@/lib/roles";
import { matchParametersForItem, parameterNamesForPetition } from '@/lib/petitionTestItems';
import {
  PETITION_STATUSES,
  PETITION_DEPT_LABELS,
  PETITION_STATUS_CONFIG,
  type Petition,
} from '@/types/petition.types';

const norm = (value?: string | null) => (value ?? '').trim().toLowerCase();

const RECEIVED_STATUSES = new Set<Petition['status']>([
  'sampleSent',
  'pendingReview',
  'inProgress',
  'success',
]);

const LAB_BATCH_LAST_DIGITS = new Set(['1', '6']);

const isLabBatchNo = (batchNo?: string | null) => {
  const trimmed = String(batchNo ?? '').trim();
  return trimmed.length > 0 && LAB_BATCH_LAST_DIGITS.has(trimmed.slice(-1));
};

const petitionHasLabItems = (petition: Petition) =>
  petition.items.some((item) => isLabBatchNo(item.batchNo));

const petitionHasLabReadableItem = (
  petition: Petition,
  labParams: ParameterItem[],
) =>
  petition.items.some(
    (item) =>
      isLabBatchNo(item.batchNo) &&
      matchParametersForItem(item, labParams).length > 0,
  );

function isOwnSubmission(
  petition: Petition,
  user: { email?: string; name?: string } | null,
): boolean {
  if (!user) return false;
  const userName = norm(user.name);
  const submitterName = norm(petition.submittedBy?.name);
  if (userName && submitterName && userName === submitterName) return true;
  return false;
}

function isAssignedTo(
  petition: Petition,
  user: { name?: string } | null,
): boolean {
  if (!user) return false;
  const userName = norm(user.name);
  const assigneeName = norm(petition.assignedTo?.name);
  return !!userName && !!assigneeName && userName === assigneeName;
}

function isLabRole(role: string): boolean {
  return role === 'lab' || role.startsWith('lab-') || role.startsWith('lab_');
}

function isQcRole(role: string): boolean {
  return role === 'qc' || role.startsWith('qc-') || role.startsWith('qc_');
}

function canSeePetition(
  petition: Petition,
  user: { email?: string; name?: string; role?: string; roles?: string[] } | null,
): boolean {
  if (!user) return false;
  const roles = normalizeRoles(user);
  if (isOwnSubmission(petition, user)) return true;
  if (isAssignedTo(petition, user)) return true;
  if (RECEIVED_STATUSES.has(petition.status)) {
    if (roles.some(isLabRole)) {
      if (petitionHasLabItems(petition)) return true;
    }
    if (roles.some(isQcRole)) return true;
  }
  return false;
}

const PAGE_SIZE = 20;

export default function PetitionListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canAccess = useCanAccessPath();
  const visibleStatuses = PETITION_STATUSES;
  const createdNo = (location.state as { createdNo?: string } | null)?.createdNo;
  const roles = normalizeRoles(user);
  const canViewAll = roles.includes('admin');
  const canCreatePetition = canAccess('/petitions/new');
  const canSeeTestItems = roles.length > 0 && roles.some((r) => r !== 'viewer');

  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? searchParams.get('q') ?? searchParams.get('requestNo') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const selectedStatuses = useMemo<Petition['status'][]>(() => {
    if (!status) return [];
    return status
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is Petition['status'] => visibleStatuses.includes(s as Petition['status']));
  }, [status, visibleStatuses]);

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  const params = useMemo(
    () => ({
      page: canViewAll ? page : 1,
      limit: canViewAll ? PAGE_SIZE : 500,
      status: status || undefined,
      search: search || undefined,
    }),
    [page, status, search, canViewAll],
  );
  const { data, loading, error, refresh } = usePetitionList(params);

  // Push bell notification for rejected petitions owned by the current user.
  // NotificationContext de-dupes by id, so this is safe to run on every refresh.
  const { push } = useNotifications();
  useEffect(() => {
    if (!user?.employeeId || !data?.items) return;
    for (const p of data.items) {
      if (p.status !== 'rejected') continue;
      if (p.submittedBy?.employeeId !== user.employeeId) continue;
      const rejectEntry = [...(p.reviewHistory ?? [])].reverse().find((e) => e.action === 'reject');
      if (!rejectEntry) continue;
      push({
        id: `petition-rejected-${p._id}`,
        title: `คำร้อง ${p.petitionNo} ถูกส่งกลับให้แก้ไข`,
        message: rejectEntry.note,
        level: 'warning',
        link: `/petitions/${p._id}`,
        persistent: true,
      });
    }
  }, [user?.employeeId, data?.items, push]);

  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  useEffect(() => {
    if (!canSeeTestItems) {
      setParamsLoaded(true);
      return;
    }
    api.getParameters()
      .then(setParameters)
      .catch(() => {})
      .finally(() => setParamsLoaded(true));
  }, [canSeeTestItems]);

  const isLabUser = normalizeRoles(user).some(isLabRole);
  // For lab users, only parameters readable by lab (lab scope or qc-shared-with-lab)
  // are relevant — both for the displayed parameter list and for deciding which
  // petitions should appear at all.
  const displayParameters = useMemo<ParameterItem[]>(
    () =>
      isLabUser
        ? parameters.filter(
            (p) => p.scope === 'lab' || (p.scope === 'qc' && p.shareWithLab === true),
          )
        : parameters,
    [parameters, isLabUser],
  );

  const ownedItems = useMemo(() => {
    if (!data?.items) return [];
    let items = canViewAll ? data.items : data.items.filter((p) => canSeePetition(p, user));
    if (isLabUser && paramsLoaded) {
      items = items.filter((p) => petitionHasLabReadableItem(p, displayParameters));
    }
    return items;
  }, [data?.items, canViewAll, user, isLabUser, paramsLoaded, displayParameters]);

  const totalCount = canViewAll ? data?.total ?? 0 : ownedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const visibleItems = canViewAll
    ? ownedItems
    : ownedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateParams(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    setSearchParams(sp, { replace: false });
  }

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search: searchInput.trim() || undefined, page: undefined });
  }

  function clearFilters() {
    setSearchInput('');
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  const hasFilters = !!status || !!search;

  const emptyTitle = hasFilters
    ? 'ไม่พบคำร้องตามเงื่อนไขที่ค้นหา'
    : canViewAll
      ? 'ยังไม่มีคำร้องในระบบ'
      : 'ยังไม่มีคำร้องที่คุณยื่นหรือได้รับมอบหมาย';

  const columns: DataTableColumn<Petition>[] = [
    {
      key: 'no',
      header: 'เลขที่คำร้อง',
      cell: (p) => <span className="font-medium text-primary-500">{p.petitionNo}</span>,
    },
    { key: 'submitter', header: 'ผู้ยื่น', cell: (p) => p.submittedBy?.name ?? '-' },
    { key: 'dept', header: 'แผนก', cell: (p) => PETITION_DEPT_LABELS[p.dept] },
    {
      key: 'sample',
      header: 'ชื่อตัวอย่าง',
      cell: (p) => p.items?.map((it) => it.sampleName).filter(Boolean).join(', ') || '-',
    },
    ...(canSeeTestItems
      ? [
          {
            key: 'tests',
            header: 'รายการทดลอง',
            className: 'max-w-[280px] whitespace-pre-wrap text-sm text-grey-700',
            cell: (p: Petition) => parameterNamesForPetition(p, displayParameters).join(' • ') || '-',
          } as DataTableColumn<Petition>,
        ]
      : []),
    {
      key: 'status',
      header: 'สถานะ',
      cell: (p) => {
        const b = statusBadge(p.status);
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
    },
    {
      key: 'date',
      header: 'วันที่ยื่น',
      className: 'text-grey-500',
      cell: (p) =>
        new Date(p.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }),
    },
  ];

  return (
    <AppLayout>
        <div className="space-y-4">
          <PageHeader
            title="รายการคำร้อง"
            description="รายการคำร้องขอตรวจตัวอย่างทั้งหมดในระบบ"
            actions={
              canCreatePetition ? (
                <Button onClick={() => navigate('/petitions/new')}>
                  <FilePlus2 className="h-4 w-4" />
                  ยื่นคำร้องใหม่
                </Button>
              ) : undefined
            }
          />

          {createdNo && (
            <div className="rounded-[10px] border border-green-500 bg-green-50 p-3 text-sm text-green-500">
              บันทึกคำร้องเลขที่ <strong>{createdNo}</strong> เรียบร้อยแล้ว
            </div>
          )}
          {error && (
            <div className="rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500 flex items-center justify-between gap-3">
              <span>โหลดรายการไม่สำเร็จ: {error}</span>
              <Button variant="danger-outline" size="sm" onClick={refresh}>
                ลองใหม่
              </Button>
            </div>
          )}

          <form
            onSubmit={applySearch}
            className="flex flex-wrap items-end gap-3 rounded-[10px] border border-black-50 bg-white p-3"
          >
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-500" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="ค้นหาเลขที่คำร้อง / ชื่อผู้ยื่น / แผนก..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-56">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                      selectedStatuses.length === 0 && 'text-grey-500',
                    )}
                  >
                    <span className="truncate text-left">
                      {selectedStatuses.length === 0
                        ? 'สถานะทั้งหมด'
                        : selectedStatuses.length === 1
                          ? PETITION_STATUS_CONFIG[selectedStatuses[0]].label
                          : `เลือก ${selectedStatuses.length} สถานะ`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
                  <div className="flex items-center justify-between px-1 pb-2 border-b border-black-50 mb-1">
                    <span className="text-xs font-medium text-grey-700">เลือกสถานะ</span>
                    {selectedStatuses.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-primary-500 hover:underline"
                        onClick={() => updateParams({ status: undefined, page: undefined })}
                      >
                        ล้าง
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {visibleStatuses.map((s) => {
                      const checked = selectedStatuses.includes(s);
                      return (
                        <label
                          key={s}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = v
                                ? [...selectedStatuses, s]
                                : selectedStatuses.filter((x) => x !== s);
                              updateParams({
                                status: next.length ? next.join(',') : undefined,
                                page: undefined,
                              });
                            }}
                          />
                          <span>{PETITION_STATUS_CONFIG[s].label}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Button type="submit" size="default">
              ค้นหา
            </Button>
            {hasFilters && (
              <Button type="button" variant="ghost" size="default" onClick={clearFilters}>
                <X className="h-4 w-4" />
                ล้างตัวกรอง
              </Button>
            )}
          </form>

          <DataTable
            columns={columns}
            data={visibleItems}
            rowKey={(p) => p._id}
            isLoading={loading}
            onRowClick={(p) => navigate(`/petitions/${p._id}`)}
            emptyTitle={emptyTitle}
            tableClassName="min-w-[700px]"
          />

          {data && totalCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-grey-500">
                แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} จาก{' '}
                {totalCount} รายการ
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary-outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: String(page - 1) })}
                >
                  <ChevronLeft className="h-4 w-4" />
                  ก่อนหน้า
                </Button>
                <span className="text-black-500 font-medium">
                  หน้า {page} / {totalPages}
                </span>
                <Button
                  variant="primary-outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => updateParams({ page: String(page + 1) })}
                >
                  ถัดไป
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
    </AppLayout>
  );
}
