import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, History, Filter } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

const StockDeduction = () => {
  const [type, setType] = useState<string>("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["stock-deductions", type],
    queryFn: () =>
      api.getStockTransactions({
        action: "deduct",
        itemType: type || undefined,
        limit: 200,
      }),
  });

  return (
    <AppLayout>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <History className="w-6 h-6" />
              ประวัติการตัด Stock
            </h1>
            <p className="text-sm text-muted-foreground">
              รายการตัด stock จากการใช้งานในห้องปฏิบัติการ — บันทึกใน MongoDB
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue placeholder="ทุกหมวด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวด</SelectItem>
                <SelectItem value="standard">Standards</SelectItem>
                <SelectItem value="solvent">สารเคมี</SelectItem>
                <SelectItem value="glassware">เครื่องแก้ว</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              ประวัติการตัด Stock
              <Badge className="bg-primary/10 text-primary">{data.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
            ) : data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>ยังไม่มีรายการตัด stock</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>เวลา</TableHead>
                    <TableHead>หมวด</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">จำนวนที่ตัด</TableHead>
                    <TableHead>คงเหลือ</TableHead>
                    <TableHead>Sample ID</TableHead>
                    <TableHead>ผู้ดำเนินการ</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((t) => (
                    <TableRow key={t._id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleString("th-TH")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.itemType}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{t.itemName}</div>
                        {t.itemCode && (
                          <div className="text-xs text-muted-foreground">{t.itemCode}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.tier ? <Badge variant="outline">{t.tier}</Badge> : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        {t.delta != null ? t.delta : "-"} {t.unit || ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.beforeQty ?? "-"} → <strong>{t.afterQty ?? "-"}</strong>
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.sampleId ? <Badge variant="outline">{t.sampleId}</Badge> : "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.userName || t.userEmail || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.note || ""}
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

export default StockDeduction;
