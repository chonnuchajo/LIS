import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCircle } from "lucide-react";

interface Props {
  roles: string[];
  activeRole: string;
  onChange: (r: string) => void;
  roleNames: Record<string, string>;
}

export default function ActiveRoleSwitcher({ roles, activeRole, onChange, roleNames }: Props) {
  const nameOf = (id: string) => roleNames[id] ?? id;
  if (roles.length <= 1) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs font-medium">
        <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
        {nameOf(activeRole)}
      </div>
    );
  }
  return (
    <Select value={activeRole} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[190px] gap-1.5">
        <UserCircle className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r} value={r}>{nameOf(r)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
