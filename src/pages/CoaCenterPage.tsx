import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FileCheck2, FilePlus2 } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CoaCreateDialog from "@/components/coa/CoaCreateDialog";
import CoaStatusBadge from "@/components/coa/CoaStatusBadge";
import { api } from "@/lib/api";

type CoaTab = "today" | "all";

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === new Date().toDateString();
}

export default function CoaCenterPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<CoaTab>("today");
  const { data, isLoading } = useQuery({ queryKey: ["coa", "documents"], queryFn: () => api.getCoaDocuments() });

  const items = useMemo(() => data?.items ?? [], [data]);
  const todayCount = useMemo(() => items.filter((doc) => isToday(doc.createdAt)).length, [items]);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scopedItems = activeTab === "today" ? items.filter((doc) => isToday(doc.createdAt)) : items;
    if (!query) return scopedItems;
    return scopedItems.filter((doc) => `${doc.coaNo || ""} ${doc.petitionNoSnapshot || ""}`.toLowerCase().includes(query));
  }, [activeTab, items, search]);

  const tabs: Array<{ key: CoaTab; label: string; count: number }> = [
    { key: "today", label: "คำขอ COA วันนี้", count: todayCount },
    { key: "all", label: "คำขอ COA ทั้งหมด", count: items.length },
  ];

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-64px)] bg-sky-50 p-6">
        <div className="space-y-5">
          <PageHeader
            title={(
              <span className="inline-flex items-center gap-2 text-violet-950">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                  <FileCheck2 className="h-5 w-5" />
                </span>
                ออกเอกสาร COA
              </span>
            )}
            actions={(
              <Button
                className="gap-2 bg-violet-700 text-white shadow-sm hover:bg-violet-800"
                onClick={() => setCreateOpen(true)}
              >
                <FilePlus2 className="h-4 w-4" />
                สร้าง COA
              </Button>
            )}
          />

          <div className="rounded-md border border-violet-100 bg-white p-4 shadow-sm">
            <div className="mb-4 inline-flex rounded-md border border-violet-100 bg-violet-50 p-1">
              {tabs.map((tab) => {
                const selected = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={selected}
                    className={`inline-flex min-h-9 items-center gap-2 rounded px-3 text-sm font-medium transition-colors ${
                      selected
                        ? "bg-white text-violet-950 shadow-sm"
                        : "text-violet-600 hover:bg-white/70 hover:text-violet-900"
                    }`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-emerald-50 text-emerald-700" : "bg-violet-100 text-violet-600"}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <Input
              className="max-w-sm border-violet-100 bg-white text-violet-950 placeholder:text-violet-400 focus-visible:ring-violet-300"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหา COA / คำร้อง"
            />
          </div>

          <div className="overflow-x-auto rounded-md border border-violet-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-violet-50 text-left text-xs font-semibold text-violet-900">
                <tr>
                  <th className="px-4 py-3">COA No.</th>
                  <th className="px-4 py-3">Revision</th>
                  <th className="px-4 py-3">เลขคำร้อง</th>
                  <th className="px-4 py-3">ตัวอย่าง</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">พิมพ์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-50">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-violet-500">กำลังโหลด...</td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-violet-500">ยังไม่มีเอกสาร COA</td>
                  </tr>
                )}
                {rows.map((doc) => (
                  <tr
                    key={doc._id}
                    className="cursor-pointer text-slate-700 transition-colors hover:bg-emerald-50/70"
                    onClick={() => navigate(`/coa/${doc._id}`)}
                  >
                    <td className="px-4 py-3 font-semibold text-violet-950">{doc.coaNo || "ร่าง"}</td>
                    <td className="px-4 py-3">{doc.revision ? `Rev.${doc.revision}` : "-"}</td>
                    <td className="px-4 py-3">{doc.petitionNoSnapshot || "-"}</td>
                    <td className="px-4 py-3">
                      {doc.sampleSnapshots?.map((sample) => sample.sampleName || sample.commonName).filter(Boolean).join(", ") || `${doc.selectedItemSeqs.length} รายการ`}
                    </td>
                    <td className="px-4 py-3"><CoaStatusBadge status={doc.status} /></td>
                    <td className="px-4 py-3 text-emerald-700">{doc.print?.printCount || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <CoaCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/coa/${id}`)} />
    </AppLayout>
  );
}
