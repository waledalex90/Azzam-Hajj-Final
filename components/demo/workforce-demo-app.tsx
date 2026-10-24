"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  FileBarChart2,
  Home,
  MapPin,
  Users,
} from "lucide-react";

import { BrandLogo } from "@/components/branding/brand-logo";
import { Card } from "@/components/ui/card";
import { createDemoWorkers, DEMO_STATS, type DemoWorker } from "@/lib/demo/mock-workforce";
import { PRODUCT_NAME, PRODUCT_TAGLINE_AR } from "@/lib/product";

type Tab = "dashboard" | "workers" | "prep" | "review" | "reports";

const NAV: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "الرئيسية", icon: Home },
  { id: "workers", label: "الموظفون", icon: Users },
  { id: "prep", label: "تحضير الحضور", icon: ClipboardList },
  { id: "review", label: "المراجعة والاعتماد", icon: BadgeCheck },
  { id: "reports", label: "التقارير", icon: FileBarChart2 },
];

export function WorkforceDemoApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [workers, setWorkers] = useState<DemoWorker[]>(() => createDemoWorkers());
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const pending = workers.filter((w) => w.status === "pending");
  const present = workers.filter((w) => w.status === "present").length;
  const absent = workers.filter((w) => w.status === "absent").length;
  const reviewQueue = workers.filter((w) => w.review === "pending");

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2200);
  }

  function markStatus(ids: number[], status: "present" | "absent") {
    setWorkers((prev) =>
      prev.map((w) =>
        ids.includes(w.id) ? { ...w, status, review: "pending" } : w,
      ),
    );
    setSelected(new Set());
    flash(status === "present" ? "تم تسجيل الحضور في نسخة العرض فقط" : "تم تسجيل الغياب في نسخة العرض فقط");
  }

  function approve(id: number, ok: boolean) {
    setWorkers((prev) =>
      prev.map((w) => (w.id === id ? { ...w, review: ok ? "confirmed" : "rejected" } : w)),
    );
    flash(ok ? "تم الاعتماد تجريبياً" : "تم الرفض تجريبياً");
  }

  const reportRows = useMemo(
    () =>
      workers.map((w) => ({
        ...w,
        result: w.status === "present" ? "حاضر" : w.status === "absent" ? "غائب" : "معلّق",
      })),
    [workers],
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0B1730] lg:flex">
      <aside className="hidden w-[260px] shrink-0 border-l border-slate-200 bg-white lg:block">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4">
          <BrandLogo preset="topNav" />
          <div>
            <p className="text-sm font-extrabold">{PRODUCT_NAME}</p>
            <p className="text-[11px] text-slate-500">نسخة عرض Demo</p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${
                  active ? "bg-[#0B1730] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-[#0B1730] px-4 py-3 text-white">
          <p className="text-sm font-extrabold">{PRODUCT_NAME}</p>
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-amber-950">Demo</span>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 lg:hidden">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${
                tab === item.id ? "bg-[#0B1730] text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <main className="mx-auto max-w-[1200px] space-y-4 p-4 lg:p-6">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
            نسخة عرض مستقلة — بيانات افتراضية بالكامل، بلا اتصال ببيانات التشغيل، والتعديلات لا تُحفظ.
          </div>
          {notice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900">
              {notice}
            </div>
          ) : null}

          {tab === "dashboard" ? (
            <section className="space-y-4">
              <div>
                <h1 className="text-2xl font-extrabold">الرئيسية</h1>
                <p className="mt-1 text-sm text-slate-500">{PRODUCT_TAGLINE_AR}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat icon={MapPin} value={DEMO_STATS.sites} label="المواقع" color="text-blue-600 bg-blue-50" />
                <Stat icon={Users} value={DEMO_STATS.activeWorkers} label="العمال النشطون" color="text-emerald-600 bg-emerald-50" />
                <Stat icon={Building2} value={DEMO_STATS.contractors} label="المقاولون" color="text-cyan-700 bg-cyan-50" />
                <Stat icon={ClipboardList} value={`${present}/${workers.length}`} label="حضور اليوم" color="text-indigo-600 bg-indigo-50" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="text-center">
                  <p className="text-xs text-slate-500">حاضر</p>
                  <p className="mt-1 text-2xl font-extrabold text-emerald-700">{present}</p>
                </Card>
                <Card className="text-center">
                  <p className="text-xs text-slate-500">غائب</p>
                  <p className="mt-1 text-2xl font-extrabold text-red-700">{absent}</p>
                </Card>
                <Card className="text-center">
                  <p className="text-xs text-slate-500">معلّق التحضير</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-700">{pending.length}</p>
                </Card>
              </div>
            </section>
          ) : null}

          {tab === "workers" ? (
            <section className="space-y-3">
              <h1 className="text-2xl font-extrabold">الموظفون</h1>
              <DemoTable
                rows={workers}
                columns={["الاسم", "الكود", "الموقع", "المقاول", "الوردية"]}
                render={(w) => [w.name, w.employee_code, w.site, w.contractor, w.shift]}
              />
            </section>
          ) : null}

          {tab === "prep" ? (
            <section className="space-y-3">
              <h1 className="text-2xl font-extrabold">تحضير الحضور</h1>
              <p className="text-sm text-slate-600">المعلّقون فقط — التحديد الجماعي يعمل على البيانات الافتراضية.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                  disabled={selected.size === 0}
                  onClick={() => markStatus(Array.from(selected), "present")}
                >
                  تحضير المحدد كـ حاضر
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                  disabled={selected.size === 0}
                  onClick={() => markStatus(Array.from(selected), "absent")}
                >
                  تحضير المحدد كـ غائب
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-right">
                        <input
                          type="checkbox"
                          checked={pending.length > 0 && pending.every((w) => selected.has(w.id))}
                          onChange={() =>
                            setSelected((prev) => {
                              if (pending.every((w) => prev.has(w.id))) return new Set();
                              return new Set(pending.map((w) => w.id));
                            })
                          }
                        />
                      </th>
                      <th className="p-2 text-right">الاسم</th>
                      <th className="p-2 text-right">الموقع</th>
                      <th className="p-2 text-right">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((w) => (
                      <tr key={w.id} className="border-t border-slate-100">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selected.has(w.id)}
                            onChange={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(w.id)) next.delete(w.id);
                                else next.add(w.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="p-2 font-bold">{w.name}</td>
                        <td className="p-2">{w.site}</td>
                        <td className="space-x-1 space-x-reverse p-2">
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-bold text-white"
                            onClick={() => markStatus([w.id], "present")}
                          >
                            حاضر
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-red-700 px-2 py-1 text-xs font-bold text-white"
                            onClick={() => markStatus([w.id], "absent")}
                          >
                            غائب
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pending.length === 0 ? (
                  <p className="p-6 text-center text-sm font-bold text-emerald-800">لا يوجد معلّقون للتحضير</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {tab === "review" ? (
            <section className="space-y-3">
              <h1 className="text-2xl font-extrabold">المراجعة والاعتماد</h1>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-right">الاسم</th>
                      <th className="p-2 text-right">الحالة</th>
                      <th className="p-2 text-right">الاعتماد</th>
                      <th className="p-2 text-right">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewQueue.map((w) => (
                      <tr key={w.id} className="border-t border-slate-100">
                        <td className="p-2 font-bold">{w.name}</td>
                        <td className="p-2">{w.status === "present" ? "حاضر" : "غائب"}</td>
                        <td className="p-2">بانتظار الاعتماد</td>
                        <td className="space-x-1 space-x-reverse p-2">
                          <button
                            type="button"
                            className="rounded-lg bg-[#0B1730] px-2 py-1 text-xs font-bold text-white"
                            onClick={() => approve(w.id, true)}
                          >
                            اعتماد
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold"
                            onClick={() => approve(w.id, false)}
                          >
                            رفض
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reviewQueue.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500">لا توجد سجلات معلّقة للاعتماد</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {tab === "reports" ? (
            <section className="space-y-3">
              <h1 className="text-2xl font-extrabold">تقرير الحضور التجريبي</h1>
              <DemoTable
                rows={reportRows}
                columns={["الاسم", "الموقع", "النتيجة", "الاعتماد"]}
                render={(w) => [
                  w.name,
                  w.site,
                  w.result,
                  w.review === "confirmed" ? "معتمد" : w.review === "rejected" ? "مرفوض" : w.review === "pending" ? "معلّق" : "—",
                ]}
              />
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Home;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <Card className="text-center">
      <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </Card>
  );
}

function DemoTable<T extends { id: number }>({
  rows,
  columns,
  render,
}: {
  rows: T[];
  columns: string[];
  render: (row: T) => Array<string | number>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            {columns.map((c) => (
              <th key={c} className="p-2 text-right font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              {render(row).map((cell, i) => (
                <td key={i} className="p-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
