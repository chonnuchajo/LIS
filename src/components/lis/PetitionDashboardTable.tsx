import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PETITION_STATUS_CONFIG, type Petition } from "@/types/petition.types";

const formatDate = (value: string) => new Date(value).toLocaleDateString("th-TH");
const formatTime = (value: string) => new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export default function PetitionDashboardTable({
  title,
  petitions,
  loading,
  emptyText,
  actionLabel,
}: {
  title: string;
  petitions: Petition[];
  loading: boolean;
  emptyText: string;
  actionLabel: string;
}) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <Button variant="primary-outline" size="sm" onClick={() => navigate("/petitions")}>
            ดูรายการคำร้องทั้งหมด
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">กำลังโหลดคำร้อง...</p>
        ) : petitions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่คำร้อง</TableHead>
                  <TableHead>ผู้ยื่น</TableHead>
                  <TableHead>แผนก</TableHead>
                  <TableHead>ตัวอย่าง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>อัปเดตล่าสุด</TableHead>
                  <TableHead className="text-right">ดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {petitions.map((petition) => {
                  const statusCfg =
                    PETITION_STATUS_CONFIG[petition.status] ?? { label: petition.status, variant: "gray-soft" as const };

                  return (
                    <TableRow key={petition._id}>
                      <TableCell className="font-semibold text-primary">{petition.petitionNo}</TableCell>
                      <TableCell>{petition.requester.fullName}</TableCell>
                      <TableCell>{petition.requester.department}</TableCell>
                      <TableCell>{petition.items.length} รายการ</TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(petition.updatedAt)} {formatTime(petition.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="primary" onClick={() => navigate(`/petitions/${petition._id}`)}>
                          {actionLabel}
                        </Button>
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
  );
}
