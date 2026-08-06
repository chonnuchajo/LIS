import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_POLICY_MODE_LABEL, type ApiPolicyItem, type ApiPolicyMode } from "@/lib/apiKeys";

interface Props {
  policies: ApiPolicyItem[];
  modes: ApiPolicyMode[];
  saving: boolean;
  onChangeMode: (policyId: string, mode: ApiPolicyMode) => void;
}

export default function ApiPolicyTable({ policies, modes, saving, onChangeMode }: Props) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="p-2 text-left">endpoint</th>
            <th className="p-2 text-left">scope ที่ต้องมี</th>
            <th className="p-2 text-left">7 วันที่ผ่านมา</th>
            <th className="p-2 text-left">โหมด</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id} className="border-t">
              <td className="p-2">
                <div className="font-medium">{policy.label}</div>
                <code className="text-xs text-muted-foreground">{policy.path}</code>
              </td>
              <td className="p-2">
                <Badge variant="outline" className="text-[11px]">{policy.scope}</Badge>
                {policy.legacyEnv && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    ยังรับ token เดิม: {policy.legacyEnv}
                  </div>
                )}
              </td>
              <td className="p-2">
                {policy.wouldBlock7d > 0 ? (
                  <span className="text-amber-600">
                    จะถูกบล็อก {policy.wouldBlock7d} ครั้ง
                  </span>
                ) : (
                  <span className="text-muted-foreground">ไม่มีที่จะถูกบล็อก</span>
                )}
              </td>
              <td className="p-2">
                <Select
                  value={policy.mode}
                  disabled={saving}
                  onValueChange={(value) => onChangeMode(policy.id, value as ApiPolicyMode)}
                >
                  <SelectTrigger className="w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modes.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {API_POLICY_MODE_LABEL[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
