import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Droplets, FlaskConical, Clock, ImageIcon, Search, Calendar as CalendarIcon } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSamples } from "@/context/SampleContext";

// Mock physical inspection results for yesterday's samples (would come from context in production)
const mockPhysicalResults: Record<string, {
  physical: "normal" | "abnormal";
  density: number;
  densityStatus: "normal" | "abnormal";
  dissolution: number;
  dissolutionStatus: "normal" | "abnormal";
  colorMatch: "match" | "mismatch";
  prevBatchImage?: string;
  currentBatchImage?: string;
  prevBatchNo?: string;
  currentBatchNo?: string;
}> = {
  "LAB-2602-003": { physical: "normal", density: 0.987, densityStatus: "normal", dissolution: 98.5, dissolutionStatus: "normal", colorMatch: "match" },
  "LAB-2602-005": { physical: "normal", density: 1.024, densityStatus: "normal", dissolution: 99.1, dissolutionStatus: "normal", colorMatch: "match" },
  "LAB-2602-008": {
    physical: "abnormal",
    density: 1.155,
    densityStatus: "abnormal",
    dissolution: 85.2,
    dissolutionStatus: "abnormal",
    colorMatch: "mismatch",
    prevBatchNo: "B25120",
    currentBatchNo: "B26010",
    // Solid color swatches as data URLs (amber vs darker brown) — represent visible color difference
    prevBatchImage: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&h=400&fit=crop",
    currentBatchImage: "https://images.unsplash.com/photo-1559554498-bd2b8a35cb98?w=600&h=400&fit=crop",
  },
};

const Home = () => {
  const { physicalSamples, sentSamples, sentItems, realtimeDensities } = useSamples();
  const [searchName, setSearchName] = useState("");
  const [searchDate, setSearchDate] = useState(""); // yyyy-mm-dd

  const now = new Date();
  const formattedDate = now.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const currentHour = now.getHours();
  const isAfter10AM = currentHour >= 10;

  // Yesterday's samples with physical results (shown after 10 AM)
  const yesterdayResults = useMemo(() => {
    return physicalSamples.map(s => ({
      ...s,
      result: mockPhysicalResults[s.id] || null,
    })).filter(s => s.result);
  }, [physicalSamples]);

  // Apply search filters (name + date)
  const filteredResults = useMemo(() => {
    return yesterdayResults.filter(s => {
      const matchName = !searchName || s.name.toLowerCase().includes(searchName.toLowerCase());
      const matchDate = !searchDate || (s.date && s.date.includes(searchDate));
      return matchName && matchDate;
    });
  }, [yesterdayResults, searchName, searchDate]);

  const hasSearch = Boolean(searchName || searchDate);

  // Today's samples for realtime density tracking
  const todaySamples = useMemo(() => {
    const densityMap = new Map(realtimeDensities.map(d => [d.sampleId, d]));
    const allCurrent = [
      ...sentItems.map(s => ({ id: s.id, name: s.name, date: s.date, density: densityMap.get(s.id)?.density })),
      ...sentSamples.map(s => ({ id: s.id, name: s.name, date: s.date, density: densityMap.get(s.id)?.density })),
    ];
    return allCurrent;
  }, [sentItems, sentSamples, realtimeDensities]);

  const normalCount = yesterdayResults.filter(s => s.result?.physical === "normal").length;
  const abnormalCount = yesterdayResults.filter(s => s.result?.physical === "abnormal").length;

  return (
    <AppLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">หน้าแรก</h1>
          <p className="text-sm text-muted-foreground">
            รายงานผลการตรวจสอบกายภาพประจำวัน · {formattedDate}
          </p>
        </div>

        {/* Summary badges */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <Badge variant="outline" className="text-sm gap-1.5 py-1.5 px-4 text-green-600 border-green-300">
            <CheckCircle2 className="w-4 h-4" /> ปกติ {normalCount} รายการ
          </Badge>
          <Badge variant="outline" className="text-sm gap-1.5 py-1.5 px-4 text-red-600 border-red-300">
            <AlertTriangle className="w-4 h-4" /> ผิดปกติ {abnormalCount} รายการ
          </Badge>
          <Badge variant="outline" className="text-sm gap-1.5 py-1.5 px-4 text-muted-foreground">
            <Clock className="w-4 h-4" /> แสดงผลเวลา 10:00 น.
          </Badge>
        </div>

        {/* Daily Physical Inspection Report */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-primary" />
                รายงานผลตรวจสอบกายภาพ (ตัวอย่างที่ส่งเมื่อวาน)
              </CardTitle>
              <div className="flex gap-2 flex-wrap items-center">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อยา..."
                    value={searchName}
                    onChange={e => setSearchName(e.target.value)}
                    className="pl-8 h-9 w-full sm:w-[200px]"
                  />
                </div>
                <div className="relative">
                  <CalendarIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    value={searchDate}
                    onChange={e => setSearchDate(e.target.value)}
                    className="pl-8 h-9 w-full sm:w-[170px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!isAfter10AM && !hasSearch ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">รอเวลาแสดงผลเวลา 10:00 น.</p>
                <p className="text-xs text-muted-foreground mt-2">หรือใช้ช่องค้นหาด้านบนเพื่อดูข้อมูลย้อนหลัง</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {hasSearch ? "ไม่พบรายการที่ค้นหา" : "ไม่มีข้อมูลผลตรวจสอบกายภาพจากเมื่อวาน"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">รหัสตัวอย่าง</TableHead>
                      <TableHead>ชื่อยา</TableHead>
                      <TableHead className="text-center">กายภาพ</TableHead>
                      <TableHead className="text-center">Density</TableHead>
                      <TableHead className="text-center">การละลาย</TableHead>
                      <TableHead className="text-center">เทียบสีกับแบชก่อน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map(sample => {
                      const r = sample.result!;
                      return (
                        <TableRow key={sample.id}>
                          <TableCell className="font-medium text-primary">{sample.id}</TableCell>
                          <TableCell>{sample.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={r.physical === "normal"
                              ? "bg-green-100 text-green-700 border-green-300"
                              : "bg-red-100 text-red-700 border-red-300"
                            }>
                              {r.physical === "normal" ? "ปกติ ✅" : "ไม่ปกติ ⚠️"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-medium">{r.density.toFixed(3)}</span>
                              <Badge variant="outline" className={r.densityStatus === "normal"
                                ? "text-green-600 border-green-300 text-xs"
                                : "text-red-600 border-red-300 text-xs"
                              }>
                                {r.densityStatus === "normal" ? "ปกติ" : "ผิดปกติ"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-medium">{r.dissolution}</span>
                              <Badge variant="outline" className={r.dissolutionStatus === "normal"
                                ? "text-green-600 border-green-300 text-xs"
                                : "text-red-600 border-red-300 text-xs"
                              }>
                                {r.dissolutionStatus === "normal" ? "ปกติ" : "ผิดปกติ"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {r.colorMatch === "match" ? (
                              <Badge className="bg-green-100 text-green-700 border-green-300">
                                สีตรงกัน ✅
                              </Badge>
                            ) : (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <button className="inline-flex flex-col items-center gap-1.5 group">
                                    <div className="flex items-center gap-1">
                                      {r.prevBatchImage && (
                                        <img
                                          src={r.prevBatchImage}
                                          alt="แบชก่อนหน้า"
                                          className="w-10 h-10 rounded border-2 border-amber-300 object-cover group-hover:scale-110 transition"
                                        />
                                      )}
                                      {r.currentBatchImage && (
                                        <img
                                          src={r.currentBatchImage}
                                          alt="แบชล่าสุด"
                                          className="w-10 h-10 rounded border-2 border-red-300 object-cover group-hover:scale-110 transition"
                                        />
                                      )}
                                    </div>
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                                      สีไม่ตรง ⚠️
                                    </Badge>
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      <ImageIcon className="w-5 h-5 text-amber-600" />
                                      เปรียบเทียบสี — {sample.name} ({sample.id})
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">แบชก่อนหน้า</span>
                                        {r.prevBatchNo && (
                                          <Badge variant="outline" className="text-xs">{r.prevBatchNo}</Badge>
                                        )}
                                      </div>
                                      {r.prevBatchImage && (
                                        <img
                                          src={r.prevBatchImage}
                                          alt="แบชก่อนหน้า"
                                          className="w-full h-64 rounded-lg border-2 border-amber-300 object-cover"
                                        />
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">แบชล่าสุด</span>
                                        {r.currentBatchNo && (
                                          <Badge variant="outline" className="text-xs border-red-300 text-red-600">{r.currentBatchNo}</Badge>
                                        )}
                                      </div>
                                      {r.currentBatchImage && (
                                        <img
                                          src={r.currentBatchImage}
                                          alt="แบชล่าสุด"
                                          className="w-full h-64 rounded-lg border-2 border-red-300 object-cover"
                                        />
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-amber-800">
                                      ตรวจพบสีของตัวอย่างแตกต่างจากแบชก่อนหน้า ควรตรวจสอบกระบวนการผลิตเพิ่มเติม
                                    </p>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Realtime Density Monitoring */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-500" />
              Density (g/mL) @ 30°C — Realtime วันนี้
              <Badge variant="outline" className="text-xs ml-auto">{todaySamples.length} รายการ</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySamples.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">ยังไม่มีตัวอย่างที่ส่งในวันนี้</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">รหัสตัวอย่าง</TableHead>
                      <TableHead>ชื่อยา</TableHead>
                      <TableHead className="text-center">วันที่ส่ง</TableHead>
                      <TableHead className="text-center">Density (g/mL) @ 30°C</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaySamples.map(sample => (
                      <TableRow key={sample.id}>
                        <TableCell className="font-medium text-primary">{sample.id}</TableCell>
                        <TableCell>{sample.name}</TableCell>
                        <TableCell className="text-center text-sm">{sample.date}</TableCell>
                        <TableCell className="text-center">
                          {sample.density !== undefined ? (
                            <span className="font-medium">{sample.density.toFixed(3)}</span>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 mr-1" /> รอผลตรวจ
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {sample.density !== undefined ? (
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> ตรวจแล้ว
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              รอตรวจกายภาพ
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
    </AppLayout>
  );
};

export default Home;
