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

export default function CoaCenterPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["coa", "documents"], queryFn: () => api.getCoaDocuments() });
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const items = data?.items ?? [];
    if (!query) return items;
    return items.filter((doc) => `${doc.coaNo || ""} ${doc.petitionNoSnapshot || ""}`.toLowerCase().includes(query));
  }, [data, search]);

  return (
    <AppLayout>
      <div className="space-y-4 p-6">
        <PageHeader
          title={<span className="inline-flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-sky-500" />เธญเธญเธเน€เธญเธเธชเธฒเธฃ COA</span>}
          actions={<Button className="gap-2" onClick={() => setCreateOpen(true)}><FilePlus2 className="h-4 w-4" />เธชเธฃเนเธฒเธ COA</Button>}
        />
        <Input className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="เธเนเธเธซเธฒ COA / เธเธณเธฃเนเธญเธ" />
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">COA No.</th>
                <th className="px-3 py-2">Revision</th>
                <th className="px-3 py-2">เน€เธฅเธเธเธณเธฃเนเธญเธ</th>
                <th className="px-3 py-2">เธ•เธฑเธงเธญเธขเนเธฒเธ</th>
                <th className="px-3 py-2">เธชเธ–เธฒเธเธฐ</th>
                <th className="px-3 py-2">เธเธดเธกเธเน</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">เธเธณเธฅเธฑเธเนเธซเธฅเธ”...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">เธขเธฑเธเนเธกเนเธกเธตเน€เธญเธเธชเธฒเธฃ COA</td></tr>}
              {rows.map((doc) => (
                <tr key={doc._id} className="cursor-pointer border-t hover:bg-gray-50" onClick={() => navigate(`/coa/${doc._id}`)}>
                  <td className="px-3 py-2 font-medium">{doc.coaNo || "เธฃเนเธฒเธ"}</td>
                  <td className="px-3 py-2">{doc.revision ? `Rev.${doc.revision}` : "-"}</td>
                  <td className="px-3 py-2">{doc.petitionNoSnapshot || "-"}</td>
                  <td className="px-3 py-2">{doc.sampleSnapshots?.map((sample) => sample.sampleName || sample.commonName).filter(Boolean).join(", ") || `${doc.selectedItemSeqs.length} เธฃเธฒเธขเธเธฒเธฃ`}</td>
                  <td className="px-3 py-2"><CoaStatusBadge status={doc.status} /></td>
                  <td className="px-3 py-2">{doc.print?.printCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <CoaCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/coa/${id}`)} />
    </AppLayout>
  );
}
