import { formatThaiDate } from "@/lib/dateShift";

interface Props {
  titleEn: string;
  subtitleTh: string;
}

export default function DashboardHeader({ titleEn }: Props) {
  const now = new Date();

  return (
    <div className="mb-4">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{titleEn}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatThaiDate(now)}
        </p>
      </div>
    </div>
  );
}
