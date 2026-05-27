import { Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface HomeHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}

const SHIFT_SWITCH_HOUR = 12;

const greetForHour = (h: number) => {
  if (h < 12) return "อรุณสวัสดิ์";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
};

export default function HomeHeader({ title, subtitle, icon: Icon = Sparkles }: HomeHeaderProps) {
  const now = new Date();
  const dateText = now.toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const greet = greetForHour(now.getHours());
  const shift = now.getHours() < SHIFT_SWITCH_HOUR ? "กะเช้า" : "กะบ่าย";

  return (
    <div className="mb-6 flex flex-wrap items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
          {greet} · {title}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {dateText} · <span className="font-medium text-foreground/80">{shift}</span>
          {subtitle ? <> · {subtitle}</> : null}
        </p>
      </div>
    </div>
  );
}
