import { useState } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Search, Download, Activity } from "lucide-react";
import { useSamples } from "@/context/SampleContext";
import { doneSamples } from "@/data/mockData";

// Mock Active Log data
const activeLogData = [
  { id: "LOG-001", sampleId: "LAB-2602-002", drugName: "2,4-D Dimethylamine 72% SL", instrument: "HPLC-01", firstInjection: "2026-02-07 08:15:22", lastInjection: "2026-02-07 11:42:18", totalInjections: 12, runtime: "3h 27m" },
  { id: "LOG-002", sampleId: "LAB-2602-006", drugName: "Metalaxyl 25% WP", instrument: "GC-01", firstInjection: "2026-02-06 09:05:10", lastInjection: "2026-02-06 13:18:45", totalInjections: 8, runtime: "4h 13m" },
  { id: "LOG-003", sampleId: "LAB-2602-009", drugName: "Lambda-Cyhalothrin 2.5% EC", instrument: "HPLC-03", firstInjection: "2026-02-06 10:30:00", lastInjection: "2026-02-06 14:55:30", totalInjections: 15, runtime: "4h 25m" },
  { id: "LOG-004", sampleId: "LAB-2602-011", drugName: "Propiconazole 25% EC", instrument: "GC-03", firstInjection: "2026-02-05 08:00:15", lastInjection: "2026-02-05 12:22:50", totalInjections: 10, runtime: "4h 22m" },
];

const AdminData = () => {
  const { approvals } = useSamples();
  const [search, setSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");

  // Only show QC-approved records (complete results)
  const approvedRecords = doneSamples
    .filter(s => {
      const approval = approvals[s.id];
      return approval?.qcStatus === "approved" || approval?.qcStatus === "rejected";
    })
    .map(s => ({
      ...s,
      qcResult: approvals[s.id]?.qcStatus === "approved" ? "ผ่าน" : "ไม่ผ่าน",
      qcNote: approvals[s.id]?.qcNote,
    }));

  const filtered = approvedRecords.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.id.toLowerCase().includes(search.toLowerCase()) ||
    (r.receiver || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredLogs = activeLogData.filter(l =>
    l.sampleId.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.drugName.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.instrument.toLowerCase().includes(logSearch.toLowerCase())
  );

  const handleExport = () => {
    const headers = ["Sample ID", "ชื่อยา", "วันที่", "เวลา", "ผู้วิเคราะห์", "เครื่องมือ", "Density", "%AI", "Result", "QC", "หมายเหตุ QC"];
    const rows = filtered.map(r => [
      r.id, r.name, r.date, r.time, r.receiver || "", r.instrument || "",
      r.density ?? "", r.aiPercent ?? "", r.preResult ?? "", r.qcResult, r.qcNote || ""
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LIS_Database_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleExportLogs = () => {
    const headers = ["Log ID", "Sample ID", "ชื่อยา", "เครื่องมือ", "เข็มแรก", "เข็มสุดท้าย", "จำนวนเข็ม", "Runtime"];
    const rows = filteredLogs.map(l => [
      l.id, l.sampleId, l.drugName, l.instrument, l.firstInjection, l.lastInjection, l.totalInjections, l.runtime
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LIS_ActiveLog_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
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
          <p className="text-sm text-muted-foreground">ข้อมูลที่ผ่านการอนุมัติ QC แล้ว สำหรับการวิเคราะห์แบบ Data Driven</p>
        </div>

        <Tabs defaultValue="database">
          <TabsList className="mb-4">
            <TabsTrigger value="database" className="gap-1.5"><Database className="w-4 h-4" />ฐานข้อมูลผลลัพธ์</TabsTrigger>
            <TabsTrigger value="activelog" className="gap-1.5"><Activity className="w-4 h-4" />Active Log</TabsTrigger>
          </TabsList>

          <TabsContent value="database">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">ผลลัพธ์ที่ QC อนุมัติแล้ว ({filtered.length} รายการ)</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-60" />
                  </div>
                  <Button variant="outline" onClick={handleExport} className="gap-2">
                    <Download className="w-4 h-4" />Export CSV
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
                        <TableHead>ผู้วิเคราะห์</TableHead>
                        <TableHead>เครื่องมือ</TableHead>
                        <TableHead>Density</TableHead>
                        <TableHead>%AI</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>QC</TableHead>
                        <TableHead>หมายเหตุ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-muted-foreground py-8">ยังไม่มีข้อมูลที่ผ่านการอนุมัติ QC</TableCell>
                        </TableRow>
                      ) : filtered.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-semibold text-primary">{r.id}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.time}</TableCell>
                          <TableCell>{r.receiver || "-"}</TableCell>
                          <TableCell>{r.instrument || "-"}</TableCell>
                          <TableCell>{r.density ?? "-"}</TableCell>
                          <TableCell>{r.aiPercent != null ? `${r.aiPercent}%` : "-"}</TableCell>
                          <TableCell>{r.preResult != null ? `${r.preResult}%` : "-"}</TableCell>
                          <TableCell>
                            <Badge className={r.qcResult === "ผ่าน" ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"}>
                              {r.qcResult}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{r.qcNote || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activelog">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Active Injection Log</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">บันทึกเวลาการฉีดตัวอย่างจากเครื่อง GC/HPLC (เข็มแรก - เข็มสุดท้าย)</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="ค้นหา..." value={logSearch} onChange={e => setLogSearch(e.target.value)} className="pl-9 w-60" />
                  </div>
                  <Button variant="outline" onClick={handleExportLogs} className="gap-2">
                    <Download className="w-4 h-4" />Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Log ID</TableHead>
                        <TableHead>Sample ID</TableHead>
                        <TableHead>ชื่อยา</TableHead>
                        <TableHead>เครื่องมือ</TableHead>
                        <TableHead>เวลาฉีดเข็มแรก</TableHead>
                        <TableHead>เวลาฉีดเข็มสุดท้าย</TableHead>
                        <TableHead>จำนวนเข็ม</TableHead>
                        <TableHead>Runtime</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="font-semibold text-primary">{l.id}</TableCell>
                          <TableCell>{l.sampleId}</TableCell>
                          <TableCell>{l.drugName}</TableCell>
                          <TableCell><Badge variant="outline">{l.instrument}</Badge></TableCell>
                          <TableCell className="text-xs">{l.firstInjection}</TableCell>
                          <TableCell className="text-xs">{l.lastInjection}</TableCell>
                          <TableCell className="text-center font-semibold">{l.totalInjections}</TableCell>
                          <TableCell><Badge className="bg-accent text-accent-foreground">{l.runtime}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminData;
