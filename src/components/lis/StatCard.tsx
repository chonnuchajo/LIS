import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  value: number;
  label: string;
  variant: "blue" | "amber" | "green" | "red";
}

const variantClasses = {
  blue: {
    bg: "bg-lis-stat-blue",
    icon: "bg-lis-stat-blue-icon",
  },
  amber: {
    bg: "bg-lis-stat-amber",
    icon: "bg-lis-stat-amber-icon",
  },
  green: {
    bg: "bg-lis-stat-green",
    icon: "bg-lis-stat-green-icon",
  },
  red: {
    bg: "bg-lis-stat-red",
    icon: "bg-lis-stat-red-icon",
  },
};

const StatCard = ({ icon: Icon, value, label, variant }: StatCardProps) => {
  const classes = variantClasses[variant];

  return (
    <div className={cn("flex items-center gap-4 rounded-xl p-5", classes.bg)}>
      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", classes.icon)}>
        <Icon className="w-6 h-6 text-primary-foreground" />
      </div>
      <div>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
};

export default StatCard;
