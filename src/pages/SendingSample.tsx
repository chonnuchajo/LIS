import { useState } from "react";
import { Send, Plus, Trash2 } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";

const SendingSample = () => {
  const { sendSample } = useSamples();
  const [sampleName, setSampleName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [pendingList, setPendingList] = useState<
    { id: string; name: string; sender: string; date: string; time: string }[]
  >([]);

  const handleAdd = () => {
    if (!sampleName.trim() || !senderName.trim()) {
      toast.error("กรุณากรอกชื่อตัวอย่างและชื่อผู้ส่ง");
      return;
    }
    const now = new Date();
    const id = `SMP-${now.getFullYear()}-${String(pendingList.length + 1).padStart(3, "0")}`;
    setPendingList(prev => [
      ...prev,
      {
        id,
        name: sampleName.trim(),
        sender: senderName.trim(),
        date: now.toLocaleDateString("th-TH"),
        time: now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setSampleName("");
    toast.success(`เพิ่มตัวอย่าง "${sampleName.trim()}" แล้ว`);
  };

  const handleRemove = (index: number) => {
    setPendingList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendAll = () => {
    if (pendingList.length === 0) {
      toast.warning("ไม่มีตัวอย่างในรายการ");
      return;
    }
    pendingList.forEach(item => {
      sendSample({
        id: item.id,
        name: item.name,
        status: "sent",
        date: item.date,
        time: item.time,
        sender: item.sender,
      });
    });
    toast.success(`ส่งตัวอย่างทั้งหมด ${pendingList.length} รายการสำเร็จ`);
    setPendingList([]);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">การส่งตัวอย่าง</h1>
            <p className="text-sm text-muted-foreground">เพิ่มรายการตัวอย่างเพื่อส่งเข้าห้องปฏิบัติการ</p>
          </div>
        </div>

        {/* Add sample form */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">เพิ่มตัวอย่าง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-foreground mb-1 block">ชื่อตัวอย่าง</label>
                <Input
                  placeholder="เช่น Paracetamol 500 mg"
                  value={sampleName}
                  onChange={e => setSampleName(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-foreground mb-1 block">ชื่อผู้ส่ง</label>
                <Input
                  placeholder="เช่น บริษัท ABC จำกัด"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                />
              </div>
              <Button onClick={handleAdd} className="gap-2">
                <Plus className="w-4 h-4" />
                เพิ่มรายการ
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending list */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              รายการตัวอย่างที่จะส่ง
              <Badge className="bg-primary/10 text-primary">{pendingList.length}</Badge>
            </CardTitle>
            {pendingList.length > 0 && (
              <Button onClick={handleSendAll} className="gap-2">
                <Send className="w-4 h-4" />
                ส่งตัวอย่างทั้งหมด
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pendingList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>ยังไม่มีรายการ กรุณาเพิ่มตัวอย่างด้านบน</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัสตัวอย่าง</TableHead>
                    <TableHead>ชื่อตัวอย่าง</TableHead>
                    <TableHead>ผู้ส่ง</TableHead>
                    <TableHead>วันที่/เวลา</TableHead>
                    <TableHead className="w-[80px]">ลบ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingList.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-primary">{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.sender}</TableCell>
                      <TableCell className="text-xs">{item.date}<br />{item.time}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(idx)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
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

export default SendingSample;
