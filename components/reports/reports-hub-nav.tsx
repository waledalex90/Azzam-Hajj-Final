import Link from "next/link";
import { clsx } from "clsx";

const TABS = [
  { id: "monthly", label: "المصفوفة الشهرية" },
  { id: "range", label: "حضور الفترة" },
  { id: "contractors", label: "بيان المقاولين" },
  { id: "payroll", label: "كشف المسير" },
  { id: "workers", label: "بيانات العمال" },
] as const;

type Props = {
  active: string;
  /** روابط كاملة تحافظ على فلاتر كل تبويب */
  hrefs: Partial<Record<(typeof TABS)[number]["id"], string>>;
};

export function ReportsHubNav({ active, hrefs }: Props) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="أنواع التقارير">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={hrefs[t.id] ?? `/reports?tab=${t.id}`}
          className={clsx(
            "rounded-lg px-3 py-2 text-sm font-bold transition",
            active === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
