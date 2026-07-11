import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Role, RoleFamily } from "./types";

const FAMILY_OPTIONS: { value: RoleFamily; label: string; description: string }[] = [
  { value: "lab", label: "Lab", description: "Adds lab-analyze to assigned users" },
  { value: "qc", label: "QC", description: "Adds qc-staff to assigned users" },
  { value: "", label: "Not Lab/QC", description: "No automatic working role" },
];

interface Props {
  open: boolean;
  mode: "create" | "edit";
  role: Role | null;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string; family: RoleFamily }) => void;
}

function resolveFamily(role: Role): RoleFamily {
  if (role.family != null) return role.family;
  if (/^lab(?:[-_]|$)/.test(role.id)) return "lab";
  if (/^qc(?:[-_]|$)/.test(role.id)) return "qc";
  return "";
}

export default function RoleEditDialog({ open, mode, role, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState<RoleFamily>("");

  useEffect(() => {
    if (!open) return;
    setName(mode === "edit" && role ? role.name : "");
    setDescription(mode === "edit" && role ? role.description : "");
    setFamily(mode === "edit" && role ? resolveFamily(role) : "");
  }, [open, mode, role]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), family });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{mode === "create" ? "Create Role" : "Edit Role"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-description">Role description</Label>
            <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role area</Label>
            <RadioGroup value={family || "none"} onValueChange={(value) => setFamily(value === "none" ? "" : value as RoleFamily)}>
              {FAMILY_OPTIONS.map((option) => {
                const value = option.value || "none";
                return (
                  <Label
                    key={value}
                    htmlFor={`role-family-${value}`}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <RadioGroupItem id={`role-family-${value}`} value={value} aria-label={option.label} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">{option.description}</span>
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
