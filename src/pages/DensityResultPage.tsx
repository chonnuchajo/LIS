import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Gauge, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

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

  const { data, isFetching } = useQuery({
    queryKey: ['result-densities', page],
    queryFn: () => api.getResultDensities({ page, limit: LIMIT }),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });

  const docs = data?.docs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-800">ผล Density</h1>
          {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            ทั้งหมด {total.toLocaleString()} รายการ • อัปเดตทุก 30 วิ
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
                  {isFetching ? 'กำลังโหลด...' : 'ยังไม่มีข้อมูล'}
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
  );
}
