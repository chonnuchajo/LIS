import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Gauge, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function DensityResultPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: densities = [], isFetching } = useQuery({
    queryKey: ['densities'],
    queryFn: () => api.getDensities(),
    refetchInterval: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (sampleId: string) => api.deleteDensity(sampleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['densities'] }),
  });

  function formatSentAt(sentAt: string) {
    if (!sentAt) return '-';
    const d = new Date(sentAt);
    if (isNaN(d.getTime())) return sentAt;
    return d.toLocaleString('th-TH', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-800">ผล Density</h1>
          {isFetching && (
            <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>
        <span className="text-xs text-gray-400">อัปเดตอัตโนมัติทุก 30 วินาที</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">ชื่อตัวอย่าง</th>
              <th className="px-4 py-3 text-left">Sample ID</th>
              <th className="px-4 py-3 text-right">Density</th>
              <th className="px-4 py-3 text-left">วันเวลาที่รับ</th>
              <th className="px-4 py-3 text-center">ลบ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {densities.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  ยังไม่มีข้อมูล Density
                </td>
              </tr>
            ) : (
              densities.map((row, idx) => (
                <tr key={row.sampleId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{row.sampleName}</td>
                  <td className="px-4 py-3 text-gray-600">{row.sampleId}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">
                    {typeof row.density === 'number' ? row.density.toFixed(4) : row.density}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatSentAt(row.sentAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`ลบข้อมูล "${row.sampleName}" ใช่หรือไม่?`)) {
                          deleteMutation.mutate(row.sampleId);
                        }
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
