import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DAILY_CHECK_ROOMS } from "@/lib/dailyCheckRooms";

const DailyCheckSummary = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {DAILY_CHECK_ROOMS.map((room) => (
        <Card
          key={room.slug}
          role="button"
          tabIndex={0}
          onClick={() => navigate(room.route)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(room.route);
            }
          }}
          className="cursor-pointer shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <room.icon className="h-4 w-4 text-primary" />
                {room.label}
              </CardTitle>
              <Badge
                variant="outline"
                className={
                  room.ready
                    ? "border-green-300 bg-green-100 text-green-700"
                    : "text-muted-foreground"
                }
              >
                {room.ready ? "พร้อมใช้งาน" : "อยู่ระหว่างพัฒนา"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              {room.forms.length} ฟอร์มในห้องนี้
            </p>
            <div className="flex items-center gap-1 text-sm font-medium text-primary">
              เปิดห้อง <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DailyCheckSummary;
