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
import {
  PETITION_STATUSES,
  PETITION_STATUS_CONFIG,
} from '@/types/petition.types';

const PAGE_SIZE = 20;

export default function PetitionListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleStatuses = PETITION_STATUSES;
  const createdNo = (location.state as { createdNo?: string } | null)?.createdNo;

  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, status: status || undefined, search: search || undefined }),
    [page, status, search],
  );
  const { data, loading, error, refresh } = usePetitionList(params);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

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
              <Button variant="primary" onClick={() => navigate('/petitions/new')}>
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
            <Button type="submit" variant="primary" size="default">
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
                  <TableHead>ชื่อตัวอย่าง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่ยื่น</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-grey-500 py-8">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && data && data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-grey-500 py-8">
                      {hasFilters ? 'ไม่พบคำร้องตามเงื่อนไขที่ค้นหา' : 'ยังไม่มีคำร้องในระบบ'}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  data?.items.map((p) => {
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

          {data && data.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-grey-500">
                แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} จาก{' '}
                {data.total} รายการ
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
