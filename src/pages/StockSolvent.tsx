import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { stockSolvents } from "@/data/stockData";

const StockSolvent = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6" />
            Stock Solvent
          </h1>
          <p className="text-sm text-muted-foreground">จัดการ Solvent สำหรับใช้ในห้องปฏิบัติการ</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">รายการ Solvent ในคลัง</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อ Solvent</TableHead>
                  <TableHead>LOT NO.</TableHead>
                  <TableHead>ผู้ผลิต</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>วันที่รับ</TableHead>
                  <TableHead>วันหมดอายุ</TableHead>
                  <TableHead>คงเหลือ</TableHead>
                  <TableHead>ที่เก็บ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockSolvents.map(item => {
                  const isLow = item.remainingQty < 500;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-primary">{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell><Badge variant="outline">{item.lotNo}</Badge></TableCell>
                      <TableCell>{item.manufacturer}</TableCell>
                      <TableCell><Badge className="bg-accent text-accent-foreground">{item.grade}</Badge></TableCell>
                      <TableCell>{item.receivedDate}</TableCell>
                      <TableCell>{item.expiryDate}</TableCell>
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

export default StockSolvent;
