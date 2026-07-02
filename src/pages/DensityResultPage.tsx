import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Gauge, RefreshCw, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';

const LIMIT = 100;

function statusBadge(status: string) {
  if (!status) return null;
  const isValid = String(status).toLowerCase() === 'valid';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {status}
    </span>
  );
}

export default function DensityResultPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedProduct, setAppliedProduct] = useState('');
  const [appliedDate, setAppliedDate] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['result-densities', page, appliedSearch, appliedProduct, appliedDate, appliedStatus],
    queryFn: () => api.getResultDensities({
      page,
      limit: LIMIT,
      search: appliedSearch || undefined,
      product: appliedProduct || undefined,
      date: appliedDate || undefined,
      status: appliedStatus || undefined,
    }),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['result-density-products'],
    queryFn: () => api.getResultDensityProducts(),
    staleTime: 5 * 60_000,
  });

  const docs = data?.docs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function applyFilters() {
    setPage(1);
    setAppliedSearch(search);
    setAppliedProduct(product);
    setAppliedDate(date);
    setAppliedStatus(status);
  }

  function clearFilters() {
    setSearch('');
    setProduct('');
    setDate('');
    setStatus('');
    setPage(1);
    setAppliedSearch('');
    setAppliedProduct('');
    setAppliedDate('');
    setAppliedStatus('');
  }

  const hasActiveFilter = appliedSearch || appliedProduct || appliedDate || appliedStatus;

  return (
    <AppLayout>
    <div className="p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-800">ผล Density</h1>
          {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {total.toLocaleString()} รายการ • รีเฟรชทุก 30 วิ
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-gray-500">{page}/{totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        {/* Search */}
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label className="text-xs text-gray-500">ค้นหา (Sample ID / ชื่อ)</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="พิมพ์แล้วกด Enter..."
              className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Product filter */}
        <div className="flex min-w-[160px] flex-col gap-1">
          <label className="text-xs text-gray-500">Product</label>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="rounded-md border border-gray-200 py-1.5 px-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            <option value="">ทั้งหมด</option>
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Date filter */}
        <div className="flex min-w-[160px] flex-col gap-1">
          <label className="text-xs text-gray-500">วันที่</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-gray-200 py-1.5 px-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>

        {/* Status filter */}
        <div className="flex min-w-[140px] flex-col gap-1">
          <label className="text-xs text-gray-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-gray-200 py-1.5 px-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            <option value="">All</option>
            <option value="Valid">Valid</option>
            <option value="Error">Error</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            ค้นหา
          </button>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" />
              ล้าง
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Sample ID</th>
              <th className="px-4 py-3 text-left">Sample Name</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-right">Density [g/cm³]</th>
              <th className="px-4 py-3 text-right">T(block) [°C]</th>
              <th className="px-4 py-3 text-right">T(set) [°C]</th>
              <th className="px-4 py-3 text-left">วันเวลา</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {docs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  {isFetching ? 'กำลังโหลด...' : 'ไม่พบข้อมูล'}
                </td>
              </tr>
            ) : (
              docs.map((row, idx) => (
                <tr key={String(row._id)} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400">{(page - 1) * LIMIT + idx + 1}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{String(row['Sample ID'] ?? '')}</td>
                  <td className="px-4 py-2.5 text-gray-800">{String(row['Sample name'] ?? '')}</td>
                  <td className="px-4 py-2.5 text-gray-600">{String(row['Product name'] ?? '')}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-blue-700">
                    {String(row['Density [g/cm³]'] ?? '')}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-600">{String(row['T (block) [°C]'] ?? '')}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-600">{String(row['T (set) [°C]'] ?? '')}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{String(row['Date & time'] ?? '')}</td>
                  <td className="px-4 py-2.5 text-center">{statusBadge(String(row['Measurement status'] ?? ''))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </AppLayout>
  );
}
