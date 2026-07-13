import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Search,
  X,
} from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import PageHeader from '@/components/lis/PageHeader';
import PageToolbar from '@/components/lis/PageToolbar';
import PetitionStatusTimeline from '@/components/lis/PetitionStatusTimeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/hooks/useAuth';
import { useCanAccessPath } from '@/hooks/useCanAccessPath';
import { useItemGroupMembership } from '@/hooks/useItemGroupMembership';
import { usePetitionList } from '@/hooks/usePetition';
import { api, type ParameterItem } from '@/lib/api';
import { parameterNamesForPetition } from '@/lib/petitionTestItems';
import {
  canSeePetition,
  canUserCreatePetition as canUserCreatePetitionShared,
  isLabRole,
  isLabBatchNo,
  petitionHasLabReadableItem,
} from '@/lib/petitionVisibility';
import { normalizeRoles } from '@/lib/roles';
import { petitionStatusBadge } from '@/lib/statusBadge';
import { cn } from '@/lib/utils';
import {
  PETITION_DEPT_LABELS,
  PETITION_STATUS_CONFIG,
  PETITION_STATUSES,
  type Petition,
} from '@/types/petition.types';

const PAGE_SIZE = 20;

const SUMMARY_STATUS_GROUPS: Array<{
  key: string;
  label: string;
  hint: string;
  statuses: Petition['status'][];
}> = [
  { key: '', label: 'ทั้งหมด', hint: 'คำร้องทั้งหมดในมุมมองนี้', statuses: [] },
  { key: 'sampleSent', label: 'รอตรวจรับ', hint: 'งานที่ต้องรับเข้ากระบวนการ', statuses: ['sampleSent'] },
  {
    key: 'pendingReview,inProgress',
    label: 'กำลังดำเนินการ',
    hint: 'งานที่กำลังตรวจวิเคราะห์',
    statuses: ['pendingReview', 'inProgress'],
  },
  { key: 'rejected', label: 'ส่งกลับแก้ไข', hint: 'คำร้องที่รอผู้ยื่นแก้ไข', statuses: ['rejected'] },
];

export function canUserCreatePetition(
  user: { role?: string; roles?: string[] } | null | undefined,
  canAccessNewPetition: boolean,
): boolean {
  return canUserCreatePetitionShared(user, canAccessNewPetition);
}

export type PetitionListPageProps = {
  petitionDetailPath?: (petition: Petition) => string;
  title?: string;
  description?: string;
};

function petitionMetaLine(petition: Petition) {
  return [
    petition.submittedBy?.name,
    PETITION_DEPT_LABELS[petition.dept],
    new Date(petition.createdAt).toLocaleString('th-TH', {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
  ]
    .filter(Boolean)
    .join(' • ');
}

function displayPerson(name?: string | null) {
  const value = (name ?? '').trim();
  return value || 'ยังไม่มี';
}

function petitionOwnerLine(petition: Petition) {
  const qcOwner = petition.qcReceivedBy?.trim();
  const labOwner = petition.labReceivedBy?.trim();
  return `QC: ${displayPerson(qcOwner)} | Lab: ${displayPerson(labOwner)}`;
}

function petitionNextStepText(petition: Petition) {
  if (petition.status === 'sampleSent') return 'สิ่งที่ต้องทำ: รอรับตัวอย่างเข้ากระบวนการ';
  if (petition.status === 'pendingReview' && !petition.assignedTo) {
    return 'สิ่งที่ต้องทำ: รอ assign ผู้รับงาน';
  }
  if (petition.status === 'rejected') return 'หมายเหตุ: คำร้องนี้ถูกส่งกลับเพื่อแก้ไข';
  if (petition.qcReceivedBy || petition.labReceivedBy) return `ผู้รับผิดชอบ: ${petitionOwnerLine(petition)}`;
  if (petition.status === 'inProgress') return 'สิ่งที่ต้องทำ: อยู่ระหว่างดำเนินการ';
  if (petition.status === 'approved' || petition.status === 'success') return 'สถานะ: งานนี้เสร็จสิ้นแล้ว';
  return 'สิ่งที่ต้องทำ: ตรวจสอบรายละเอียดคำร้อง';
}

export default function PetitionListPage({
  petitionDetailPath = (petition) => `/petitions/${petition._id}`,
  title = 'รายการคำร้อง',
  description = 'ดูคำร้องทั้งหมดและงานที่ต้องดำเนินการต่อ',
}: PetitionListPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canAccess = useCanAccessPath();
  const visibleStatuses = PETITION_STATUSES;
  const createdNo = (location.state as { createdNo?: string } | null)?.createdNo;
  const roles = normalizeRoles(user);
  const canViewAll = roles.includes('admin');
  const canCreatePetition = canUserCreatePetition(user, canAccess('/petitions/new'));
  const canSeeTestItems = roles.length > 0 && roles.some((r) => r !== 'viewer');
  const groupMembership = useItemGroupMembership();

  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? searchParams.get('q') ?? searchParams.get('requestNo') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const highlightIds = (searchParams.get('highlight') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const highlightKey = highlightIds.join(',');
  const highlightSet = new Set(highlightIds);

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

  const { data: highlighted = [] } = useQuery({
    queryKey: ['petitions', 'highlight', highlightKey],
    enabled: highlightIds.length > 0,
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/petitions?ids=${encodeURIComponent(highlightKey)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return [];
      const body = await res.json();
      return (body.items ?? []) as Petition[];
    },
  });

  const { push } = useNotifications();
  useEffect(() => {
    if (!user?.employeeId || !data?.items) return;
    for (const petition of data.items) {
      if (petition.status !== 'rejected') continue;
      if (petition.submittedBy?.employeeId !== user.employeeId) continue;
      const rejectEntry = [...(petition.reviewHistory ?? [])].reverse().find((e) => e.action === 'reject');
      if (!rejectEntry) continue;
      push({
        id: `petition-rejected-${petition._id}`,
        title: `คำร้อง ${petition.petitionNo} ถูกส่งกลับให้แก้ไข`,
        message: rejectEntry.note,
        level: 'warning',
        link: `/petitions/${petition._id}`,
        persistent: true,
      });
    }
  }, [data?.items, push, user?.employeeId]);

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
  const displayParameters = useMemo<ParameterItem[]>(
    () =>
      isLabUser
        ? parameters.filter((p) => p.scope === 'lab' || (p.scope === 'qc' && p.shareWithLab === true))
        : parameters,
    [isLabUser, parameters],
  );

  // Single source of truth for "can this user see this petition" — reused for both
  // the paginated list AND the dashboard-highlight group below, so a shared/bookmarked
  // ?highlight= link can never show a non-admin user a petition outside their scope.
  const applyVisibilityFilter = useCallback(
    (items: Petition[]) => {
      let result = canViewAll ? items : items.filter((petition) => canSeePetition(petition, user));
      if (isLabUser && paramsLoaded) {
        result = result.filter((petition) =>
          petitionHasLabReadableItem(petition, displayParameters, groupMembership),
        );
      }
      return result;
    },
    [canViewAll, displayParameters, groupMembership, isLabUser, paramsLoaded, user],
  );

  const ownedItems = useMemo(
    () => (data?.items ? applyVisibilityFilter(data.items) : []),
    [applyVisibilityFilter, data?.items],
  );

  const visibleHighlighted = useMemo(
    () => applyVisibilityFilter(highlighted),
    [applyVisibilityFilter, highlighted],
  );

  const totalCount = canViewAll ? data?.total ?? 0 : ownedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const visibleItems = canViewAll
    ? ownedItems
    : ownedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateParams(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
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

  const summaryCards = SUMMARY_STATUS_GROUPS.map((group) => {
    const count = group.statuses.length === 0
      ? totalCount
      : ownedItems.filter((petition) => group.statuses.includes(petition.status)).length;
    const active =
      (group.key === '' && selectedStatuses.length === 0) ||
      (group.statuses.length > 0 &&
        selectedStatuses.length === group.statuses.length &&
        group.statuses.every((statusItem) => selectedStatuses.includes(statusItem)));
    return { ...group, count, active };
  });

  const renderPetitionCard = (petition: Petition, isHighlighted = false) => {
    const statusBadge = petitionStatusBadge(petition);
    const sampleNames = petition.items
      .map((item) => item.sampleName)
      .filter((item): item is string => Boolean(item));
    const primarySample = sampleNames[0] ?? '-';
    const extraSamples = Math.max(0, sampleNames.length - 1);
    const testItems = canSeeTestItems
      ? parameterNamesForPetition(petition, displayParameters)
      : [];

    return (
      <Card
        key={petition._id}
        onOpen={() => navigate(petitionDetailPath(petition))}
        className={cn(
          'w-full rounded-2xl border-black-50 p-4 text-left transition hover:border-primary-200 hover:bg-grey-50/40',
          isHighlighted && 'border-amber-300 bg-amber-50 hover:bg-amber-50',
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-primary-500">{petition.petitionNo}</p>
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              <Badge variant="blue-soft">{PETITION_DEPT_LABELS[petition.dept]}</Badge>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-black-500">{primarySample}</p>
                {extraSamples > 0 && <Badge variant="gray-soft">+อีก {extraSamples}</Badge>}
                <span className="text-xs text-grey-500">{petition.items.length} รายการ</span>
              </div>
              {testItems.length > 0 && (
                <p className="line-clamp-2 text-sm text-grey-600">
                  {testItems.slice(0, 4).join(' • ')}
                  {testItems.length > 4 ? ` • +อีก ${testItems.length - 4}` : ''}
                </p>
              )}
              <p className="text-xs text-grey-500">{petitionMetaLine(petition)}</p>
            </div>

            <div className="rounded-xl bg-grey-50 px-3 py-2 text-sm text-grey-700">
              {petitionNextStepText(petition)}
            </div>

            <PetitionStatusTimeline petition={petition} compact />
          </div>
        </div>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <PageHeader
          title={title}
          description={description}
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
          <div className="rounded-[10px] border border-green-500 bg-green-50 p-3 text-sm text-green-600">
            บันทึกคำร้องเลขที่ <strong>{createdNo}</strong> เรียบร้อยแล้ว
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500">
            <span>โหลดรายการไม่สำเร็จ: {error}</span>
            <Button variant="danger-outline" size="sm" onClick={refresh}>
              ลองใหม่
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Card
              key={card.label}
              onOpen={() => updateParams({ status: card.key || undefined, page: undefined })}
              className={cn(
                "rounded-2xl p-4 text-left transition-all",
                card.active
                  ? "border-primary-300 bg-primary-50 shadow-sm ring-1 ring-primary-100"
                  : "border-black-50 hover:border-primary-200 hover:bg-grey-50/50",
              )}
            >
              <p className="text-sm font-medium text-grey-600">{card.label}</p>
              <p className="mt-2 text-3xl font-bold text-black-500">{card.count}</p>
              <p className="mt-1 text-xs text-grey-500">{card.hint}</p>
            </Card>
          ))}
        </div>

        <form onSubmit={applySearch} className="rounded-2xl border border-black-50 bg-white p-4">
          <PageToolbar
            search={{
              value: searchInput,
              onChange: setSearchInput,
              placeholder: 'ค้นหาเลขคำร้อง, ผู้ยื่น, ชื่อตัวอย่าง',
            }}
            filters={
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex h-10 min-w-[210px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
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
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
                  <div className="mb-1 flex items-center justify-between border-b border-black-50 px-1 pb-2">
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
                    {visibleStatuses.map((statusItem) => {
                      const checked = selectedStatuses.includes(statusItem);
                      return (
                        <label
                          key={statusItem}
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const next = value
                                ? [...selectedStatuses, statusItem]
                                : selectedStatuses.filter((item) => item !== statusItem);
                              updateParams({
                                status: next.length ? next.join(',') : undefined,
                                page: undefined,
                              });
                            }}
                          />
                          <span>{PETITION_STATUS_CONFIG[statusItem].label}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            }
            right={
              <>
                <Button type="submit">
                  <Search className="h-4 w-4" />
                  ค้นหา
                </Button>
                {hasFilters && (
                  <Button type="button" variant="ghost" onClick={clearFilters}>
                    <X className="h-4 w-4" />
                    ล้างตัวกรอง
                  </Button>
                )}
              </>
            }
          />
        </form>

        {highlightIds.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50/50 p-3">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium text-amber-800">
                ไฮไลท์ {visibleHighlighted.length} รายการจากแดชบอร์ด
              </span>
              <Button size="sm" variant="ghost" onClick={() => updateParams({ highlight: undefined })}>
                ล้างไฮไลท์
              </Button>
            </div>
            <div className="space-y-3">
              {visibleHighlighted.map((petition) => renderPetitionCard(petition, true))}
            </div>
          </div>
        )}

        <Card className="border-black-50 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">รายการคำร้อง</CardTitle>
                <p className="mt-1 text-sm text-grey-500">
                  เลือกคำร้องที่ต้องการดูต่อหรือดำเนินการขั้นถัดไป
                </p>
              </div>
              {data && totalCount > 0 && (
                <span className="text-sm text-grey-500">
                  แสดง {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalCount)} จาก {totalCount} รายการ
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-[10px] border border-dashed border-grey-200 py-12 text-center text-grey-500">
                กำลังโหลดรายการคำร้อง...
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-grey-200 py-12 text-center">
                <p className="text-sm font-medium text-black-500">{emptyTitle}</p>
                <p className="mt-1 text-xs text-grey-500">ลองเปลี่ยนตัวกรองหรือค้นหาด้วยคำอื่น</p>
              </div>
            ) : (
              visibleItems.map((petition) => renderPetitionCard(petition, highlightSet.has(petition._id)))
            )}
          </CardContent>
        </Card>

        {data && totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-grey-500">
              แสดง {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalCount)} จาก {totalCount} รายการ
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
              <span className="font-medium text-black-500">
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
