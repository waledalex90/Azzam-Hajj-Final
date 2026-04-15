import { Card } from "@/components/ui/card";

const rows = [
  {
    role: "مدير النظام",
    description: "تحكم كامل في جميع المكونات",
    workers: true,
    create: true,
    edit: true,
    attendance: true,
    approve: true,
    reports: true,
    users: true,
    transfers: true,
  },
  {
    role: "موارد بشرية",
    description: "إدارة بيانات العمال والمواقع",
    workers: true,
    create: true,
    edit: true,
    attendance: true,
    approve: false,
    reports: true,
    users: false,
    transfers: true,
  },
  {
    role: "مراقب فني",
    description: "تسجيل الحضور والجولات الميدانية",
    workers: true,
    create: false,
    edit: false,
    attendance: true,
    approve: false,
    reports: true,
    users: false,
    transfers: false,
  },
  {
    role: "مراقب ميداني",
    description: "اعتماد الحضور ومعالجة الحالات",
    workers: true,
    create: false,
    edit: true,
    attendance: false,
    approve: true,
    reports: false,
    users: false,
    transfers: false,
  },
];

function yesNo(value: boolean) {
  return value ? "✓" : "✗";
}

export default function RolesPage() {
  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">الأدوار والصلاحيات</h1>
        <p className="mt-1 text-sm text-slate-600">
          مصفوفة صلاحيات تشغيلية وفق أدوار النظام الجديدة (مراقب فني / مراقب ميداني).
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-right">الدور</th>
                <th className="px-3 py-2 text-right">الوصف</th>
                <th className="px-3 py-2 text-center">العمال</th>
                <th className="px-3 py-2 text-center">إضافة</th>
                <th className="px-3 py-2 text-center">تعديل</th>
                <th className="px-3 py-2 text-center">الحضور</th>
                <th className="px-3 py-2 text-center">الاعتماد</th>
                <th className="px-3 py-2 text-center">التقارير</th>
                <th className="px-3 py-2 text-center">المستخدمون</th>
                <th className="px-3 py-2 text-center">النقل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.role} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-bold">{row.role}</td>
                  <td className="px-3 py-2 text-slate-600">{row.description}</td>
                  <td className="px-3 py-2 text-center">{yesNo(row.workers)}</td>
                  <td className="px-3 py-2 text-center">{yesNo(row.create)}</td>
                  <td className="px-3 py-2 text-center">{yesNo(row.edit)}</td>
                  <td className="px-3 py-2 text-center">{yesNo(row.attendance)}</td>
                  <td className="px-3 py-2 text-center">{yesNo(row.approve)}</td>
                  <td className="px-3 py-2 text-center">{yesNo(row.reports)}</td>
                  <td className="px-3 py-2 text-center">{yesNo(row.users)}</td>
                  <td className="px-3 py-2 text-center">{yesNo(row.transfers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
