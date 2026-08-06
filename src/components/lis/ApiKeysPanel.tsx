import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import ApiKeyFormDialog from "@/components/lis/ApiKeyFormDialog";
import ApiKeyList from "@/components/lis/ApiKeyList";
import ApiPolicyTable from "@/components/lis/ApiPolicyTable";
import ApiRequestLogTable from "@/components/lis/ApiRequestLogTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/context/ConfirmDialog";
import { api } from "@/lib/api";
import {
  API_POLICY_MODE_LABEL,
  type ApiKeyInput,
  type ApiKeyItem,
  type ApiPolicyMode,
} from "@/lib/apiKeys";

const errMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

// หน้านี้เป็นหน้าความปลอดภัย ("อะไรถูกคุมอยู่บ้าง") — ถ้า query 401/403 (เช่น admin gate ปฏิเสธ)
// ต้องไม่โชว์เป็นตารางว่างเฉยๆ เพราะ admin จะแยกไม่ออกว่า "ไม่มีอะไรถูกคุม" กับ "ไม่มีสิทธิ์ดู"
function ErrorState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-destructive/50 bg-destructive/5 p-6 text-center text-sm text-destructive">
      โหลดข้อมูลไม่สำเร็จ: {message}
    </p>
  );
}

export default function ApiKeysPanel() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiKeyItem | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  const {
    data: meta,
    isError: metaIsError,
    error: metaError,
  } = useQuery({ queryKey: ["api-keys", "meta"], queryFn: api.getApiKeyMeta });
  const {
    data: keys = [],
    isError: keysIsError,
    error: keysError,
  } = useQuery({ queryKey: ["api-keys"], queryFn: api.getApiKeys });
  const {
    data: logs = [],
    isLoading: logsLoading,
    isError: logsIsError,
    error: logsError,
  } = useQuery({
    queryKey: ["api-keys", "logs", outcomeFilter],
    queryFn: () =>
      api.getApiKeyLogs({ outcome: outcomeFilter === "all" ? undefined : outcomeFilter, limit: 50 }),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  };

  const createMutation = useMutation({
    mutationFn: api.createApiKey,
    onSuccess: () => {
      toast.success("สร้าง API key แล้ว");
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "สร้างไม่สำเร็จ")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ApiKeyInput> }) =>
      api.updateApiKey(id, input),
    onSuccess: () => {
      toast.success("บันทึกแล้ว");
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "บันทึกไม่สำเร็จ")),
  });

  const revokeMutation = useMutation({
    mutationFn: api.revokeApiKey,
    onSuccess: () => {
      toast.success("เพิกถอน key แล้ว");
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "เพิกถอนไม่สำเร็จ")),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteApiKey,
    onSuccess: () => {
      toast.success("ลบ key แล้ว");
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "ลบไม่สำเร็จ")),
  });

  const modeMutation = useMutation({
    mutationFn: ({ policyId, mode }: { policyId: string; mode: ApiPolicyMode }) =>
      api.setApiPolicyMode(policyId, mode),
    onSuccess: (result) => {
      toast.success(`เปลี่ยนเป็น "${API_POLICY_MODE_LABEL[result.mode]}" แล้ว`);
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "เปลี่ยนโหมดไม่สำเร็จ")),
  });

  const handleSubmit = async (input: ApiKeyInput) =>
    editing
      ? updateMutation.mutateAsync({ id: editing.id, input })
      : createMutation.mutateAsync(input);

  const handleRevoke = async (item: ApiKeyItem) => {
    const ok = await confirm({
      title: "เพิกถอน key นี้?",
      description: `"${item.name}" จะใช้งานไม่ได้ทันที ระบบที่ใช้ key ใบนี้อยู่จะโดนปฏิเสธ`,
      confirmText: "เพิกถอน",
      variant: "danger",
    });
    if (ok) revokeMutation.mutate(item.id);
  };

  const handleDelete = async (item: ApiKeyItem) => {
    const ok = await confirm({
      title: "ลบ key นี้?",
      description: `"${item.name}" จะหายจากรายการ (ประวัติการเรียกยังอยู่)`,
      confirmText: "ลบ",
      variant: "danger",
    });
    if (ok) deleteMutation.mutate(item.id);
  };

  const handleChangeMode = async (policyId: string, mode: ApiPolicyMode) => {
    const policy = meta?.policies.find((p) => p.id === policyId);
    if (mode === "enforce" && policy) {
      const ok = await confirm({
        title: "บังคับใช้ key กับ endpoint นี้?",
        description:
          policy.wouldBlock7d > 0
            ? `จากสถิติ 7 วันที่ผ่านมา จะมี ${policy.wouldBlock7d} ครั้งที่ถูกบล็อก — ตรวจว่าระบบปลายทางตั้ง key ครบแล้วก่อนกดยืนยัน`
            : "7 วันที่ผ่านมาไม่มีการเรียกที่จะถูกบล็อก เปิดได้เลย",
        confirmText: "บังคับใช้",
        variant: policy.wouldBlock7d > 0 ? "danger" : "default",
      });
      if (!ok) return;
    }
    modeMutation.mutate({ policyId, mode });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">API key</CardTitle>
            <CardDescription>
              ออก key ให้ระบบภายนอก (Node-RED, n8n, ระบบ production) ค่า key เต็มโชว์ครั้งเดียวตอนสร้าง
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            สร้าง API key
          </Button>
        </CardHeader>
        <CardContent>
          {keysIsError ? (
            <ErrorState message={errMessage(keysError, "ไม่ทราบสาเหตุ")} />
          ) : (
            <ApiKeyList
              items={keys}
              scopes={meta?.scopes ?? []}
              onEdit={(item) => {
                setEditing(item);
                setFormOpen(true);
              }}
              onRevoke={handleRevoke}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">การป้องกัน endpoint</CardTitle>
          <CardDescription>
            "เฝ้าดู" = ปล่อยผ่านแต่บันทึกว่าใครจะโดนบล็อก ใช้ดูให้ชัวร์ก่อนเปลี่ยนเป็น "บังคับใช้ key"
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metaIsError ? (
            <ErrorState message={errMessage(metaError, "ไม่ทราบสาเหตุ")} />
          ) : (
            <ApiPolicyTable
              policies={meta?.policies ?? []}
              modes={meta?.modes ?? []}
              saving={modeMutation.isPending}
              onChangeMode={handleChangeMode}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติการเรียก</CardTitle>
          <CardDescription>50 รายการล่าสุด (เก็บย้อนหลัง 30 วัน)</CardDescription>
        </CardHeader>
        <CardContent>
          {logsIsError ? (
            <ErrorState message={errMessage(logsError, "ไม่ทราบสาเหตุ")} />
          ) : (
            <ApiRequestLogTable
              logs={logs}
              loading={logsLoading}
              outcomeFilter={outcomeFilter}
              onOutcomeFilterChange={setOutcomeFilter}
            />
          )}
        </CardContent>
      </Card>

      <ApiKeyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        scopes={meta?.scopes ?? []}
        editing={editing}
        saving={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
