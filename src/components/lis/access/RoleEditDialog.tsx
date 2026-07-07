import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "./types";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  role: Role | null;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string }) => void;
}

export default function RoleEditDialog({ open, mode, role, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(mode === "edit" && role ? role.name : "");
    setDescription(mode === "edit" && role ? role.description : "");
  }, [open, mode, role]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "create" ? "สร้าง Role" : "แก้ไข Role"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ Role" autoFocus />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="คำอธิบาย" />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={!name.trim()}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
