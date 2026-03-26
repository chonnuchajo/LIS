import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, TrendingUp, Gauge, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

// Mock data: Trend %AI per product over months
const trendData = [
  { month: "ม.ค.", glyphosate: 48.2, paraquat: 27.8, chlorpyrifos: 40.5, cypermethrin: 10.1, atrazine: 80.3 },
  { month: "ก.พ.", glyphosate: 47.9, paraquat: 27.5, chlorpyrifos: 40.1, cypermethrin: 10.3, atrazine: 79.8 },
  { month: "มี.ค.", glyphosate: 48.5, paraquat: 27.6, chlorpyrifos: 39.8, cypermethrin: 9.9, atrazine: 80.1 },
  { month: "เม.ย.", glyphosate: 47.8, paraquat: 28.0, chlorpyrifos: 40.3, cypermethrin: 10.2, atrazine: 80.5 },
  { month: "พ.ค.", glyphosate: 48.1, paraquat: 27.4, chlorpyrifos: 40.0, cypermethrin: 10.0, atrazine: 79.5 },
  { month: "มิ.ย.", glyphosate: 48.3, paraquat: 27.7, chlorpyrifos: 40.2, cypermethrin: 10.1, atrazine: 80.0 },
];

const trendConfig = {
  glyphosate: { label: "Glyphosate 48% SL", color: "hsl(var(--primary))" },
  paraquat: { label: "Paraquat 27.6% SL", color: "hsl(210, 70%, 50%)" },
  chlorpyrifos: { label: "Chlorpyrifos 40% EC", color: "hsl(150, 60%, 40%)" },
  cypermethrin: { label: "Cypermethrin 10% EC", color: "hsl(30, 80%, 50%)" },
  atrazine: { label: "Atrazine 80% WP", color: "hsl(280, 60%, 50%)" },
};

// Mock OEE data per instrument
const oeeData = [
  { instrument: "GC-01", availability: 92, performance: 88, quality: 96, oee: 77.7, injections: 245, activeHours: 18.4 },
  { instrument: "GC-02", availability: 85, performance: 90, quality: 94, oee: 71.9, injections: 198, activeHours: 16.2 },
  { instrument: "GC-03", availability: 78, performance: 82, quality: 91, oee: 58.3, injections: 156, activeHours: 14.0 },
  { instrument: "HPLC-01", availability: 95, performance: 91, quality: 98, oee: 84.8, injections: 312, activeHours: 20.5 },
  { instrument: "HPLC-02", availability: 88, performance: 85, quality: 95, oee: 71.1, injections: 210, activeHours: 17.0 },
  { instrument: "HPLC-03", availability: 90, performance: 87, quality: 97, oee: 76.0, injections: 278, activeHours: 19.2 },
];

const oeeChartData = oeeData.map(d => ({
  name: d.instrument,
  availability: d.availability,
  performance: d.performance,
  quality: d.quality,
  oee: d.oee,
}));

const oeeConfig = {
  availability: { label: "Availability", color: "hsl(210, 70%, 50%)" },
  performance: { label: "Performance", color: "hsl(150, 60%, 40%)" },
  quality: { label: "Quality", color: "hsl(30, 80%, 50%)" },
  oee: { label: "OEE", color: "hsl(var(--primary))" },
};

// Mock personnel workload data
const personnelData = [
  { name: "ณรงค์เดช", samplesAnalyzed: 42, hoursWorked: 48, avgPerDay: 7, overload: true },
  { name: "สมศรี", samplesAnalyzed: 38, hoursWorked: 45, avgPerDay: 6.3, overload: true },
  { name: "ประภา", samplesAnalyzed: 28, hoursWorked: 40, avgPerDay: 4.7, overload: false },
  { name: "อำนาจ", samplesAnalyzed: 35, hoursWorked: 44, avgPerDay: 5.8, overload: false },
  { name: "มาลี", samplesAnalyzed: 45, hoursWorked: 50, avgPerDay: 7.5, overload: true },
  { name: "พิชัย", samplesAnalyzed: 22, hoursWorked: 38, avgPerDay: 3.7, overload: false },
];

const personnelChartData = personnelData.map(p => ({
  name: p.name,
  samples: p.samplesAnalyzed,
  hours: p.hoursWorked,
}));

const personnelConfig = {
  samples: { label: "ตัวอย่างที่วิเคราะห์", color: "hsl(var(--primary))" },
  hours: { label: "ชั่วโมงทำงาน", color: "hsl(30, 80%, 50%)" },
};

// Radar data for workload balance
const radarData = personnelData.map(p => ({
  subject: p.name,
  workload: Math.round((p.samplesAnalyzed / 45) * 100),
  capacity: 100,
}));

const Report = () => (
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

      <Tabs defaultValue="trend">
        <TabsList className="mb-4">
          <TabsTrigger value="trend" className="gap-1.5"><TrendingUp className="w-4 h-4" />Trend %AI</TabsTrigger>
          <TabsTrigger value="oee" className="gap-1.5"><Gauge className="w-4 h-4" />OEE เครื่องวิเคราะห์</TabsTrigger>
          <TabsTrigger value="workload" className="gap-1.5"><Users className="w-4 h-4" />Workload บุคลากร</TabsTrigger>
        </TabsList>

        {/* Trend %AI */}
        <TabsContent value="trend">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trend %AI ยาแต่ละตัว (รายเดือน)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={trendConfig} className="h-[400px] w-full">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="glyphosate" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="paraquat" stroke="hsl(210, 70%, 50%)" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="chlorpyrifos" stroke="hsl(150, 60%, 40%)" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="cypermethrin" stroke="hsl(30, 80%, 50%)" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="atrazine" stroke="hsl(280, 60%, 50%)" strokeWidth={2} dot />
                </LineChart>
              </ChartContainer>
              <div className="flex flex-wrap gap-3 mt-4">
                {Object.entries(trendConfig).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                    <span className="text-muted-foreground">{cfg.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OEE */}
        <TabsContent value="oee">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
            {oeeData.map(d => (
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
                <BarChart data={oeeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="availability" fill="hsl(210, 70%, 50%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="performance" fill="hsl(150, 60%, 40%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="quality" fill="hsl(30, 80%, 50%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>

              {/* Active log table */}
              <div className="mt-6">
                <h3 className="font-semibold text-sm mb-3">Active Injection Log (สรุปรายเครื่อง)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {oeeData.map(d => (
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ปริมาณงาน vs ชั่วโมงทำงาน (สัปดาห์นี้)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={personnelConfig} className="h-[300px] w-full">
                  <BarChart data={personnelChartData}>
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
                {personnelData.map(p => (
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

export default Report;
