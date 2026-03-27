import { useState } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FileBarChart, TrendingUp, Gauge, Users, CalendarIcon, LayoutDashboard, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const drugNames = ["all", "glyphosate", "paraquat", "chlorpyrifos", "cypermethrin", "atrazine"] as const;
const drugLabels: Record<string, string> = {
  all: "ทั้งหมด",
  glyphosate: "Glyphosate 48% SL",
  paraquat: "Paraquat 27.6% SL",
  chlorpyrifos: "Chlorpyrifos 40% EC",
  cypermethrin: "Cypermethrin 10% EC",
  atrazine: "Atrazine 80% WP",
};

const instrumentNames = ["all", "GC-01", "GC-02", "GC-03", "HPLC-01", "HPLC-02", "HPLC-03"];
const personnelNames = ["all", "ณรงค์เดช", "สมศรี", "ประภา", "อำนาจ", "มาลี", "พิชัย"];

const trendData = [
  { month: "ม.ค.", glyphosate: 48.2, paraquat: 27.8, chlorpyrifos: 40.5, cypermethrin: 10.1, atrazine: 80.3 },
  { month: "ก.พ.", glyphosate: 47.9, paraquat: 27.5, chlorpyrifos: 40.1, cypermethrin: 10.3, atrazine: 79.8 },
  { month: "มี.ค.", glyphosate: 48.5, paraquat: 27.6, chlorpyrifos: 39.8, cypermethrin: 9.9, atrazine: 80.1 },
  { month: "เม.ย.", glyphosate: 47.8, paraquat: 28.0, chlorpyrifos: 40.3, cypermethrin: 10.2, atrazine: 80.5 },
  { month: "พ.ค.", glyphosate: 48.1, paraquat: 27.4, chlorpyrifos: 40.0, cypermethrin: 10.0, atrazine: 79.5 },
  { month: "มิ.ย.", glyphosate: 48.3, paraquat: 27.7, chlorpyrifos: 40.2, cypermethrin: 10.1, atrazine: 80.0 },
];

const trendConfig: Record<string, { label: string; color: string }> = {
  glyphosate: { label: "Glyphosate 48% SL", color: "hsl(var(--primary))" },
  paraquat: { label: "Paraquat 27.6% SL", color: "hsl(210, 70%, 50%)" },
  chlorpyrifos: { label: "Chlorpyrifos 40% EC", color: "hsl(150, 60%, 40%)" },
  cypermethrin: { label: "Cypermethrin 10% EC", color: "hsl(30, 80%, 50%)" },
  atrazine: { label: "Atrazine 80% WP", color: "hsl(280, 60%, 50%)" },
};

const oeeData = [
  { instrument: "GC-01", availability: 92, performance: 88, quality: 96, oee: 77.7, injections: 245, activeHours: 18.4 },
  { instrument: "GC-02", availability: 85, performance: 90, quality: 94, oee: 71.9, injections: 198, activeHours: 16.2 },
  { instrument: "GC-03", availability: 78, performance: 82, quality: 91, oee: 58.3, injections: 156, activeHours: 14.0 },
  { instrument: "HPLC-01", availability: 95, performance: 91, quality: 98, oee: 84.8, injections: 312, activeHours: 20.5 },
  { instrument: "HPLC-02", availability: 88, performance: 85, quality: 95, oee: 71.1, injections: 210, activeHours: 17.0 },
  { instrument: "HPLC-03", availability: 90, performance: 87, quality: 97, oee: 76.0, injections: 278, activeHours: 19.2 },
];

const oeeConfig = {
  availability: { label: "Availability", color: "hsl(210, 70%, 50%)" },
  performance: { label: "Performance", color: "hsl(150, 60%, 40%)" },
  quality: { label: "Quality", color: "hsl(30, 80%, 50%)" },
  oee: { label: "OEE", color: "hsl(var(--primary))" },
};

const personnelData = [
  { name: "ณรงค์เดช", samplesAnalyzed: 42, hoursWorked: 48, avgPerDay: 7, overload: true },
  { name: "สมศรี", samplesAnalyzed: 38, hoursWorked: 45, avgPerDay: 6.3, overload: true },
  { name: "ประภา", samplesAnalyzed: 28, hoursWorked: 40, avgPerDay: 4.7, overload: false },
  { name: "อำนาจ", samplesAnalyzed: 35, hoursWorked: 44, avgPerDay: 5.8, overload: false },
  { name: "มาลี", samplesAnalyzed: 45, hoursWorked: 50, avgPerDay: 7.5, overload: true },
  { name: "พิชัย", samplesAnalyzed: 22, hoursWorked: 38, avgPerDay: 3.7, overload: false },
];

const personnelConfig = {
  samples: { label: "ตัวอย่างที่วิเคราะห์", color: "hsl(var(--primary))" },
  hours: { label: "ชั่วโมงทำงาน", color: "hsl(30, 80%, 50%)" },
};

// Real-time weekly data
const weeklyDays = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
const weeklyTrendData = weeklyDays.map((day, i) => ({
  day,
  glyphosate: 47.5 + Math.random() * 1.5,
  paraquat: 27.0 + Math.random() * 1.2,
  chlorpyrifos: 39.5 + Math.random() * 1.5,
}));
const weeklyOeeData = weeklyDays.map((day, i) => ({
  day,
  gc: 65 + Math.random() * 25,
  hplc: 70 + Math.random() * 20,
}));
const weeklyWorkloadData = weeklyDays.map((day, i) => ({
  day,
  samples: Math.floor(15 + Math.random() * 20),
  capacity: 30,
}));

const weeklyTrendConfig = {
  glyphosate: { label: "Glyphosate", color: "hsl(var(--primary))" },
  paraquat: { label: "Paraquat", color: "hsl(210, 70%, 50%)" },
  chlorpyrifos: { label: "Chlorpyrifos", color: "hsl(150, 60%, 40%)" },
};
const weeklyOeeConfig = {
  gc: { label: "GC (เฉลี่ย)", color: "hsl(var(--primary))" },
  hplc: { label: "HPLC (เฉลี่ย)", color: "hsl(210, 70%, 50%)" },
};
const weeklyWorkloadConfig = {
  samples: { label: "ตัวอย่างต่อวัน", color: "hsl(var(--primary))" },
  capacity: { label: "Capacity", color: "hsl(0, 70%, 60%)" },
};

const DateRangePicker = ({ dateFrom, dateTo, onFromChange, onToChange }: {
  dateFrom?: Date; dateTo?: Date;
  onFromChange: (d?: Date) => void; onToChange: (d?: Date) => void;
}) => (
  <div className="flex items-center gap-2">
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !dateFrom && "text-muted-foreground")}>
          <CalendarIcon className="w-3.5 h-3.5" />
          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "จากวันที่"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={dateFrom} onSelect={onFromChange} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
    <span className="text-xs text-muted-foreground">ถึง</span>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !dateTo && "text-muted-foreground")}>
          <CalendarIcon className="w-3.5 h-3.5" />
          {dateTo ? format(dateTo, "dd/MM/yyyy") : "ถึงวันที่"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={dateTo} onSelect={onToChange} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  </div>
);

const Report = () => {
  const [selectedDrug, setSelectedDrug] = useState("all");
  const [selectedInstrument, setSelectedInstrument] = useState("all");
  const [selectedPersonnel, setSelectedPersonnel] = useState("all");
  const [trendDateFrom, setTrendDateFrom] = useState<Date>();
  const [trendDateTo, setTrendDateTo] = useState<Date>();
  const [oeeDateFrom, setOeeDateFrom] = useState<Date>();
  const [oeeDateTo, setOeeDateTo] = useState<Date>();
  const [workloadDateFrom, setWorkloadDateFrom] = useState<Date>();
  const [workloadDateTo, setWorkloadDateTo] = useState<Date>();

  const activeDrugs = selectedDrug === "all"
    ? Object.keys(trendConfig)
    : [selectedDrug];

  const filteredOee = selectedInstrument === "all"
    ? oeeData
    : oeeData.filter(d => d.instrument === selectedInstrument);

  const filteredPersonnel = selectedPersonnel === "all"
    ? personnelData
    : personnelData.filter(p => p.name === selectedPersonnel);

  const filteredPersonnelChart = filteredPersonnel.map(p => ({ name: p.name, samples: p.samplesAnalyzed, hours: p.hoursWorked }));
  const radarData = filteredPersonnel.map(p => ({ subject: p.name, workload: Math.round((p.samplesAnalyzed / 45) * 100), capacity: 100 }));
  const filteredOeeChart = filteredOee.map(d => ({ name: d.instrument, availability: d.availability, performance: d.performance, quality: d.quality, oee: d.oee }));

  // Dashboard summary stats
  const avgOee = oeeData.reduce((sum, d) => sum + d.oee, 0) / oeeData.length;
  const overloadCount = personnelData.filter(p => p.overload).length;
  const totalSamples = personnelData.reduce((sum, p) => sum + p.samplesAnalyzed, 0);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileBarChart className="w-6 h-6" />
            รายงานสรุป
          </h1>
          <p className="text-sm text-muted-foreground">ภาพรวม Trend %AI, OEE เครื่องวิเคราะห์ และ Workload บุคลากร</p>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="mb-4">
            <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="w-4 h-4" />Dashboard ภาพรวม</TabsTrigger>
            <TabsTrigger value="trend" className="gap-1.5"><TrendingUp className="w-4 h-4" />%AI</TabsTrigger>
            <TabsTrigger value="oee" className="gap-1.5"><Gauge className="w-4 h-4" />OEE เครื่องวิเคราะห์</TabsTrigger>
            <TabsTrigger value="workload" className="gap-1.5"><Users className="w-4 h-4" />Workload บุคลากร</TabsTrigger>
          </TabsList>

          {/* Dashboard Overview - Real-time Weekly */}
          <TabsContent value="dashboard">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">Real-time สัปดาห์นี้</span>
              <Badge variant="outline" className="text-xs">อัปเดตอัตโนมัติ</Badge>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">ตัวอย่างสัปดาห์นี้</p>
                  <p className="text-3xl font-bold text-primary">{totalSamples}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">OEE เฉลี่ย</p>
                  <p className={`text-3xl font-bold ${avgOee >= 75 ? "text-emerald-600" : "text-amber-600"}`}>{avgOee.toFixed(1)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Overload</p>
                  <p className={`text-3xl font-bold ${overloadCount > 0 ? "text-destructive" : "text-emerald-600"}`}>{overloadCount} คน</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">เครื่องมือที่ใช้งาน</p>
                  <p className="text-3xl font-bold text-primary">{oeeData.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Trend %AI (สัปดาห์นี้)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={weeklyTrendConfig} className="h-[220px] w-full">
                    <AreaChart data={weeklyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="glyphosate" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                      <Area type="monotone" dataKey="paraquat" stroke="hsl(210, 70%, 50%)" fill="hsl(210, 70%, 50%)" fillOpacity={0.1} strokeWidth={2} />
                      <Area type="monotone" dataKey="chlorpyrifos" stroke="hsl(150, 60%, 40%)" fill="hsl(150, 60%, 40%)" fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Gauge className="w-4 h-4" /> OEE เครื่องวิเคราะห์ (สัปดาห์นี้)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={weeklyOeeConfig} className="h-[220px] w-full">
                    <BarChart data={weeklyOeeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="gc" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="hplc" fill="hsl(210, 70%, 50%)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> Workload บุคลากร (สัปดาห์นี้)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={weeklyWorkloadConfig} className="h-[220px] w-full">
                    <AreaChart data={weeklyWorkloadData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="samples" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                      <Area type="monotone" dataKey="capacity" stroke="hsl(0, 70%, 60%)" fill="hsl(0, 70%, 60%)" fillOpacity={0.05} strokeWidth={1.5} strokeDasharray="5 5" />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trend %AI */}
          <TabsContent value="trend">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">%AI (รายเดือน)</CardTitle>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <Select value={selectedDrug} onValueChange={setSelectedDrug}>
                    <SelectTrigger className="w-52 h-9 text-xs">
                      <SelectValue placeholder="เลือกชื่อยา" />
                    </SelectTrigger>
                    <SelectContent>
                      {drugNames.map(d => (
                        <SelectItem key={d} value={d}>{drugLabels[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DateRangePicker dateFrom={trendDateFrom} dateTo={trendDateTo} onFromChange={setTrendDateFrom} onToChange={setTrendDateTo} />
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={trendConfig} className="h-[400px] w-full">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {activeDrugs.map(key => (
                      <Line key={key} type="monotone" dataKey={key} stroke={trendConfig[key].color} strokeWidth={2} dot />
                    ))}
                  </LineChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-3 mt-4">
                  {activeDrugs.map(key => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: trendConfig[key].color }} />
                      <span className="text-muted-foreground">{trendConfig[key].label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OEE */}
          <TabsContent value="oee">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
                <SelectTrigger className="w-44 h-9 text-xs">
                  <SelectValue placeholder="เลือกเครื่อง" />
                </SelectTrigger>
                <SelectContent>
                  {instrumentNames.map(i => (
                    <SelectItem key={i} value={i}>{i === "all" ? "ทั้งหมด" : i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateRangePicker dateFrom={oeeDateFrom} dateTo={oeeDateTo} onFromChange={setOeeDateFrom} onToChange={setOeeDateTo} />
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
              {filteredOee.map(d => (
                <Card key={d.instrument} className="text-center">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">{d.instrument}</p>
                    <p className={`text-2xl font-bold ${d.oee >= 75 ? "text-emerald-600" : d.oee >= 60 ? "text-amber-600" : "text-destructive"}`}>
                      {d.oee}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">OEE</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">OEE Breakdown (Availability / Performance / Quality)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={oeeConfig} className="h-[350px] w-full">
                  <BarChart data={filteredOeeChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="availability" fill="hsl(210, 70%, 50%)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="performance" fill="hsl(150, 60%, 40%)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="quality" fill="hsl(30, 80%, 50%)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
                <div className="mt-6">
                  <h3 className="font-semibold text-sm mb-3">Active Injection Log (สรุปรายเครื่อง)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredOee.map(d => (
                      <div key={d.instrument} className="bg-accent/50 rounded-lg p-3 text-sm space-y-1">
                        <p className="font-semibold text-foreground">{d.instrument}</p>
                        <p className="text-muted-foreground">Injections: <strong>{d.injections}</strong> ครั้ง</p>
                        <p className="text-muted-foreground">Active: <strong>{d.activeHours}</strong> ชม.</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workload */}
          <TabsContent value="workload">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Select value={selectedPersonnel} onValueChange={setSelectedPersonnel}>
                <SelectTrigger className="w-44 h-9 text-xs">
                  <SelectValue placeholder="เลือกบุคลากร" />
                </SelectTrigger>
                <SelectContent>
                  {personnelNames.map(p => (
                    <SelectItem key={p} value={p}>{p === "all" ? "ทั้งหมด" : p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateRangePicker dateFrom={workloadDateFrom} dateTo={workloadDateTo} onFromChange={setWorkloadDateFrom} onToChange={setWorkloadDateTo} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">ปริมาณงาน vs ชั่วโมงทำงาน (สัปดาห์นี้)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={personnelConfig} className="h-[300px] w-full">
                    <BarChart data={filteredPersonnelChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="samples" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="hours" fill="hsl(30, 80%, 50%)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workload Balance (Radar)</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" className="text-xs" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar name="Workload %" dataKey="workload" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      <Radar name="Capacity" dataKey="capacity" stroke="hsl(0, 70%, 50%)" fill="hsl(0, 70%, 50%)" fillOpacity={0.05} strokeDasharray="5 5" />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">สถานะ Overload บุคลากร</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredPersonnel.map(p => (
                    <div key={p.name} className={`rounded-lg p-4 border ${p.overload ? "border-destructive/30 bg-destructive/5" : "border-border bg-accent/30"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-foreground">{p.name}</span>
                        <Badge className={p.overload ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-700"}>
                          {p.overload ? "Overload" : "ปกติ"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">วิเคราะห์ {p.samplesAnalyzed} ตัวอย่าง | {p.hoursWorked} ชม. | เฉลี่ย {p.avgPerDay}/วัน</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Report;
