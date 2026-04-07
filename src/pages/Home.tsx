import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, Droplets, FlaskConical, Clock } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSamples } from "@/context/SampleContext";

// Mock physical inspection results for yesterday's samples (would come from context in production)
const mockPhysicalResults: Record<string, {
  physical: "normal" | "abnormal";
  density: number;
  densityStatus: "normal" | "abnormal";
  dissolution: number;
  dissolutionStatus: "normal" | "abnormal";
  colorMatch: "match" | "mismatch";
}> = {
  "LAB-2602-003": { physical: "normal", density: 0.987, densityStatus: "normal", dissolution: 98.5, dissolutionStatus: "normal", colorMatch: "match" },
  "LAB-2602-005": { physical: "normal", density: 1.024, densityStatus: "normal", dissolution: 99.1, dissolutionStatus: "normal", colorMatch: "match" },
  "LAB-2602-008": { physical: "abnormal", density: 1.155, densityStatus: "abnormal", dissolution: 85.2, dissolutionStatus: "abnormal", colorMatch: "mismatch" },
};

const Home = () => {
  const { physicalSamples, sentSamples, sentItems } = useSamples();

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

  // Today's samples for realtime density tracking
  const todaySamples = useMemo(() => {
    const allCurrent = [
      ...sentItems.map(s => ({ id: s.id, name: s.name, date: s.date, density: undefined as number | undefined })),
      ...sentSamples.map(s => ({ id: s.id, name: s.name, date: s.date, density: undefined as number | undefined })),
    ];
    return allCurrent;
  }, [sentItems, sentSamples]);

  const normalCount = yesterdayResults.filter(s => s.result?.physical === "normal").length;
  const abnormalCount = yesterdayResults.filter(s => s.result?.physical === "abnormal").length;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
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
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              รายงานผลตรวจสอบกายภาพ (ตัวอย่างที่ส่งเมื่อวาน)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isAfter10AM ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">ผลการตรวจสอบจะแสดงหลังเวลา 10:00 น.</p>
              </div>
            ) : yesterdayResults.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">ไม่มีข้อมูลผลตรวจสอบกายภาพจากเมื่อวาน</p>
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
                    {yesterdayResults.map(sample => {
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
                            <Badge className={r.colorMatch === "match"
                              ? "bg-green-100 text-green-700 border-green-300"
                              : "bg-amber-100 text-amber-700 border-amber-300"
                            }>
                              {r.colorMatch === "match" ? "สีตรงกัน ✅" : "สีไม่ตรง ⚠️"}
                            </Badge>
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
      </main>
    </div>
  );
};

export default Home;
