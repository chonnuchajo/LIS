import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

interface DirectoryEntry {
  employeeId: string;
  name: string;
  department: string;
  position: string;
  email?: string;
}

/**
 * Blocking gate that forces a logged-in user to link themselves to an HR
 * employee record when auto-link by email found no match (empty employeeId).
 *
 * Order of operations: the Microsoft login sync (POST /users/microsoft) already
 * auto-links by email when possible. This gate only appears when that left
 * employeeId empty — the user must then pick their own record from the live
 * directory (no free text; selection is constrained to real employees).
 *
 * Admins are exempt: they manage links in AccessControl and an IT/system account
 * (e.g. itadmin) may have no employee record at all, so blocking them would lock
 * them out. In dev mode the synthetic user always has a DEV-* employeeId, so the
 * gate never triggers there.
 */
const EmployeeLinkGate = () => {
  const { user, linkSelfEmployee } = useAuth();

  const isAdmin = (user?.roles ?? (user?.role ? [user.role] : [])).includes("admin");
  const needsLink = !!user?.id && !user.employeeId && !isAdmin;

  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!needsLink) return;
    let active = true;
    api
      .get<DirectoryEntry[]>("/employees/directory")
      .then((res) => active && setDirectory(res.data.data))
      .catch(() => active && setDirectory([]));
    return () => {
      active = false;
    };
  }, [needsLink]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q
      ? directory.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.employeeId.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q),
        )
      : directory;
    return { items: matched.slice(0, 50), total: matched.length };
  }, [directory, search]);

  if (!needsLink) return null;

  const pick = async (entry: DirectoryEntry) => {
    if (saving) return;
    setSaving(true);
    try {
      await linkSelfEmployee(entry.employeeId);
      toast.success(`ผูกกับ ${entry.name} (${entry.employeeId}) แล้ว`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(
        /already linked/i.test(message)
          ? "รหัสพนักงานนี้ถูกผูกกับผู้ใช้อื่นแล้ว"
          : "ผูกพนักงานไม่สำเร็จ ลองใหม่อีกครั้ง",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-6 shadow-lg">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">ยืนยันรหัสพนักงานของคุณ</h2>
          <p className="text-sm text-muted-foreground">
            ระบบยังไม่พบรหัสพนักงานของบัญชี{" "}
            <span className="font-medium">{user?.email}</span> กรุณาเลือกชื่อของคุณจากรายชื่อ
            เพื่อผูกบัญชีเข้ากับข้อมูลพนักงานก่อนใช้งานระบบ
          </p>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ, รหัสพนักงาน, แผนก..."
          autoFocus
        />

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1">
          {filtered.items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {directory.length === 0 ? "กำลังโหลดรายชื่อพนักงาน..." : "ไม่พบพนักงาน"}
            </p>
          ) : (
            filtered.items.map((entry) => (
              <button
                key={entry.employeeId}
                type="button"
                disabled={saving}
                onClick={() => pick(entry)}
                className="w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
              >
                <span className="font-medium">{entry.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  ({entry.employeeId}) · {entry.department} · {entry.position}
                </span>
              </button>
            ))
          )}
        </div>

        {filtered.total > filtered.items.length && (
          <p className="text-xs text-muted-foreground">
            แสดง {filtered.items.length} จาก {filtered.total} รายการ — พิมพ์เพื่อค้นหา
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          ไม่พบชื่อของคุณ? ติดต่อผู้ดูแลระบบเพื่อผูกรหัสพนักงานให้
        </p>
      </div>
    </div>
  );
};

export default EmployeeLinkGate;
