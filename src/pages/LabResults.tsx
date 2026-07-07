import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/lis/AppLayout";
import { usePetitionList } from "@/hooks/usePetition";
import { PETITION_DEPT_LABELS, type Petition } from "@/types/petition.types";

export default function LabResults() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // คำร้องฝั่ง Lab ที่หัวหน้าห้องปฏิบัติการอนุมัติผลแล้ว
  const { data, loading } = usePetitionList({ labApproved: true, limit: 100 });

  const rows = useMemo(() => {
    const items = (data?.items ?? []) as Petition[];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      `${p.petitionNo} ${p.submittedBy?.name ?? ""}`.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-lis-text">ผลวิเคราะห์ Lab</h1>
          <p className="text-sm text-gray-500">คำร้องที่หัวหน้าห้องปฏิบัติการอนุมัติผลแล้ว</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเลขคำร้อง / ผู้ส่ง"
            className="rounded-md border px-3 py-1.5 text-sm"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">เลขคำร้อง</th>
                <th className="px-3 py-2">แผนก</th>
                <th className="px-3 py-2">ผู้ส่ง</th>
                <th className="px-3 py-2">วันที่อนุมัติ Lab</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">กำลังโหลด…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">ยังไม่มีคำร้องที่หัวหน้า Lab อนุมัติ</td></tr>
              )}
              {rows.map((p) => (
                <tr
                  key={p._id}
                  onClick={() => navigate(`/lab-results/${p._id}`)}
                  className="cursor-pointer border-t hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium">{p.petitionNo}</td>
                  <td className="px-3 py-2">{PETITION_DEPT_LABELS[p.dept]}</td>
                  <td className="px-3 py-2">{p.submittedBy?.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    {p.labApprovedAt ? new Date(p.labApprovedAt).toLocaleDateString("th-TH") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
