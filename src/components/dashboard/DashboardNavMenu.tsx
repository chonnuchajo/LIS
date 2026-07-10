import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import type { NavItem } from "@/lib/navItems";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  items: NavItem[];
}

export default function DashboardNavMenu({ items }: Props) {
  const navigate = useNavigate();
  if (items.length === 0) return null;

  return (
    <nav aria-label="เมนูหน้าแรก">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Menu className="h-4 w-4" />
            เมนู
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.path}
                className="gap-2"
                onSelect={() => navigate(item.path)}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
