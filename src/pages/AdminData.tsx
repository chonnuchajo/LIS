import { useState } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Database, Search, Download } from "lucide-react";
import { useSamples } from "@/context/SampleContext";
import { sentSamples, physicalSamples, testingSamples, doneSamples } from "@/data/mockData";

interface SampleRecord {
  id: string;
  name: string;
  date: string;
  time: string;
  sender?: string;
  receiver?: string;
  instrument?: string;
  density?: number;
  aiPercent?: number;
  preResult?: number;
  status: string;
  qcStatus?: string;
  qcNote?: string;
}

const AdminData = () => {
  const { approvals } = useSamples();
  const [search, setSearch] = useState("");

  // Combine all samples into one database view
  const allRecords: SampleRecord[] = [
    ...sentSamples.map(s => ({ ...s, status: "ส่งแล้ว" })),
    ...physicalSamples.map(s => ({ ...s, status: "ตรวจกายภาพ" })),
    ...testingSamples.map(s => ({ ...s, status: "กำลังวิเคราะห์" })),
    ...doneSamples.map(s => ({
      ...s,
      status: "เสร็จสิ้น",
      qcStatus: approvals[s.id]?.qcStatus === "approved" ? "ผ่าน" : approvals[s.id]?.qcStatus === "rejected" ? "ไม่ผ่าน" : "รอ QC",
      qcNote: approvals[s.id]?.qcNote,
    })),
  ];

  const filtered = allRecords.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.id.toLowerCase().includes(search.toLowerCase()) ||
    (r.sender || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.receiver || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const headers = ["Sample ID", "ชื่อยา", "วันที่", "เวลา", "ผู้ส่ง", "ผู้รับ", "เครื่องมือ", "Density", "%AI", "Pre-result", "สถานะ", "QC", "หมายเหตุ QC"];
    const rows = filtered.map(r => [
      r.id, r.name, r.date, r.time, r.sender || "", r.receiver || "", r.instrument || "",
      r.density ?? "", r.aiPercent ?? "", r.preResult ?? "", r.status, r.qcStatus || "", r.qcNote || ""
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LIS_Database_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "ส่งแล้ว": return "bg-blue-100 text-blue-700";
      case "ตรวจกายภาพ": return "bg-amber-100 text-amber-700";
      case "กำลังวิเคราะห์": return "bg-purple-100 text-purple-700";
      case "เสร็จสิ้น": return "bg-emerald-100 text-emerald-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6" />
            Admin - ฐานข้อมูลตัวอย่าง
          </h1>
          <p className="text-sm text-muted-foreground">ข้อมูลทั้งหมดสำหรับการวิเคราะห์แบบ Data Driven (Trend %AI, OEE, Active Log)</p>
        </div>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">รายการตัวอย่างทั้งหมด ({filtered.length} รายการ)</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-60"
                />
              </div>
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sample ID</TableHead>
                    <TableHead>ชื่อยา</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>เวลา</TableHead>
                    <TableHead>ผู้ส่ง</TableHead>
                    <TableHead>ผู้รับ/ผู้วิเคราะห์</TableHead>
                    <TableHead>เครื่องมือ</TableHead>
                    <TableHead>Density</TableHead>
                    <TableHead>%AI</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>QC</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold text-primary">{r.id}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.time}</TableCell>
                      <TableCell>{r.sender || "-"}</TableCell>
                      <TableCell>{r.receiver || "-"}</TableCell>
                      <TableCell>{r.instrument || "-"}</TableCell>
                      <TableCell>{r.density ?? "-"}</TableCell>
                      <TableCell>{r.aiPercent != null ? `${r.aiPercent}%` : "-"}</TableCell>
                      <TableCell>{r.preResult != null ? `${r.preResult}%` : "-"}</TableCell>
                      <TableCell><Badge className={statusColor(r.status)}>{r.status}</Badge></TableCell>
                      <TableCell>{r.qcStatus ? <Badge variant="outline">{r.qcStatus}</Badge> : "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{r.qcNote || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminData;
