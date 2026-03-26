import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil } from "lucide-react";
import { toast } from "sonner";

export interface SampleItem {
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
  status: "sent" | "physical" | "testing" | "done";
}

interface SampleColumnProps {
  title: string;
  items: SampleItem[];
  variant: "sent" | "physical" | "testing" | "done";
}

const variantConfig = {
  sent: {
    headerBg: "bg-lis-column-sent",
    borderColor: "border-lis-stat-blue-icon",
    badgeBg: "bg-lis-stat-blue text-lis-stat-blue-icon",
  },
  physical: {
    headerBg: "bg-lis-column-testing",
    borderColor: "border-lis-status-pending",
    badgeBg: "bg-lis-stat-amber text-lis-stat-amber-icon",
  },
  testing: {
    headerBg: "bg-lis-column-testing",
    borderColor: "border-lis-status-progress",
    badgeBg: "bg-lis-stat-blue text-lis-stat-blue-icon",
  },
  done: {
    headerBg: "bg-lis-column-done",
    borderColor: "border-lis-status-done",
    badgeBg: "bg-lis-stat-green text-lis-stat-green-icon",
  },
};

const SampleColumn = ({ title, items, variant }: SampleColumnProps) => {
  const config = variantConfig[variant];

  return (
    <div className="flex flex-col min-w-0">
      <div className={cn("rounded-t-xl px-5 py-3 border-b-2", config.headerBg, config.borderColor)}>
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          {title}
          <Badge className={cn("text-xs font-bold", config.badgeBg)}>{items.length}</Badge>
        </h3>
      </div>
      <div className="space-y-3 p-3 bg-card rounded-b-xl border border-t-0 border-border max-h-[500px] overflow-y-auto">
        {items.map((item) => (
          <Card key={item.id} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-primary">{item.id}</CardTitle>
                <div className="flex gap-1">
                  <button
                    onClick={() => toast.info(`ดูรายละเอียด ${item.id}`)}
                    className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-accent transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => toast.info(`แก้ไขรายการ ${item.id}`)}
                    className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-accent transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-1.5">
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>📅 {item.date} ⏰ {item.time}</p>

                {/* Sent column */}
                {variant === "sent" && item.sender && (
                  <p>👤 ผู้ส่ง: <span className="text-foreground font-medium">{item.sender}</span></p>
                )}

                {/* Physical testing column */}
                {variant === "physical" && (
                  <>
                    {item.receiver && (
                      <p>👤 ผู้รับตัวอย่าง: <span className="text-foreground font-medium">{item.receiver}</span></p>
                    )}
                    {item.density !== undefined && (
                      <div className="mt-2 p-2 rounded-lg bg-lis-stat-amber">
                        <p className="text-xs font-semibold text-lis-stat-amber-icon">
                          ⚖️ Density (@ 30°C): <span className="text-sm">{item.density.toFixed(3)} g/mL</span>
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* AI Analysis column */}
                {variant === "testing" && (
                  <>
                    {item.receiver && (
                      <p>👤 ผู้วิเคราะห์: <span className="text-foreground font-medium">{item.receiver}</span></p>
                    )}
                    {item.instrument && (
                      <p>🖥️ เครื่องที่ตรวจ: <span className="text-foreground font-medium">{item.instrument}</span></p>
                    )}
                    {item.aiPercent !== undefined && (
                      <div className="flex items-center gap-2">
                        <span>🔬 วิเคราะห์ %AI</span>
                        <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all bg-lis-status-progress"
                            style={{ width: `${item.aiPercent}%` }}
                          />
                        </div>
                        <span className="font-medium text-foreground">{item.aiPercent}%</span>
                      </div>
                    )}
                  </>
                )}

                {/* Done column */}
                {variant === "done" && (
                  <>
                    {item.receiver && (
                      <p>👤 ผู้วิเคราะห์: <span className="text-foreground font-medium">{item.receiver}</span></p>
                    )}
                    {item.instrument && (
                      <p>🖥️ เครื่องที่ตรวจ: <span className="text-foreground font-medium">{item.instrument}</span></p>
                    )}
                    {item.aiPercent !== undefined && (
                      <div className="flex items-center gap-2">
                        <span>🔬 วิเคราะห์ %AI</span>
                        <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all bg-lis-status-done"
                            style={{ width: `${item.aiPercent}%` }}
                          />
                        </div>
                        <span className="font-medium text-foreground">{item.aiPercent}%</span>
                      </div>
                    )}
                    {item.preResult !== undefined && (
                      <div className="mt-2 p-2 rounded-lg bg-lis-stat-green">
                        <p className="text-xs font-semibold text-lis-stat-green-icon">
                          📊 Pre-result %AI: <span className="text-sm">{item.preResult}%</span>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SampleColumn;
