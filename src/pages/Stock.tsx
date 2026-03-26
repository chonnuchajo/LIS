import { useState } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, Clock } from "lucide-react";
import { stockStandards, stockSolvents } from "@/data/stockData";

const EXPIRY_WARNING_DAYS = 180;
const LOW_STANDARD_QTY = 50;
const LOW_SOLVENT_QTY = 500;

const Stock = () => {
  const now = Date.now();

  const lowStandards = stockStandards.filter(s => s.remainingQty < LOW_STANDARD_QTY);
  const expiringStandards = stockStandards.filter(s => new Date(s.expiryDate).getTime() < now + EXPIRY_WARNING_DAYS * 86400000);
  const lowSolvents = stockSolvents.filter(s => s.remainingQty < LOW_SOLVENT_QTY);
  const expiringSolvents = stockSolvents.filter(s => new Date(s.expiryDate).getTime() < now + EXPIRY_WARNING_DAYS * 86400000);

  const totalAlerts = lowStandards.length + expiringStandards.length + lowSolvents.length + expiringSolvents.length;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6" />
            Stock Management
          </h1>
          <p className="text-sm text-muted-foreground">จัดการ Standard และ Solvent สำหรับห้องปฏิบัติการ</p>
        </div>

        {/* Alert Summary */}
        {totalAlerts > 0 && (
          <Card className="mb-6 border-destructive/30 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span className="font-semibold text-destructive">แจ้งเตือน ({totalAlerts} รายการ)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {lowStandards.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-destructive">
                    <Package className="w-3.5 h-3.5" />
                    <span>Standard <strong>{s.name}</strong> เหลือ {s.remainingQty} {s.unit} (ใกล้หมด)</span>
                  </div>
                ))}
                {expiringStandards.map(s => (
                  <div key={`exp-${s.id}`} className="flex items-center gap-2 text-lis-stat-amber-icon">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Standard <strong>{s.name}</strong> หมดอายุ {s.expiryDate}</span>
                  </div>
                ))}
                {lowSolvents.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-destructive">
                    <Package className="w-3.5 h-3.5" />
                    <span>Solvent <strong>{s.name}</strong> เหลือ {s.remainingQty} {s.unit} (ใกล้หมด)</span>
                  </div>
                ))}
                {expiringSolvents.map(s => (
                  <div key={`exp-${s.id}`} className="flex items-center gap-2 text-lis-stat-amber-icon">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Solvent <strong>{s.name}</strong> หมดอายุ {s.expiryDate}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="standard">
          <TabsList className="mb-4">
            <TabsTrigger value="standard">
              Standard
              {(lowStandards.length + expiringStandards.length) > 0 && (
                <Badge className="ml-2 bg-destructive/10 text-destructive text-xs">{lowStandards.length + expiringStandards.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="solvent">
              Solvent
              {(lowSolvents.length + expiringSolvents.length) > 0 && (
                <Badge className="ml-2 bg-destructive/10 text-destructive text-xs">{lowSolvents.length + expiringSolvents.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standard">
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
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockStandards.map(item => {
                      const isLow = item.remainingQty < LOW_STANDARD_QTY;
                      const isExpiring = new Date(item.expiryDate).getTime() < now + EXPIRY_WARNING_DAYS * 86400000;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-semibold text-primary">{item.id}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell><Badge variant="outline">{item.lotNo}</Badge></TableCell>
                          <TableCell>{item.manufacturer}</TableCell>
                          <TableCell>{item.purity}%</TableCell>
                          <TableCell>{item.receivedDate}</TableCell>
                          <TableCell>
                            <span className={isExpiring ? "text-destructive font-medium" : ""}>{item.expiryDate}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={isLow ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}>
                              {item.remainingQty} {item.unit}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>
                            {isLow && <Badge className="bg-destructive/10 text-destructive text-xs mr-1">ใกล้หมด</Badge>}
                            {isExpiring && <Badge className="bg-lis-stat-amber text-lis-stat-amber-icon text-xs">ใกล้หมดอายุ</Badge>}
                            {!isLow && !isExpiring && <Badge className="bg-lis-stat-green text-lis-stat-green-icon text-xs">ปกติ</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="solvent">
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
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockSolvents.map(item => {
                      const isLow = item.remainingQty < LOW_SOLVENT_QTY;
                      const isExpiring = new Date(item.expiryDate).getTime() < now + EXPIRY_WARNING_DAYS * 86400000;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-semibold text-primary">{item.id}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell><Badge variant="outline">{item.lotNo}</Badge></TableCell>
                          <TableCell>{item.manufacturer}</TableCell>
                          <TableCell><Badge className="bg-accent text-accent-foreground">{item.grade}</Badge></TableCell>
                          <TableCell>{item.receivedDate}</TableCell>
                          <TableCell>
                            <span className={isExpiring ? "text-destructive font-medium" : ""}>{item.expiryDate}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={isLow ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}>
                              {item.remainingQty} {item.unit}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>
                            {isLow && <Badge className="bg-destructive/10 text-destructive text-xs mr-1">ใกล้หมด</Badge>}
                            {isExpiring && <Badge className="bg-lis-stat-amber text-lis-stat-amber-icon text-xs">ใกล้หมดอายุ</Badge>}
                            {!isLow && !isExpiring && <Badge className="bg-lis-stat-green text-lis-stat-green-icon text-xs">ปกติ</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Stock;
