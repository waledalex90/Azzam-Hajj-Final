"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { revalidateAttendancePageCache } from "@/app/(dashboard)/attendance/actions";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";

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
  p.set("date", base.date);
  p.set("shift", base.shift);
  if (base.siteId) p.set("siteId", base.siteId);
  if (base.includeContractor && base.contractorId) p.set("contractorId", base.contractorId);
  return p.toString();
}

export function AttendanceFilterToolbar(props: {
  basePath: "/attendance" | "/approval";
  tab: string;
  workDate: string;
  roundNo: number;
  siteId?: string;
  contractorId?: string;
  sites: { id: number; name: string }[];
  contractors: { id: number; name: string }[];
  showContractor: boolean;
}) {
  const router = useRouter();
  const [isNavPending, startTransition] = useTransition();
  const { basePath, tab, workDate, roundNo, siteId, contractorId, sites, contractors, showContractor } = props;

  const navigate = (patch: Partial<{ date: string; shift: string; siteId: string; contractorId: string }>) => {
    const q = buildQuery({
      tab,
      date: patch.date ?? workDate,
      shift: patch.shift ?? String(roundNo),
      siteId: patch.siteId !== undefined ? patch.siteId : siteId,
      contractorId: patch.contractorId !== undefined ? patch.contractorId : contractorId,
      includeContractor: showContractor,
    });
    startTransition(() => {
      router.push(`${basePath}?${q}`);
      router.refresh();
    });
  };

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
        value={String(roundNo)}
        onChange={(e) => navigate({ shift: e.target.value })}
        disabled={isNavPending}
        className="min-h-12 w-full rounded border border-slate-200 bg-white px-4 py-3 text-base font-bold disabled:opacity-60"
      >
        <option value="1">وردية صباحي</option>
        <option value="2">وردية مسائي</option>
      </select>
      <div className="min-h-12 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 lg:col-span-1">
        بحث فوري تحت الجدول
      </div>
      <select
        value={siteId ?? ""}
        onChange={(e) => navigate({ siteId: e.target.value })}
        disabled={isNavPending}
        className="min-h-12 w-full rounded border border-slate-200 bg-white px-4 py-3 text-base disabled:opacity-60"
      >
        <option value="">كل المواقع</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
      {showContractor ? (
        <select
          value={contractorId ?? ""}
          onChange={(e) => navigate({ contractorId: e.target.value })}
          disabled={isNavPending}
          className="min-h-12 w-full rounded border border-slate-200 bg-white px-4 py-3 text-base disabled:opacity-60"
        >
          <option value="">كل المقاولين</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
