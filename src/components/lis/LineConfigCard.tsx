import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, MessageCircle, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { LINE_AUDIENCES, LINE_BOT_COMMANDS, LINE_NOTIFICATIONS, lineAudienceLabel, type LineAudience } from "@/lib/lineConfig";

const WEBHOOK_HINT = `${window.location.origin}/LIS/api/line/webhook`;
const INGEST_HINT = `${window.location.origin}/LIS/api/line/ingest`;

const LineConfigCard = () => {
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState<LineAudience>("all");
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");

  const { data: health } = useQuery({ queryKey: ["line", "health"], queryFn: api.getLineHealth });
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["line", "groups"],
    queryFn: api.getLineGroups,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["line", "groups"] });
    queryClient.invalidateQueries({ queryKey: ["line", "health"] });
  };

  const createMutation = useMutation({
    mutationFn: () => api.createLineGroup({ groupId: groupId.trim(), audience, name: name.trim() || undefined }),
    onSuccess: () => {
      toast.success("ผูกกลุ่ม LINE แล้ว");
      setGroupId("");
      setName("");
      invalidate();
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ"),
  });

  const deleteMutation = useMutation({
    mutationFn: (gid: string) => api.deleteLineGroup(gid),
    onSuccess: () => {
      toast.success("ลบกลุ่มแล้ว");
      invalidate();
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ"),
  });

  const testMutation = useMutation({
    mutationFn: (aud: string) => api.testLinePush(aud),
    onSuccess: (r) => toast.success(`ส่งข้อความทดสอบไป ${r.sent} กลุ่มแล้ว`),
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "ส่งไม่สำเร็จ"),
  });

  const configured = health?.configured;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          การแจ้งเตือน LINE
          {health &&
            (configured ? (
              <Badge variant="green-soft" className="ml-1 gap-1">
                <CheckCircle2 className="w-3 h-3" /> เชื่อมต่อแล้ว
              </Badge>
            ) : (
              <Badge variant="yellow-soft" className="ml-1 gap-1">
                <AlertTriangle className="w-3 h-3" /> ยังไม่ตั้ง token
              </Badge>
            ))}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!configured && (
          <p className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
            ยังไม่ได้ตั้ง <code>LINE_CHANNEL_ACCESS_TOKEN</code> ใน <code>server/.env</code> —
            ผูกกลุ่มไว้ก่อนได้ แต่ระบบจะยังไม่ส่งข้อความจริงจนกว่าจะตั้ง token แล้วรีสตาร์ท backend
          </p>
        )}

        {/* What gets sent */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">การแจ้งเตือนที่ระบบส่งเข้า LINE</p>
          <ul className="space-y-1.5 rounded-md border border-border p-3">
            {LINE_NOTIFICATIONS.map((n) => (
              <li key={n.title} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="w-5 text-center">{n.emoji}</span>
                <span className="font-medium">{n.title}</span>
                {n.audiences.map((a) => (
                  <Badge key={a} variant="blue-soft" className="text-[10px]">{lineAudienceLabel(a)}</Badge>
                ))}
                {n.note && <span className="text-[11px] text-muted-foreground">{n.note}</span>}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            กลุ่มที่ผูกเป็น <span className="font-medium">ทุกเหตุการณ์ (รวม)</span> จะได้รับทุกข้อความข้างต้น
          </p>
        </div>

        {/* What users can ask */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">ผู้ใช้พิมพ์ถามบอทได้ (ในแชต/กลุ่ม)</p>
          <ul className="space-y-1.5 rounded-md border border-border p-3">
            {LINE_BOT_COMMANDS.map((c) => (
              <li key={c.example} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] font-mono">{c.example}</code>
                <span className="text-[12px] text-muted-foreground">{c.desc}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            ในกลุ่ม บอทจะตอบเฉพาะเมื่อพิมพ์คำสั่ง/เลขคำขอที่ชัดเจน (ไม่รบกวนแชตอื่น)
          </p>
        </div>

        {/* Registered groups */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">กลุ่มที่ผูกไว้</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีกลุ่ม — เพิ่มด้านล่าง หรือพิมพ์ <code>/ผูก qc</code> ในกลุ่ม LINE</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {groups.map((g) => (
                <li key={g._id} className="flex items-center gap-3 px-3 py-2">
                  <Badge variant="blue-soft" className="shrink-0">{lineAudienceLabel(g.audience)}</Badge>
                  <div className="min-w-0 flex-1">
                    {g.name && <div className="text-sm font-medium truncate">{g.name}</div>}
                    <div className="text-[11px] text-muted-foreground font-mono truncate">{g.groupId}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-primary"
                    disabled={testMutation.isPending || !configured}
                    onClick={() => testMutation.mutate(g.audience)}
                    title="ส่งข้อความทดสอบไปยังผู้รับนี้"
                  >
                    <Send className="w-3.5 h-3.5" /> ทดสอบ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(g.groupId)}
                    title="ลบกลุ่ม"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add group */}
        <div className="rounded-md border border-dashed border-border p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">เพิ่มกลุ่มด้วยตนเอง</p>
          <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
            <Select value={audience} onValueChange={(v) => setAudience(v as LineAudience)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_AUDIENCES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-9 text-sm font-mono"
              placeholder="groupId (ขึ้นต้นด้วย C / R / U)"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {LINE_AUDIENCES.find((a) => a.value === audience)?.description}
          </p>
          <Input
            className="h-9 text-sm"
            placeholder="ชื่อกลุ่ม (ไม่บังคับ)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-1"
              disabled={createMutation.isPending || !groupId.trim()}
              onClick={() => createMutation.mutate()}
            >
              <Plus className="w-4 h-4" /> เพิ่มกลุ่ม
            </Button>
          </div>
        </div>

        {/* Setup hint */}
        <div className="text-[11px] text-muted-foreground space-y-1 border-t border-border pt-3">
          <p className="font-medium text-foreground/80">วิธีหา groupId แบบง่าย</p>
          <p>เพิ่มบอทเข้ากลุ่ม → พิมพ์ <code>/ผูก qc</code> (หรือ lab/all) ในกลุ่มนั้น บอทจะจดให้อัตโนมัติ</p>
          {health?.ingest ? (
            <>
              <p className="font-medium text-foreground/80 pt-1">รับผ่าน n8n (LINE → n8n → LIS)</p>
              <p>ให้ n8n relay payload มาที่ endpoint นี้ พร้อม header <code>X-LIS-Ingest-Key</code>:</p>
              <p className="font-mono break-all">{INGEST_HINT}</p>
              <p>LIS จะไม่ตอบ event join เอง (ปล่อยให้ n8n ตอบ) เพื่อกัน replyToken ชนกัน</p>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground/80 pt-1">Webhook URL (ตั้งในคอนโซล LINE)</p>
              <p className="font-mono break-all">{WEBHOOK_HINT}</p>
            </>
          )}
          {health?.forwarding && (
            <>
              <p className="font-medium text-foreground/80 pt-1">ส่งต่อ (forward) ไปยัง</p>
              <p className="font-mono break-all">{health.forwardUrl}</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LineConfigCard;
