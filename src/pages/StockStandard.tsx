import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { stockStandards } from "@/data/stockData";

const StockStandard = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6" />
            Stock Standard
          </h1>
          <p className="text-sm text-muted-foreground">จัดการ Standard สำหรับใช้ในการวิเคราะห์ (FIFO)</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">รายการ Standard ในคลัง</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อ Standard</TableHead>
                  <TableHead>LOT NO.</TableHead>
                  <TableHead>ผู้ผลิต</TableHead>
                  <TableHead>Purity (%)</TableHead>
                  <TableHead>วันที่รับ</TableHead>
                  <TableHead>วันหมดอายุ</TableHead>
                  <TableHead>คงเหลือ</TableHead>
                  <TableHead>ที่เก็บ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockStandards.map(item => {
                  const isLow = item.remainingQty < 50;
                  const isExpiringSoon = new Date(item.expiryDate) < new Date(Date.now() + 180 * 86400000);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-primary">{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell><Badge variant="outline">{item.lotNo}</Badge></TableCell>
                      <TableCell>{item.manufacturer}</TableCell>
                      <TableCell>{item.purity}%</TableCell>
                      <TableCell>{item.receivedDate}</TableCell>
                      <TableCell>
                        <span className={isExpiringSoon ? "text-destructive font-medium" : ""}>
                          {item.expiryDate}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={isLow ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}>
                          {item.remainingQty} {item.unit}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.location}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StockStandard;
