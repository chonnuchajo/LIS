import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  RefreshCw,
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
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { formatStockQuantityWithUnit } from '@/lib/stockQuantity';
import { cn } from '@/lib/utils';
import {
  PETITION_DEPT_LABELS,
  PETITION_STATUS_CONFIG,
  PETITION_STATUSES,
  type Petition,
} from '@/types/petition.types';

const PAGE_SIZE = 20;
const NEW_PETITION_PATH = '/petitions/new';

// How long a petition arriving from a dashboard drill-down stays visually marked
// before it settles back into an ordinary list card.
const HIGHLIGHT_GLOW_MS = 5000;

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

function formatSixMonthStockDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatSixMonthReferenceMonth(value?: string) {
  if (!value) return '-';
  const date = new Date(`${value}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

function SixMonthMedicineTab() {
  const [sixMonthSearch, setSixMonthSearch] = useState('');
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['stock', 'medicine-six-months'],
    queryFn: api.getSixMonthMedicineStock,
    staleTime: 5 * 60 * 1000,
  });
  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = sixMonthSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [
      item.itemNo,
      item.lotNo,
      item.locationCode,
      item.binCode,
      item.companySource,
    ].some((value) => value.toLowerCase().includes(q)));
  }, [items, sixMonthSearch]);
  const errorMessage = error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ';

  return (
    <Card className="border-black-50 shadow-none">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">List ยา 6 เดือน</CardTitle>
          <p className="mt-1 text-sm text-grey-500">
            แสดงล็อตที่อายุ 6, 12, 18... เดือนจาก registering_date · นับเฉพาะเดือน ไม่ดูวันที่ · เดือนอ้างอิง {formatSixMonthReferenceMonth(data?.referenceMonth)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={sixMonthSearch}
            onChange={(event) => setSixMonthSearch(event.target.value)}
            placeholder="ค้นหา item / lot / location"
            className="h-9 w-full min-w-[220px] sm:w-72"
          />
          <Button size="sm" variant="primary-outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            รีเฟรช
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Item No</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Registering Date</TableHead>
                <TableHead className="text-right">อายุ (เดือน)</TableHead>
                <TableHead className="text-right">Stock Qty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Company</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-grey-500">กำลังโหลดข้อมูล...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-red-500">{errorMessage}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-grey-500">ไม่มีข้อมูลครบ 6 เดือน</TableCell></TableRow>
              ) : filtered.map((item) => (
                <TableRow key={`${item.itemNo}-${item.lotNo}-${item.locationCode}-${item.binCode}-${item.registeringDate}`}>
                  <TableCell className="font-medium text-black-500">{item.itemNo || '-'}</TableCell>
                  <TableCell>{item.lotNo || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-grey-600">{formatSixMonthStockDate(item.registeringDate)}</TableCell>
                  <TableCell className="text-right"><Badge variant="outline">{item.ageMonths}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{formatStockQuantityWithUnit(item.stockQty, item.unit)}</TableCell>
                  <TableCell className="text-xs text-grey-600">{item.locationCode || '-'} / {item.binCode || '-'}</TableCell>
                  <TableCell className="text-xs text-grey-600">{item.companySource || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PetitionListPage({
  petitionDetailPath = (petition) => `/petition/${petition._id}`,
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
  const canSeeSixMonthMedicineTab = roles.includes('admin') || roles.includes('qc-head');
  const canCreatePetition = canUserCreatePetition(user, canAccess(NEW_PETITION_PATH));
  const canSeeTestItems = roles.length > 0 && roles.some((r) => r !== 'viewer');
  const groupMembership = useItemGroupMembership();

  const status = searchParams.get('status') ?? '';
  const search =
    searchParams.get('search') ??
    searchParams.get('q') ??
    searchParams.get('petitionNo') ??
    searchParams.get('petition_no') ??
    searchParams.get('petitions_no') ??
    searchParams.get('requestNo') ??
    searchParams.get('request_no') ??
    '';
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
  const summaryParams = useMemo(
    () => ({
      page: 1,
      limit: canViewAll ? PAGE_SIZE : 500,
      search: search || undefined,
    }),
    [canViewAll, search],
  );
  const { data: summaryData } = usePetitionList(summaryParams);

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
        link: `/petition/${petition._id}`,
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
      !canViewAll && isLabUser
        ? parameters.filter((p) => p.scope === 'lab' || (p.scope === 'qc' && p.shareWithLab === true))
        : parameters,
    [canViewAll, isLabUser, parameters],
  );

  // Single source of truth for "can this user see this petition" — reused for both
  // the paginated list AND the dashboard-highlight group below, so a shared/bookmarked
  // ?highlight= link can never show a non-admin user a petition outside their scope.
  const applyVisibilityFilter = useCallback(
    (items: Petition[]) => {
      let result = canViewAll ? items : items.filter((petition) => canSeePetition(petition, user));
      if (!canViewAll && isLabUser && paramsLoaded) {
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

  const summaryOwnedItems = useMemo(
    () => (summaryData?.items ? applyVisibilityFilter(summaryData.items) : ownedItems),
    [applyVisibilityFilter, ownedItems, summaryData?.items],
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

  // The list is server-paginated, so a petition drilled into from the dashboard may
  // well live on another page. Pull it in from the ?ids= fetch and render it at the
  // top of the list as an ordinary card — deduped against the page it may already be on.
  const listItems = useMemo(() => {
    if (visibleHighlighted.length === 0) return visibleItems;
    const pinnedIds = new Set(visibleHighlighted.map((petition) => petition._id));
    return [...visibleHighlighted, ...visibleItems.filter((petition) => !pinnedIds.has(petition._id))];
  }, [visibleHighlighted, visibleItems]);

  const [glowing, setGlowing] = useState(true);
  useEffect(() => {
    if (!highlightKey) return;
    setGlowing(true);
    const timer = window.setTimeout(() => setGlowing(false), HIGHLIGHT_GLOW_MS);
    return () => window.clearTimeout(timer);
  }, [highlightKey]);

  const glowAnchorRef = useRef<HTMLDivElement | null>(null);
  const firstHighlightedId = visibleHighlighted[0]?._id;
  useEffect(() => {
    if (!firstHighlightedId) return;
    glowAnchorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [firstHighlightedId]);

  function updateParams(next: Record<string, string | undefined>, options?: { replace?: boolean }) {
    const sp = new URLSearchParams(searchParams);
    // Searching, filtering or paging is the user moving on from whatever the
    // dashboard sent them here to look at — the highlight goes with it.
    if (!('highlight' in next)) sp.delete('highlight');
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    setSearchParams(sp, { replace: options?.replace ?? false });
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    updateParams({ search: value.trim() || undefined, page: undefined }, { replace: true });
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

  const summaryTotalCount = canViewAll
    ? summaryData?.summaryTotal ?? summaryData?.total ?? totalCount
    : summaryOwnedItems.length;

  const summaryCards = SUMMARY_STATUS_GROUPS.map((group) => {
    const count = group.statuses.length === 0
      ? summaryTotalCount
      : canViewAll && summaryData?.statusCounts
        ? group.statuses.reduce((sum, statusItem) => sum + (summaryData.statusCounts?.[statusItem] ?? 0), 0)
        : summaryOwnedItems.filter((petition) => group.statuses.includes(petition.status)).length;
    const active =
      (group.key === '' && selectedStatuses.length === 0) ||
      (group.statuses.length > 0 &&
        selectedStatuses.length === group.statuses.length &&
        group.statuses.every((statusItem) => selectedStatuses.includes(statusItem)));
    return { ...group, count, active };
  });

  const renderPetitionCard = (
    petition: Petition,
    isGlowing = false,
    ref?: React.Ref<HTMLDivElement>,
  ) => {
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
        ref={ref}
        data-highlight={isGlowing ? 'on' : undefined}
        onOpen={() => navigate(petitionDetailPath(petition))}
        className={cn(
          'w-full rounded-2xl border-black-50 p-4 text-left transition duration-700 hover:border-primary-200 hover:bg-grey-50/40',
          isGlowing && 'border-amber-300 bg-amber-50 ring-2 ring-amber-200 hover:bg-amber-50',
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
              <Button onClick={() => navigate(NEW_PETITION_PATH)}>
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

        <Tabs defaultValue="petitions" className="space-y-4">
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <TabsList className="w-max">
              <TabsTrigger value="petitions">รายการคำร้อง</TabsTrigger>
              {canSeeSixMonthMedicineTab && (
                <TabsTrigger value="six-month-medicine">List ยา 6 เดือน</TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="petitions" className="space-y-4">
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

        <div className="rounded-2xl border border-black-50 bg-white p-4">
          <PageToolbar
            search={{
              value: searchInput,
              onChange: handleSearchChange,
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
                {hasFilters && (
                  <Button type="button" variant="ghost" onClick={clearFilters}>
                    <X className="h-4 w-4" />
                    ล้างตัวกรอง
                  </Button>
                )}
              </>
            }
          />
        </div>

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
            ) : listItems.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-grey-200 py-12 text-center">
                <p className="text-sm font-medium text-black-500">{emptyTitle}</p>
                <p className="mt-1 text-xs text-grey-500">ลองเปลี่ยนตัวกรองหรือค้นหาด้วยคำอื่น</p>
              </div>
            ) : (
              listItems.map((petition) => {
                const isHighlighted = highlightSet.has(petition._id);
                return renderPetitionCard(
                  petition,
                  isHighlighted && glowing,
                  petition._id === firstHighlightedId ? glowAnchorRef : undefined,
                );
              })
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
          </TabsContent>

          {canSeeSixMonthMedicineTab && (
            <TabsContent value="six-month-medicine">
              <SixMonthMedicineTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
