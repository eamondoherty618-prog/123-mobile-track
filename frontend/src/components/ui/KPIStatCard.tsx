import { KPIStat } from "@/types";
import { SectionCard } from "./SectionCard";

const dotColor = {
  green: "bg-green-500",
  navy: "bg-brand-navy",
  amber: "bg-amber-400",
  red: "bg-red-500",
};

export function KPIStatCard({ stat }: { stat: KPIStat }) {
  return (
    <SectionCard className="flex items-center gap-3 px-4 py-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor[stat.tone]}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-500">{stat.label}</p>
        <p className="mt-0.5 truncate text-base font-bold text-brand-ink">{stat.value}</p>
      </div>
    </SectionCard>
  );
}
