import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";

type Props = {
  params: Promise<{ section: string }>;
};

const SECTION_LABELS: Record<string, string> = {
  workers: "الموظفين",
  sites: "المواقع",
  contractors: "المقاولين",
  approval: "اعتماد الحضور",
  transfers: "نقل الموظفين",
  reports: "التقارير",
  corrections: "طلبات التعديل",
  users: "المستخدمين",
  roles: "الأدوار والصلاحيات",
};

export default async function PlaceholderSectionPage({ params }: Props) {
  const { section } = await params;
  const label = SECTION_LABELS[section];
  if (!label) notFound();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-900">{label}</h1>
      <Card>
        <p className="text-sm text-slate-600">
          تم تجهيز الهيكل العام لهذا القسم ضمن لوحة المدير. سيتم استكمال وظائفه التفصيلية في المرحلة التالية.
        </p>
      </Card>
    </section>
  );
}
