import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";
import { normalizeRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface UserProfileMenuProps {
  className?: string;
}

const getInitial = (name?: string, email?: string) =>
  (name?.trim().charAt(0) || email?.trim().charAt(0) || "U").toUpperCase();

const UserProfileMenu = ({ className }: UserProfileMenuProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  const displayName = user.name || user.email || "User";
  const roles = normalizeRoles(user);
  const roleLabel = roles.length > 0 ? roles.join(", ") : "No role";
  const assignment = [user.department, user.position].filter(Boolean).join(" / ") || "Unassigned";

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="User profile"
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-full border border-border bg-background hover:bg-accent transition-colors",
            className,
          )}
        >
          <Avatar className="size-8">
            {user.photoUrl ? <AvatarImage src={user.photoUrl} alt={displayName} /> : null}
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {user.photoUrl ? <User /> : getInitial(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center gap-3 border-b p-4">
          <Avatar className="size-10">
            {user.photoUrl ? <AvatarImage src={user.photoUrl} alt={displayName} /> : null}
            <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
              {user.photoUrl ? <User /> : getInitial(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="grid gap-2 p-4 text-xs">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Role</span>
            <span className="min-w-0 flex-1 truncate text-right font-medium text-foreground">{roleLabel}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Profile</span>
            <span className="min-w-0 flex-1 truncate text-right font-medium text-foreground">{assignment}</span>
          </div>
        </div>

        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut />
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UserProfileMenu;
