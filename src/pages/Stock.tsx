import { useState } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Package, AlertTriangle, Clock, QrCode, Weight, Minus } from "lucide-react";
import { stockStandards, stockSolvents, StockStandardItem, StockSolventItem } from "@/data/stockData";
import { toast } from "sonner";

const EXPIRY_WARNING_DAYS = 180;
const LOW_STANDARD_QTY = 50;
const LOW_SOLVENT_QTY = 500;

const Stock = () => {
  const now = Date.now();
  const [standards, setStandards] = useState<StockStandardItem[]>(stockStandards);
  const [solvents, setSolvents] = useState<StockSolventItem[]>(stockSolvents);

  // Standard scan dialog
  const [stdDialogOpen, setStdDialogOpen] = useState(false);
  const [scannedStd, setScannedStd] = useState<StockStandardItem | null>(null);
  const [deductWeight, setDeductWeight] = useState("");

  // Solvent scan dialog
  const [solDialogOpen, setSolDialogOpen] = useState(false);
  const [scannedSol, setScannedSol] = useState<StockSolventItem | null>(null);

  const lowStandards = standards.filter(s => s.remainingQty < LOW_STANDARD_QTY);
  const expiringStandards = standards.filter(s => new Date(s.expiryDate).getTime() < now + EXPIRY_WARNING_DAYS * 86400000);
  const lowSolvents = solvents.filter(s => s.remainingQty < LOW_SOLVENT_QTY);
  const expiringSolvents = solvents.filter(s => new Date(s.expiryDate).getTime() < now + EXPIRY_WARNING_DAYS * 86400000);
  const totalAlerts = lowStandards.length + expiringStandards.length + lowSolvents.length + expiringSolvents.length;

  const handleScanStandard = () => {
    // Simulate scanning – pick a random standard
    const item = standards[Math.floor(Math.random() * standards.length)];
    setScannedStd(item);
    setDeductWeight("");
    setStdDialogOpen(true);
    toast.info(`สแกน QR Code: ${item.name} (${item.lotNo})`);
  };

  const handleDeductStandard = () => {
    if (!scannedStd) return;
    const w = parseFloat(deductWeight);
    if (isNaN(w) || w <= 0) {
      toast.error("กรุณากรอกน้ำหนักที่ถูกต้อง");
      return;
    }
    if (w > scannedStd.remainingQty) {
      toast.error("น้ำหนักที่กรอกมากกว่าจำนวนคงเหลือ");
      return;
    }
    setStandards(prev =>
      prev.map(s => s.id === scannedStd.id ? { ...s, remainingQty: Math.round((s.remainingQty - w) * 100) / 100 } : s)
    );
    toast.success(`ตัดสต็อก ${scannedStd.name} จำนวน ${w} ${scannedStd.unit} สำเร็จ`);
    setStdDialogOpen(false);
  };

  const handleScanSolvent = () => {
    const item = solvents[Math.floor(Math.random() * solvents.length)];
    setScannedSol(item);
    setSolDialogOpen(true);
    toast.info(`สแกน QR Code: ${item.name} (${item.lotNo})`);
  };

  const handleDeductSolvent = () => {
    if (!scannedSol) return;
    // Deduct 1 bottle (full container)
    setSolvents(prev =>
      prev.map(s => s.id === scannedSol.id ? { ...s, remainingQty: 0 } : s)
    );
    toast.success(`เบิกออก ${scannedSol.name} (${scannedSol.lotNo}) 1 ขวด สำเร็จ`);
    setSolDialogOpen(false);
  };

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
                  <div key={`exp-${s.id}`} className="flex items-center gap-2 text-amber-600">
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
                  <div key={`exp-${s.id}`} className="flex items-center gap-2 text-amber-600">
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
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">รายการ Standard ในคลัง</CardTitle>
                <Button onClick={handleScanStandard} className="gap-2">
                  <QrCode className="w-4 h-4" />
                  สแกน QR ตัด Standard
                </Button>
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
                    {standards.map(item => {
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
                            {isExpiring && <Badge className="bg-amber-100 text-amber-700 text-xs">ใกล้หมดอายุ</Badge>}
                            {!isLow && !isExpiring && <Badge className="bg-emerald-100 text-emerald-700 text-xs">ปกติ</Badge>}
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
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">รายการ Solvent ในคลัง</CardTitle>
                <Button onClick={handleScanSolvent} variant="secondary" className="gap-2">
                  <QrCode className="w-4 h-4" />
                  สแกน QR เบิก Solvent
                </Button>
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
                    {solvents.map(item => {
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
                            {isExpiring && <Badge className="bg-amber-100 text-amber-700 text-xs">ใกล้หมดอายุ</Badge>}
                            {!isLow && !isExpiring && <Badge className="bg-emerald-100 text-emerald-700 text-xs">ปกติ</Badge>}
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

        {/* Standard Scan Dialog – กรอกน้ำหนัก */}
        <Dialog open={stdDialogOpen} onOpenChange={setStdDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Weight className="w-5 h-5 text-primary" />
                ตัดสต็อก Standard
              </DialogTitle>
            </DialogHeader>
            {scannedStd && (
              <div className="space-y-4">
                <div className="bg-accent/50 rounded-lg p-4 space-y-1 text-sm">
                  <p><strong>ชื่อ:</strong> {scannedStd.name}</p>
                  <p><strong>LOT NO.:</strong> {scannedStd.lotNo}</p>
                  <p><strong>Purity:</strong> {scannedStd.purity}%</p>
                  <p><strong>คงเหลือ:</strong> {scannedStd.remainingQty} {scannedStd.unit}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">น้ำหนักที่ใช้ ({scannedStd.unit})</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={scannedStd.remainingQty}
                    placeholder={`กรอกน้ำหนัก (${scannedStd.unit})`}
                    value={deductWeight}
                    onChange={e => setDeductWeight(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStdDialogOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleDeductStandard} className="gap-2">
                <Minus className="w-4 h-4" />
                ยืนยันตัดสต็อก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Solvent Scan Dialog – เบิกทั้งขวด */}
        <Dialog open={solDialogOpen} onOpenChange={setSolDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                เบิก Solvent
              </DialogTitle>
            </DialogHeader>
            {scannedSol && (
              <div className="space-y-4">
                <div className="bg-accent/50 rounded-lg p-4 space-y-1 text-sm">
                  <p><strong>ชื่อ:</strong> {scannedSol.name}</p>
                  <p><strong>LOT NO.:</strong> {scannedSol.lotNo}</p>
                  <p><strong>Grade:</strong> {scannedSol.grade}</p>
                  <p><strong>คงเหลือ:</strong> {scannedSol.remainingQty} {scannedSol.unit}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  ยืนยันการเบิก Solvent ขวดนี้ออกจากคลัง (ตัดสต็อกทั้งขวด)
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSolDialogOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleDeductSolvent} variant="destructive" className="gap-2">
                <Minus className="w-4 h-4" />
                ยืนยันเบิกออก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Stock;
