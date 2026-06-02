import { Construction, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoomBySlug } from "@/lib/dailyCheckRooms";

interface RoomPlaceholderPageProps {
  slug: string;
}

const RoomPlaceholderPage = ({ slug }: RoomPlaceholderPageProps) => {
  const room = getRoomBySlug(slug);

  if (!room) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">ไม่พบห้องที่ระบุ</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Construction className="h-4 w-4 text-amber-500" />
            {room.label} — อยู่ระหว่างพัฒนา
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            หน้านี้กำลังจะเปิดให้บันทึกฟอร์มต่อไปนี้
          </p>
          <ul className="space-y-1.5">
            {room.forms.map((form) => (
              <li
                key={form}
                className="flex items-center gap-2 text-sm text-muted-foreground/80"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {form}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomPlaceholderPage;
