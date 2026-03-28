import { useState } from "react";
import { ClipboardList } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const mockDeductions = [
  { id: "DED-001", sample: "Paracetamol 500 mg", standard: "Paracetamol RS", lotNo: "STD-2024-001", usedAmount: "25 mg", date: "27/03/2567", operator: "สมชาย" },
  { id: "DED-002", sample: "Amoxicillin 250 mg", standard: "Amoxicillin RS", lotNo: "STD-2024-002", usedAmount: "30 mg", date: "27/03/2567", operator: "สมหญิง" },
  { id: "DED-003", sample: "Ibuprofen 400 mg", standard: "Ibuprofen RS", lotNo: "STD-2024-003", usedAmount: "20 mg", date: "26/03/2567", operator: "สมชาย" },
];

const StockDeduction = () => {
  const [deductions] = useState(mockDeductions);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">การบันทึกตัดสต็อก</h1>
            <p className="text-sm text-muted-foreground">บันทึกรายการตัดสต็อก Standard/Solvent ที่ใช้ในการวิเคราะห์</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              รายการตัดสต็อก
              <Badge className="bg-primary/10 text-primary">{deductions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deductions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>ยังไม่มีรายการตัดสต็อก</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ตัวอย่าง</TableHead>
                    <TableHead>Standard ที่ใช้</TableHead>
                    <TableHead>Lot No.</TableHead>
                    <TableHead>ปริมาณที่ใช้</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ผู้ดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-primary">{item.id}</TableCell>
                      <TableCell>{item.sample}</TableCell>
                      <TableCell>{item.standard}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.lotNo}</Badge>
                      </TableCell>
                      <TableCell>{item.usedAmount}</TableCell>
                      <TableCell className="text-sm">{item.date}</TableCell>
                      <TableCell>{item.operator}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StockDeduction;
