"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getContractorInvoiceViolationLinesAction,
  listReportsFilterOptionsAction,
  runReportsPreviewAction,
  type ReportsTab,
} from "@/app/(dashboard)/reports/actions";
import { getPayrollLockStateAction } from "@/app/(dashboard)/reports/payroll-actions";
import { SearchableSelect } from "@/components/filters/searchable-select";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ReportFilters } from "@/lib/reports/queries";
import type { PaginationMeta } from "@/lib/types/db";

import { HorizontalAttendanceMatrixTable } from "./horizontal-attendance-matrix";
import { MultiEntityPicker } from "./multi-entity-picker";
import { PayrollReportTable } from "./payroll-report-table";
import { PayrollReportToolbar } from "./payroll-report-toolbar";

function defaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

function buildFilters(
  dateFrom: string,
  dateTo: string,
  siteIds: number[],
  contractorIds: number[],
  supervisorIds: number[],
  shiftRound: "" | "1" | "2",
): ReportFilters {
  return {
    dateFrom,
    dateTo,
    siteIds: siteIds.length ? siteIds : null,
    contractorIds: contractorIds.length ? contractorIds : null,
    supervisorIds: supervisorIds.length ? supervisorIds : null,
    shiftRound: shiftRound === "1" ? 1 : shiftRound === "2" ? 2 : null,
  };
}

/** أول وآخر يوم في الشهر الميلادي (للمسير ومصفوفة الحضور). */
function monthDateBounds(year: number, month: number) {
  const d1 = new Date(year, month - 1, 1);
  const d2 = new Date(year, month, 0);
  return {
    dateFrom: d1.toISOString().slice(0, 10),
    dateTo: d2.toISOString().slice(0, 10),
  };
}

function buildExportQuery(
  tab: ReportsTab,
  filters: {
    dateFrom: string;
    dateTo: string;
    siteIds: number[];
    contractorIds: number[];
    supervisorIds: number[];
    shiftRound: "" | "1" | "2";
    year: number;
    month: number;
    attendanceStatus: string;
    violationStatus: string;
    workerStatus: string;
    workerQ: string;
    horizontalSite?: string;
    horizontalContractor?: string;
    horizontalShift?: "" | "1" | "2";
  },
): string {
  const p = new URLSearchParams();
  const reportKey: Record<ReportsTab, string> = {
    attendance_log: "attendance_log",
    matrix: "matrix",
    horizontal_report: "horizontal_report",
    payroll: "payroll",
    contractors: "contractors",
    violations: "violations",
    workers: "workers",
  };
  p.set("report", reportKey[tab]);

  if (tab === "horizontal_report") {
    p.set("year", String(filters.year));
    p.set("month", String(filters.month));
    if (filters.horizontalSite) p.set("sites", filters.horizontalSite);
    if (filters.horizontalContractor) p.set("contractors", filters.horizontalContractor);
    if (filters.horizontalShift) p.set("shiftRound", filters.horizontalShift);
    return p.toString();
  }

  if (tab !== "workers") {
    p.set("dateFrom", filters.dateFrom);
    p.set("dateTo", filters.dateTo);
  }
  if (filters.siteIds.length) p.set("sites", filters.siteIds.join(","));
  if (filters.contractorIds.length) p.set("contractors", filters.contractorIds.join(","));
  if (filters.supervisorIds.length) p.set("supervisors", filters.supervisorIds.join(","));
  if (filters.shiftRound) p.set("shiftRound", filters.shiftRound);
  if (tab === "matrix" || tab === "payroll") {
    p.set("year", String(filters.year));
    p.set("month", String(filters.month));
  }
  if (tab === "attendance_log") p.set("attendanceStatus", filters.attendanceStatus);
  if (tab === "violations") p.set("violationStatus", filters.violationStatus);
  if (tab === "workers") {
    p.set("workerStatus", filters.workerStatus);
    if (filters.workerQ.trim()) p.set("workerQ", filters.workerQ.trim());
  }
  return p.toString();
}

const TABS: { id: ReportsTab; label: string }[] = [
  { id: "attendance_log", label: "سجل الحضور" },
  { id: "matrix", label: "مصفوفة شهرية" },
  { id: "horizontal_report", label: "Horizontal Report" },
  { id: "payroll", label: "مسير الرواتب" },
  { id: "contractors", label: "مستخلص المقاولين" },
  { id: "violations", label: "المخالفات" },
  { id: "workers", label: "بيانات العاملين" },
];

export function ReportsHub() {
  const init = defaultDates();
  const [tab, setTab] = useState<ReportsTab>("attendance_log");
  const [dateFrom, setDateFrom] = useState(init.dateFrom);
  const [dateTo, setDateTo] = useState(init.dateTo);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [siteIds, setSiteIds] = useState<number[]>([]);
  const [contractorIds, setContractorIds] = useState<number[]>([]);
  const [supervisorIds, setSupervisorIds] = useState<number[]>([]);
  const [shiftRound, setShiftRound] = useState<"" | "1" | "2">("");
  const [attendanceStatus, setAttendanceStatus] = useState("all");
  const [violationStatus, setViolationStatus] = useState("all");
  const [workerStatus, setWorkerStatus] = useState("all");
  const [workerQ, setWorkerQ] = useState("");
  /** Horizontal Report: dropdown filters (موقع / مقاول / وردية) */
  const [horizontalSite, setHorizontalSite] = useState("");
  const [horizontalContractor, setHorizontalContractor] = useState("");
  const [horizontalShift, setHorizontalShift] = useState<"" | "1" | "2">("");
  const [filterLists, setFilterLists] = useState<{
    sites: { id: number; name: string }[];
    contractors: { id: number; name: string }[];
  }>({ sites: [], contractors: [] });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportPct, setExportPct] = useState<number | null>(null);
  const [exportLabel, setExportLabel] = useState<string | null>(null);
  const [payrollLocked, setPayrollLocked] = useState(false);
  const [payrollSearchInput, setPayrollSearchInput] = useState("");
  const [payrollSearch, setPayrollSearch] = useState("");
  const payrollSearchCommitted = useRef<string | null>(null);
  const prevTabRef = useRef<ReportsTab | null>(null);
  const [contractorViolationLines, setContractorViolationLines] = useState<
    Array<{
      contractor_id: number;
      contractor_name: string;
      worker_id: number;
      worker_name: string;
      violation_id: number;
      violation_type_name: string;
      deduction_sar: number;
      occurred_at: string;
      description: string | null;
    }>
  >([]);
  const [contractorViolationsLoading, setContractorViolationsLoading] = useState(false);

  /** عند الدخول لتبويب المسير: تعبئة فترة الاحتساب من الشهر/السنة الحاليين */
  useEffect(() => {
    if (tab === "payroll" && prevTabRef.current !== "payroll") {
      const b = monthDateBounds(year, month);
      setDateFrom(b.dateFrom);
      setDateTo(b.dateTo);
    }
    prevTabRef.current = tab;
  }, [tab, year, month]);

  const filters = useMemo((): ReportFilters => {
    if (tab === "horizontal_report") {
      const s = horizontalSite === "" ? [] : [Number(horizontalSite)];
      const c = horizontalContractor === "" ? [] : [Number(horizontalContractor)];
      return buildFilters(dateFrom, dateTo, s, c, [], horizontalShift);
    }
    if (tab === "payroll") {
      return buildFilters(dateFrom, dateTo, siteIds, contractorIds, supervisorIds, shiftRound);
    }
    return buildFilters(dateFrom, dateTo, siteIds, contractorIds, supervisorIds, shiftRound);
  }, [
    tab,
    dateFrom,
    dateTo,
    year,
    month,
    siteIds,
    contractorIds,
    supervisorIds,
    shiftRound,
    horizontalSite,
    horizontalContractor,
    horizontalShift,
  ]);

  useEffect(() => {
    if (tab !== "contractors") {
      setContractorViolationLines([]);
      return;
    }
    let cancelled = false;
    setContractorViolationsLoading(true);
    void getContractorInvoiceViolationLinesAction(filters)
      .then((lines) => {
        if (!cancelled) setContractorViolationLines(lines);
      })
      .catch(() => {
        if (!cancelled) setContractorViolationLines([]);
      })
      .finally(() => {
        if (!cancelled) setContractorViolationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, filters]);

  useEffect(() => {
    let cancelled = false;
    listReportsFilterOptionsAction()
      .then((d) => {
        if (!cancelled) setFilterLists(d);
      })
      .catch(() => {
        if (!cancelled) setFilterLists({ sites: [], contractors: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runReportsPreviewAction({
        tab,
        page,
        filters,
        year,
        month,
        attendanceStatus: tab === "attendance_log" ? attendanceStatus : null,
        violationStatus: tab === "violations" ? violationStatus : null,
        workerStatus: tab === "workers" ? workerStatus : undefined,
        workerQ: tab === "workers" ? workerQ : undefined,
        payrollSearch: tab === "payroll" ? payrollSearch : undefined,
      });
      setRows(res.rows as Record<string, unknown>[]);
      setMeta(res.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التحميل");
      setRows([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    page,
    filters,
    year,
    month,
    attendanceStatus,
    violationStatus,
    workerStatus,
    workerQ,
    payrollSearch,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (tab !== "payroll") return;
    let cancelled = false;
    void (async () => {
      try {
        const locked = await getPayrollLockStateAction(filters);
        if (!cancelled) setPayrollLocked(locked);
      } catch {
        if (!cancelled) setPayrollLocked(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, filters]);

  useEffect(() => {
    if (tab !== "payroll") {
      setPayrollSearchInput("");
      setPayrollSearch("");
      payrollSearchCommitted.current = null;
    }
  }, [tab]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const q = payrollSearchInput.trim();
      setPayrollSearch(q);
      if (payrollSearchCommitted.current !== q) {
        payrollSearchCommitted.current = q;
        setPage(1);
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [payrollSearchInput]);

  const columns = useMemo(() => {
    if (!rows.length) return [] as { key: string; label: string }[];
    const keys = Object.keys(rows[0]).filter((k) => k !== "total_count" && k !== "total_workers");
    const labels: Record<string, string> = {
      worker_id: "العامل",
      work_date: "التاريخ",
      worker_name: "الاسم",
      id_number: "الهوية",
      site_name: "الموقع",
      contractor_name: "المقاول",
      supervisor_name: "المشرف",
      final_status: "الحالة",
      payment_type: "نوع الراتب",
      daily_rate_sar: "يومي/أساس",
      monthly_basis_sar: "شهري",
      paid_day_equivalent: "أيام",
      gross_sar: "المستحق",
      deductions_sar: "الخصومات",
      net_sar: "الصافي",
      contractor_id: "مقاول",
      workers_count: "عدد العمال",
      paid_day_equivalent_sum: "مجموع الأيام",
      violation_type_name: "نوع المخالفة",
      deduction_this_sar: "خصم السجل",
      period_gross_sar: "مستحق الفترة",
      period_deductions_sar: "خصومات الفترة",
      period_net_sar: "صافي الفترة",
      job_title: "المسمى",
      basic_salary: "الراتب",
      shift_round: "الوردية",
      iqama_expiry: "انتهاء الإقامة",
      is_active: "نشط",
      is_deleted: "محذوف",
      occurred_at: "وقت الحدث",
      status: "حالة المخالفة",
      description: "الوصف",
      worker_id_number: "رقم الهوية",
    };
    return keys.map((key) => ({
      key,
      label: labels[key] ?? key,
    }));
  }, [rows]);

  const matrixDayCols = useMemo(() => {
    if (tab !== "matrix" || !rows.length) return [] as string[];
    return Object.keys(rows[0]).filter((k) => /^d\d{2}$/.test(k));
  }, [tab, rows]);

  const exportQuery = useMemo(
    () =>
      buildExportQuery(tab, {
        dateFrom,
        dateTo,
        siteIds,
        contractorIds,
        supervisorIds,
        shiftRound,
        year,
        month,
        attendanceStatus,
        violationStatus,
        workerStatus,
        workerQ,
        horizontalSite,
        horizontalContractor,
        horizontalShift,
      }),
    [
      tab,
      dateFrom,
      dateTo,
      siteIds,
      contractorIds,
      supervisorIds,
      shiftRound,
      year,
      month,
      attendanceStatus,
      violationStatus,
      workerStatus,
      workerQ,
      horizontalSite,
      horizontalContractor,
      horizontalShift,
    ],
  );

  async function handleExportCsv() {
    setExportPct(0);
    setExportLabel("جاري تقدير حجم الملف…");
    try {
      const es = await fetch(`/api/reports/estimate?${exportQuery}`);
      if (!es.ok) {
        const j = await es.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "تعذر التقدير");
      }
      const { total } = (await es.json()) as { total: number };
      setExportLabel(`جاري التصدير… 0 من ${total} سجل`);
      const res = await fetch(`/api/reports/export?${exportQuery}`);
      if (!res.ok) throw new Error("فشل التصدير");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("لا دفق");
      const dec = new TextDecoder();
      const chunks: BlobPart[] = [];
      let newlines = 0;
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          buf += dec.decode(value, { stream: true });
          const sp = buf.split("\n");
          buf = sp.pop() ?? "";
          for (const _ of sp) newlines += 1;
          const dataRows = Math.max(0, newlines - 2);
          const pct = total > 0 ? Math.min(100, Math.round((dataRows / total) * 100)) : 0;
          setExportPct(pct);
          setExportLabel(`جاري تجهيز ${Math.min(dataRows, total)} من ${total} سجل`);
        }
      }
      const blob = new Blob(chunks, { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${tab}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportPct(100);
      setExportLabel("اكتمل التصدير");
    } catch (e) {
      setExportLabel(e instanceof Error ? e.message : "خطأ");
      setExportPct(null);
    } finally {
      setTimeout(() => {
        setExportPct(null);
        setExportLabel(null);
      }, 4000);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h1 className="text-lg font-extrabold text-slate-900">محرك التقارير</h1>
        <p className="text-sm text-slate-600">
          فلاتر متعددة من الخادم؛ معاينة على دفعات (حتى 1000 صف لمسير الرواتب)، وتصدير CSV كامل من السيرفر.
          {tab === "payroll" && (
            <span className="mt-1 block text-emerald-900">
              مسير الرواتب: حدّد فترة الاحتساب من/إلى يدوياً أو استخدم «ملء الفترة من الشهر والسنة». البحث على السيرفر
              (اسم / إقامة / معرف)؛ تصدير Excel / PDF مع شعار من public/company-logo.png عند وجوده.
            </span>
          )}
          {tab === "contractors" && (
            <span className="mt-1 block text-emerald-900">
              مستخلص المقاولين: عمود الخصومات يجمع خصومات المخالفات المعتمدة لعمال المقاول في الفترة (من إشعارات
              المخالفة بعد الاعتماد). أسفل الصفحة: تفصيل كل سجل خصم.
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${
                tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {tab === "horizontal_report" ? (
        <Card className="space-y-4 p-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-slate-900">Horizontal Report</h2>
            <p className="mt-1 text-xs text-slate-600">
              مصفوفة حضور أفقية: صفوف الموظفين وأعمدة أيام الشهر (P / A / H). اختر السنة والشهر والموقع
              والمقاول من القوائم ثم تطبيق الفلاتر.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700" htmlFor="hr-year">
                السنة
              </label>
              <select
                id="hr-year"
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700" htmlFor="hr-month">
                الشهر
              </label>
              <select
                id="hr-month"
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {[
                  "يناير",
                  "فبراير",
                  "مارس",
                  "أبريل",
                  "مايو",
                  "يونيو",
                  "يوليو",
                  "أغسطس",
                  "سبتمبر",
                  "أكتوبر",
                  "نوفمبر",
                  "ديسمبر",
                ].map((name, i) => (
                  <option key={name} value={i + 1}>
                    {i + 1} — {name}
                  </option>
                ))}
              </select>
            </div>
            <SearchableSelect
              label="الموقع"
              value={horizontalSite}
              onChange={setHorizontalSite}
              options={filterLists.sites.map((s) => ({ id: String(s.id), label: s.name }))}
              emptyLabel="كل المواقع"
            />
            <SearchableSelect
              label="المقاول"
              value={horizontalContractor}
              onChange={setHorizontalContractor}
              options={filterLists.contractors.map((c) => ({ id: String(c.id), label: c.name }))}
              emptyLabel="كل المقاولين"
            />
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700" htmlFor="hr-shift">
                الوردية
              </label>
              <select
                id="hr-shift"
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                value={horizontalShift}
                onChange={(e) => setHorizontalShift(e.target.value as "" | "1" | "2")}
              >
                <option value="">كل الورديات</option>
                <option value="1">صباحي</option>
                <option value="2">مسائي</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
              onClick={() => {
                setPage(1);
                void refresh();
              }}
            >
              تطبيق الفلاتر
            </button>
            <button
              type="button"
              className="rounded-lg border border-emerald-700 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-900"
              onClick={() => void handleExportCsv()}
            >
              تصدير CSV كامل
            </button>
            <span className="text-[11px] text-slate-500">
              المعاينة صفحات من الخادم (≤50 موظف/صفحة)؛ التصدير على دفعات حتى 1000 سطر.
            </span>
          </div>
        </Card>
      ) : (
      <Card className="flex flex-wrap items-end gap-3 p-4">
        {tab !== "workers" && (
          <>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">
                {tab === "payroll" ? "فترة الاحتساب — من" : "من تاريخ"}
              </p>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">
                {tab === "payroll" ? "فترة الاحتساب — إلى" : "إلى تاريخ"}
              </p>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </>
        )}
        {(tab === "matrix" || tab === "payroll") && (
          <>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">السنة (مرجع العرض)</p>
              <Input
                type="number"
                min={2024}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">الشهر (مرجع العرض)</p>
              <Input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              />
            </div>
            {tab === "payroll" && (
              <div className="flex items-end">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                  onClick={() => {
                    const b = monthDateBounds(year, month);
                    setDateFrom(b.dateFrom);
                    setDateTo(b.dateTo);
                  }}
                >
                  ملء الفترة من الشهر والسنة
                </button>
              </div>
            )}
          </>
        )}
        <MultiEntityPicker kind="site" label="المواقع (متعدد)" selectedIds={siteIds} onChange={setSiteIds} />
        <MultiEntityPicker
          kind="contractor"
          label="المقاولون (متعدد)"
          selectedIds={contractorIds}
          onChange={setContractorIds}
        />
        <MultiEntityPicker
          kind="supervisor"
          label="المشرفون (متعدد)"
          selectedIds={supervisorIds}
          onChange={setSupervisorIds}
        />
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-700">الوردية</p>
          <select
            className="min-h-10 w-full rounded-lg border border-slate-200 px-2 text-sm"
            value={shiftRound}
            onChange={(e) => setShiftRound(e.target.value as "" | "1" | "2")}
          >
            <option value="">كل الورديات</option>
            <option value="1">صباحي</option>
            <option value="2">مسائي</option>
          </select>
        </div>
        {tab === "attendance_log" && (
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-700">حالة الحضور</p>
            <select
              className="min-h-10 w-full rounded-lg border border-slate-200 px-2 text-sm"
              value={attendanceStatus}
              onChange={(e) => setAttendanceStatus(e.target.value)}
            >
              <option value="all">الكل</option>
              <option value="present">حاضر</option>
              <option value="absent">غائب</option>
              <option value="half">نصف يوم</option>
            </select>
          </div>
        )}
        {tab === "violations" && (
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-700">حالة المخالفة</p>
            <select
              className="min-h-10 w-full rounded-lg border border-slate-200 px-2 text-sm"
              value={violationStatus}
              onChange={(e) => setViolationStatus(e.target.value)}
            >
              <option value="all">الكل</option>
              <option value="pending_review">بانتظار المراجعة</option>
              <option value="needs_more_info">معلومات إضافية</option>
              <option value="approved">معتمد</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>
        )}
        {tab === "workers" && (
          <>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">حالة العامل</p>
              <select
                className="min-h-10 w-full rounded-lg border border-slate-200 px-2 text-sm"
                value={workerStatus}
                onChange={(e) => setWorkerStatus(e.target.value)}
              >
                <option value="all">الكل</option>
                <option value="active">نشط فقط</option>
                <option value="inactive">غير نشط / موقوف</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs font-bold text-slate-700">بحث عامل (خادم)</p>
              <Input value={workerQ} onChange={(e) => setWorkerQ(e.target.value)} placeholder="اسم أو هوية" />
            </div>
          </>
        )}
        <div className="flex items-end gap-2 md:col-span-2 lg:col-span-3">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            onClick={() => {
              setPage(1);
              void refresh();
            }}
          >
            تطبيق الفلاتر
          </button>
          <button
            type="button"
            className="rounded-lg border border-emerald-700 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900"
            onClick={() => void handleExportCsv()}
          >
            تصدير CSV كامل
          </button>
        </div>
      </Card>
      )}

      {exportLabel && (
        <Card className="p-3">
          <p className="text-sm font-bold text-slate-800">{exportLabel}</p>
          {exportPct !== null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${exportPct}%` }}
              />
            </div>
          )}
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        {loading && <div className="p-4 text-sm text-slate-500">جاري تحميل المعاينة…</div>}
        {!loading && rows.length === 0 && tab !== "payroll" && (
          <div className="p-4 text-center text-sm text-slate-500">لا بيانات للمعاينة.</div>
        )}
        {!loading && rows.length > 0 && tab === "horizontal_report" && (
          <div className="p-3">
            <HorizontalAttendanceMatrixTable rows={rows} year={year} month={month} />
          </div>
        )}
        {!loading && tab === "payroll" && (
          <div className="space-y-2 p-2 sm:p-3">
            <PayrollReportToolbar
              filters={filters}
              dateFrom={dateFrom}
              dateTo={dateTo}
              year={year}
              month={month}
              locked={payrollLocked}
              onAfterMutation={() => {
                void refresh();
                void (async () => {
                  try {
                    setPayrollLocked(await getPayrollLockStateAction(filters));
                  } catch {
                    setPayrollLocked(false);
                  }
                })();
              }}
            />
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
              <Input
                type="search"
                placeholder="بحث: الاسم أو الإقامة أو المعرف (كل السجلات)…"
                value={payrollSearchInput}
                onChange={(e) => setPayrollSearchInput(e.target.value)}
                className="min-h-9 min-w-[12rem] max-w-xl flex-1"
                autoComplete="off"
              />
              <button
                type="button"
                className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                onClick={() => void refresh()}
              >
                تحديث الجدول
              </button>
              {payrollSearch.trim() ? (
                <span className="text-[11px] text-slate-600">
                  {meta?.totalRows ?? rows.length} سجل مطابق للبحث (على السيرفر)
                </span>
              ) : null}
            </div>
            {rows.length > 0 ? (
              <div className="max-h-[min(78vh,920px)] overflow-auto rounded-lg border border-slate-100">
                <PayrollReportTable
                  rows={rows}
                  periodStart={dateFrom}
                  periodEnd={dateTo}
                  filter={{
                    siteIds: filters.siteIds,
                    contractorIds: filters.contractorIds,
                    supervisorIds: filters.supervisorIds,
                  }}
                  locked={payrollLocked}
                  onSaved={() => void refresh()}
                />
              </div>
            ) : (
              <p className="text-center text-sm text-slate-500">لا بيانات للمعاينة.</p>
            )}
          </div>
        )}
        {!loading && rows.length > 0 && tab !== "horizontal_report" && tab !== "payroll" && (
          <div className="max-h-[480px] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  {tab === "matrix"
                    ? (
                        <>
                          <th className="px-2 py-2 text-right">العامل</th>
                          {matrixDayCols.map((d) => (
                            <th key={d} className="px-1 py-2 text-center">
                              {d.replace("d", "")}
                            </th>
                          ))}
                          <th className="px-2 py-2">حضور</th>
                          <th className="px-2 py-2">نصف أيام</th>
                          <th className="px-2 py-2">غياب</th>
                          <th className="px-2 py-2">إجمالي أيام العمل</th>
                        </>
                      )
                    : (
                        columns.map((c) => (
                          <th key={c.key} className="px-2 py-2 text-right">
                            {c.label}
                          </th>
                        ))
                      )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-200">
                    {tab === "matrix"
                      ? (
                          <>
                            <td className="px-2 py-1 text-right">
                              <div className="font-bold">{String(row.worker_name ?? "")}</div>
                              <div className="text-[10px] text-slate-500">
                                {String(row.id_number ?? "")}
                              </div>
                              {row.contractor_name ? (
                                <div className="text-[10px] text-slate-500">
                                  {String(row.contractor_name)}
                                </div>
                              ) : null}
                            </td>
                            {matrixDayCols.map((d) => (
                              <td key={d} className="px-1 py-1 text-center">
                                {String(row[d] ?? "-")}
                              </td>
                            ))}
                            <td className="px-2 py-1 text-center">{String(row.present_days ?? "")}</td>
                            <td className="px-2 py-1 text-center">{String(row.half_days ?? "")}</td>
                            <td className="px-2 py-1 text-center">{String(row.absent_days ?? "")}</td>
                            <td className="px-2 py-1 text-center font-bold text-emerald-900">
                              {String(row.attendance_day_equivalent ?? "")}
                            </td>
                          </>
                        )
                      : (
                          columns.map((c) => (
                            <td key={c.key} className="px-2 py-1 text-slate-700">
                              {row[c.key] === null || row[c.key] === undefined
                                ? ""
                                : String(row[c.key])}
                            </td>
                          ))
                        )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 p-2 text-sm">
            <span className="text-slate-600">
              صفحة {meta.page} من {meta.totalPages} — {meta.totalRows} سجل
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-1 font-bold disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                السابق
              </button>
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-1 font-bold disabled:opacity-40"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </Card>

      {tab === "contractors" && (
        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-extrabold text-slate-900">تفاصيل خصومات المخالفات (معتمدة ضمن الفترة)</h2>
          <p className="text-xs text-slate-600">
            مجموع الأسطر أدناه يطابق عمود «الخصومات» في الجدول أعلاه بعد اعتماد المخالفات. المخالفات قيد المراجعة لا
            تُحسب حتى تُعتمد.
          </p>
          {contractorViolationsLoading ? (
            <p className="text-sm text-slate-500">جاري تحميل التفاصيل…</p>
          ) : contractorViolationLines.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد مخالفات معتمدة في هذه الفترة ضمن الفلاتر.</p>
          ) : (
            <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="px-2 py-2 text-right">المقاول</th>
                    <th className="px-2 py-2 text-right">الموظف</th>
                    <th className="px-2 py-2 text-right">نوع المخالفة</th>
                    <th className="px-2 py-2 text-left">الخصم</th>
                    <th className="px-2 py-2 text-right">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {contractorViolationLines.map((v) => (
                    <tr key={v.violation_id} className="border-t border-slate-200">
                      <td className="px-2 py-1 text-right">{v.contractor_name}</td>
                      <td className="px-2 py-1 text-right">{v.worker_name}</td>
                      <td className="px-2 py-1 text-right">{v.violation_type_name}</td>
                      <td className="px-2 py-1 text-left font-mono tabular-nums">
                        {Number(v.deduction_sar).toLocaleString("en-GB", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">
                        {v.occurred_at ? String(v.occurred_at).slice(0, 16).replace("T", " ") : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                    <td colSpan={3} className="px-2 py-2 text-right">
                      الإجمالي
                    </td>
                    <td className="px-2 py-2 text-left font-mono">
                      {contractorViolationLines
                        .reduce((s, x) => s + Number(x.deduction_sar), 0)
                        .toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
