import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MoreVertical, Users, KeyRound, Trash2 } from "lucide-react";
import type { Role } from "./types";

interface Props {
  role: Role;
  userCount: number;
  permCount: number;
  modules: string[];
  onEdit: () => void;
  onDelete: () => void;
}

export default function RoleCard({ role, userCount, permCount, modules, onEdit, onDelete }: Props) {
  const [confirm, setConfirm] = useState(false);
  const deletable = !role.locked && userCount === 0;
  const shown = modules.slice(0, 5);
  const extra = modules.length - shown.length;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            {role.name}
            {role.locked ? <Badge variant="gray-soft" className="text-[10px]">locked</Badge> : null}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{role.description || "—"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="เมนู"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>แก้ไข</DropdownMenuItem>
            {!role.locked && (
              <>
                <DropdownMenuSeparator />
                {userCount > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* span wrapper so the disabled item still shows a tooltip */}
                        <span>
                          <DropdownMenuItem disabled className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> ลบ
                          </DropdownMenuItem>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>มีผู้ใช้ {userCount} คนอยู่</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirm(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> ลบ
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Users className="h-3.5 w-3.5" /> {userCount} คน</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> {permCount} สิทธิ์</span>
        </div>
        {modules.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground mr-1">โมดูล:</span>
            {shown.map((m) => <Badge key={m} variant="outline" className="text-[11px]">{m}</Badge>)}
            {extra > 0 ? <Badge variant="outline" className="text-[11px]">+{extra}</Badge> : null}
          </div>
        )}
      </CardContent>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>ลบ Role “{role.name}”?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">การลบนี้ย้อนกลับไม่ได้</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => { onDelete(); setConfirm(false); }}>ลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
