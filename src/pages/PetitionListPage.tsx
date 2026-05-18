import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FilePlus2, Search, X } from 'lucide-react';
import AppSidebar from '@/components/lis/AppSidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePetitionList } from '@/hooks/usePetition';
import { useAuth } from '@/hooks/useAuth';
import { formatPetitionWorkSections } from '@/lib/petitionSections';
import {
  PETITION_STATUSES,
  PETITION_STATUS_CONFIG,
  type Petition,
} from '@/types/petition.types';

const norm = (value?: string | null) => (value ?? '').trim().toLowerCase();

const RECEIVER_ROLES = new Set(['qc', 'lab']);
const RECEIVED_STATUSES = new Set<Petition['status']>([
  'sampleSent',
  'pendingReview',
  'inProgress',
  'success',
]);

function isOwnSubmission(
  petition: Petition,
  user: { email?: string; name?: string } | null,
): boolean {
  if (!user) return false;
  const userEmail = norm(user.email);
  const userName = norm(user.name);
  const requesterEmail = norm(petition.requester.email);
  const requesterName = norm(petition.requester.fullName);

  if (userEmail && requesterEmail && userEmail === requesterEmail) return true;
  if (userName && requesterName && userName === requesterName) return true;
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

function canSeePetition(
  petition: Petition,
  user: { email?: string; name?: string; role?: string } | null,
): boolean {
  if (!user) return false;
  const role = user.role ?? '';
  if (isOwnSubmission(petition, user)) return true;
  if (isAssignedTo(petition, user)) return true;
  if (RECEIVER_ROLES.has(role) && RECEIVED_STATUSES.has(petition.status)) return true;
  return false;
}

const PAGE_SIZE = 20;

export default function PetitionListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const visibleStatuses = PETITION_STATUSES;
  const createdNo = (location.state as { createdNo?: string } | null)?.createdNo;
  const canViewAll = user?.role === 'admin';

  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

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

  const ownedItems = useMemo(() => {
    if (!data?.items) return [];
    if (canViewAll) return data.items;
    return data.items.filter((p) => canSeePetition(p, user));
  }, [data?.items, canViewAll, user]);

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

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-black-500">รายการคำร้อง</h1>
              <p className="text-sm text-grey-500">รายการคำร้องขอตรวจตัวอย่างทั้งหมดในระบบ</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => navigate('/petitions/new')}>
                <FilePlus2 className="h-4 w-4" />
                ยื่นคำร้องใหม่
              </Button>
            </div>
          </div>

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
            <div className="w-full md:w-56">
              <NativeSelect
                value={status}
                onChange={(e) => updateParams({ status: e.target.value || undefined, page: undefined })}
              >
                <option value="">สถานะทั้งหมด</option>
                {visibleStatuses.map((s) => (
                  <option key={s} value={s}>
                    {PETITION_STATUS_CONFIG[s].label}
                  </option>
                ))}
              </NativeSelect>
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

          <div className="rounded-[10px] border border-black-50 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่คำร้อง</TableHead>
                  <TableHead>ผู้ยื่น</TableHead>
                  <TableHead>แผนก</TableHead>
                  <TableHead>ส่วนงาน</TableHead>
                  <TableHead>ชื่อตัวอย่าง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่ยื่น</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-grey-500 py-8">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && data && visibleItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-grey-500 py-8">
                      {hasFilters
                        ? 'ไม่พบคำร้องตามเงื่อนไขที่ค้นหา'
                        : canViewAll
                          ? 'ยังไม่มีคำร้องในระบบ'
                          : 'ยังไม่มีคำร้องที่คุณยื่นหรือได้รับมอบหมาย'}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  visibleItems.map((p) => {
                    const statusCfg =
                      PETITION_STATUS_CONFIG[p.status] ?? { label: p.status, variant: 'gray-soft' as const };
                    return (
                      <TableRow
                        key={p._id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/petitions/${p._id}`)}
                      >
                        <TableCell className="font-medium text-primary-500">{p.petitionNo}</TableCell>
                        <TableCell>{p.requester.fullName}</TableCell>
                        <TableCell>{p.requester.department}</TableCell>
                        <TableCell>
                          <Badge variant="primary-soft">{formatPetitionWorkSections(p)}</Badge>
                        </TableCell>
                        <TableCell>
                          {p.items?.map((it) => it.sampleName).filter(Boolean).join(', ') || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-grey-500">
                          {new Date(p.createdAt).toLocaleString('th-TH', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

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
      </main>
    </div>
  );
}
