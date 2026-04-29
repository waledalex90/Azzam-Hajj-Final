"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

import { revalidateAttendancePageCache } from "@/app/(dashboard)/attendance/actions";
import { SearchableSelect } from "@/components/filters/searchable-select";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { attendancePrepShiftToQuery, type PrepShiftScope } from "@/lib/utils/attendance-shift";

function buildQuery(base: {
  tab: string;
  date: string;
  shift: string;
  siteId?: string;
  contractorId?: string;
  includeContractor: boolean;
}) {
  const p = new URLSearchParams();
  p.set("tab", base.tab);
  if (base.date.trim() !== "") p.set("date", base.date);
  p.set("shift", base.shift);
  if (base.siteId) p.set("siteId", base.siteId);
  if (base.includeContractor && base.contractorId) p.set("contractorId", base.contractorId);
  return p.toString();
}

export function AttendanceFilterToolbar(props: {
  basePath: "/attendance" | "/approval";
  tab: string;
  workDate: string;
  prepShiftScope: PrepShiftScope;
  /** إخفاء «كل الورديات» عند false؛ في الاعتماد تُعرَض فقط لمن لديه صلاحية مدير النظام (`*`) */
  showAllShiftsOption?: boolean;
  siteId?: string;
  contractorId?: string;
  sites: { id: number; name: string }[];
  contractors: { id: number; name: string }[];
  showContractor: boolean;
}) {
  const router = useRouter();
  const [isNavPending, startTransition] = useTransition();
  const {
    basePath,
    tab,
    workDate,
    prepShiftScope,
    showAllShiftsOption = true,
    siteId,
    contractorId,
    sites,
    contractors,
    showContractor,
  } = props;

  const defaultShiftInUrl = attendancePrepShiftToQuery(prepShiftScope);

  useEffect(() => {
    const common = { tab, date: workDate, siteId, contractorId, includeContractor: showContractor };
    if (showAllShiftsOption) {
      const q0 = buildQuery({ ...common, shift: "0" });
      router.prefetch(`${basePath}?${q0}`);
    }
    const q1 = buildQuery({ ...common, shift: "1" });
    const q2 = buildQuery({ ...common, shift: "2" });
    router.prefetch(`${basePath}?${q1}`);
    router.prefetch(`${basePath}?${q2}`);
  }, [basePath, tab, workDate, siteId, contractorId, showContractor, showAllShiftsOption, router]);

  const navigate = (patch: Partial<{ date: string; shift: string; siteId: string; contractorId: string }>) => {
    const q = buildQuery({
      tab,
      date: patch.date ?? workDate,
      shift: patch.shift ?? defaultShiftInUrl,
      siteId: patch.siteId !== undefined ? patch.siteId : siteId,
      contractorId: patch.contractorId !== undefined ? patch.contractorId : contractorId,
      includeContractor: showContractor,
    });
    startTransition(() => {
      router.push(`${basePath}?${q}`);
    });
  };

  const siteOptions = sites.map((s) => ({ id: String(s.id), label: s.name }));
  const contractorOptions = contractors.map((c) => ({ id: String(c.id), label: c.name }));

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      <DatePickerField
        key={workDate}
        name="date"
        defaultValue={workDate}
        disabled={isNavPending}
        onCommitted={(d) => navigate({ date: d })}
      />
      <select
        value={defaultShiftInUrl}
        onChange={(e) => navigate({ shift: e.target.value })}
        className="min-h-12 w-full rounded border border-slate-200 bg-white px-4 py-3 text-base font-bold"
      >
        {showAllShiftsOption ? <option value="0">كل الورديات</option> : null}
        <option value="1">وردية صباحي</option>
        <option value="2">وردية مسائي</option>
      </select>
      <div className="min-h-12 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 lg:col-span-1">
        بحث فوري تحت الجدول
      </div>
      <SearchableSelect
        label="الموقع"
        value={siteId ?? ""}
        onChange={(id) => navigate({ siteId: id })}
        options={siteOptions}
        emptyLabel="كل المواقع"
        disabled={isNavPending}
      />
      {showContractor ? (
        <SearchableSelect
          label="المقاول"
          value={contractorId ?? ""}
          onChange={(id) => navigate({ contractorId: id })}
          options={contractorOptions}
          emptyLabel="كل المقاولين"
          disabled={isNavPending}
        />
      ) : (
        <div className="min-h-12 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
          {basePath === "/approval" ? "فلتر الموقع" : "المقاول من تبويب التحضير"}
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => {
          void (async () => {
            await revalidateAttendancePageCache();
            router.refresh();
          })();
        }}
      >
        تحديث
      </Button>
    </div>
  );
}
