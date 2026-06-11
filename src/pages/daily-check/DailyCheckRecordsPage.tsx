import { useState, useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { List, Filter, Sparkles, Loader2 } from "lucide-react";
import { getOllamaStatus, streamWeeklySummary } from '@/lib/aiApi';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type EquipmentCheckRecord } from "@/lib/api";
import { EQUIPMENT_ROOM_SLUGS, getRoomCatalog } from "@/lib/roomEquipment";
import { getRoomBySlug } from "@/lib/dailyCheckRooms";
import { filterEquipmentRecords } from "@/lib/equipmentRecords";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const roomLabel = (slug: string) => getRoomBySlug(slug)?.label ?? slug;

const DailyCheckRecordsPage = () => {
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [filterInstrument, setFilterInstrument] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>(todayStr());
  const [filterStatus, setFilterStatus] = useState<"all" | "normal" | "abnormal">("all");
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  useEffect(() => {
    getOllamaStatus().then((s) => setOllamaAvailable(s.available));
  }, []);

  // ยิง 1 query ต่อห้อง (ทั้ง 3 ห้องเสมอ) ตามวันที่ที่เลือก — รวม client-side
  const results = useQueries({
    queries: EQUIPMENT_ROOM_SLUGS.map((slug) => ({
      queryKey: ["equipment-checks", "records", slug, filterDate],
      queryFn: () => api.getEquipmentChecks({ room: slug, date: filterDate || todayStr() }),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);

  // merge ทุกห้อง → sort ใหม่สุดก่อน
  const merged: EquipmentCheckRecord[] = [];
  for (const r of results) if (r.data) merged.push(...r.data);
  merged.sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : a.checkedAt > b.checkedAt ? -1 : 0));

  const rows = filterEquipmentRecords(merged, {
    room: filterRoom,
    instrumentId: filterInstrument,
    status: filterStatus,
  });

  const roomInstruments =
    filterRoom === "all" ? [] : getRoomCatalog(filterRoom)?.instruments ?? [];

  const handleRoomChange = (v: string) => {
    setFilterRoom(v);
    setFilterInstrument("all"); // กันค้างเครื่องของห้องเก่า
  };

  const resetFilters = () => {
    setFilterRoom("all");
    setFilterInstrument("all");
    setFilterDate(todayStr());
    setFilterStatus("all");
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">รายการบันทึกการเช็กเครื่องมือ</h2>
        <p className="text-sm text-muted-foreground">รวมทุกห้อง — เลือกดูตามห้อง / เครื่อง / วันที่ / สถานะ</p>
      </div>

      {ollamaAvailable && (
        <div className="space-y-2 mb-4">
          <button
            type="button"
            disabled={summaryLoading}
            onClick={async () => {
              const toDate = new Date().toISOString().slice(0, 10);
              const from = new Date();
              from.setDate(from.getDate() - 6);
              const fromDate = from.toISOString().slice(0, 10);
              setSummaryLoading(true);
              setSummaryText('');
              try {
                await streamWeeklySummary(fromDate, toDate, (chunk) => {
                  setSummaryText((prev) => prev + chunk);
                });
              } catch {
                setSummaryText('(เกิดข้อผิดพลาด — กรุณาลองใหม่)');
              } finally {
                setSummaryLoading(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-50"
          >
            {summaryLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            สรุปรายสัปดาห์ (AI)
          </button>

          {summaryText && (
            <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 whitespace-pre-wrap">
              {summaryText}
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base flex items-center gap-2">
            <List className="w-4 h-4 text-primary" />
            ประวัติการเช็กเครื่องมือ
          </CardTitle>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Filter className="w-3 h-3" /> ห้อง
              </label>
              <Select value={filterRoom} onValueChange={handleRoomChange}>
                <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกห้อง</SelectItem>
                  {EQUIPMENT_ROOM_SLUGS.map((slug) => (
                    <SelectItem key={slug} value={slug}>{roomLabel(slug)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">เครื่อง</label>
              <Select
                value={filterInstrument}
                onValueChange={setFilterInstrument}
                disabled={filterRoom === "all"}
              >
                <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {roomInstruments.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">วันที่</label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-8 text-xs w-[160px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">สถานะ</label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "normal" | "abnormal")}>
                <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="normal">ปกติ</SelectItem>
                  <SelectItem value="abnormal">ผิดปกติ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
              รีเซ็ตตัวกรอง
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">กำลังโหลด...</p>
          ) : isError ? (
            <p className="text-sm text-muted-foreground text-center py-8">โหลดข้อมูลไม่สำเร็จ</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">ไม่พบรายการในช่วงที่เลือก</p>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>เวลา</TableHead>
                    <TableHead>ห้อง</TableHead>
                    <TableHead>เครื่อง</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="text-center">ค่าที่วัด</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    <TableHead>ผู้บันทึก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((h) => {
                    const normal = h.status === "normal";
                    return (
                      <TableRow key={h._id}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(h.date)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtTime(h.checkedAt)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{roomLabel(h.roomSlug)}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{h.instrumentName} <span className="text-muted-foreground">({h.instrumentId})</span></TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${normal ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                            {normal ? "ปกติ" : "ผิดปกติ"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs whitespace-nowrap">
                          {h.readings.length
                            ? h.readings.map((r) => `${r.label} ${r.value} ${r.unit}`).join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{h.note || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{h.recorder}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default DailyCheckRecordsPage;
