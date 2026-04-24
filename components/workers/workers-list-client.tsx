"use client";

import Link from "next/link";
import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Virtuoso } from "react-virtuoso";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { matchesClientSearch } from "@/lib/utils/client-search";
import { buildWorkersHref } from "@/lib/utils/workers-nav";

export type WorkersListRow = {
  id: number;
  name: string;
  id_number: string;
  /** كود موظف فريد — يُدخل يدوياً */
  employee_code: string | null;
  job_title: string | null;
  payment_type: "salary" | "daily";
  basic_salary: number | null;
  iqama_expiry: string | null;
  contractor_id: number | null;
  current_site_id: number | null;
  shift_round: number | null;
  is_active: boolean;
  is_deleted: boolean;
  sites?: { name: string } | null;
  contractors?: { name: string } | null;
};

type SiteOpt = { id: number; name: string };
type ContractorOpt = { id: number; name: string };

type RowProps = {
  worker: WorkersListRow;
  isEditing: boolean;
  queryBase: Record<string, string | undefined>;
  toggleActive: (formData: FormData) => Promise<void>;
  softDeleteWorker: (formData: FormData) => Promise<void>;
  restoreWorker: (formData: FormData) => Promise<void>;
  canEditWorkers: boolean;
  canViewSensitive: boolean;
};

type EditFormProps = {
  worker: WorkersListRow;
  queryBase: Record<string, string | undefined>;
  sites: SiteOpt[];
  contractors: ContractorOpt[];
  updateWorker: (formData: FormData) => Promise<void>;
  canViewSensitive: boolean;
};

/** Native <select> inside react-virtuoso + overflow clips/breaks dropdowns — keep edit form outside the list. */
function WorkersDockedEditForm({
  worker,
  queryBase,
  sites,
  contractors,
  updateWorker,
  canViewSensitive,
}: EditFormProps) {
  return (
    <Card className="relative z-10 border-emerald-200 bg-emerald-50/30 shadow-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-3">
        <p className="text-sm font-extrabold text-slate-900">تعديل بيانات الموظف</p>
        <Link
          href={buildWorkersHref({ ...queryBase, editId: undefined })}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
        >
          إلغاء التعديل
        </Link>
      </div>
      <form action={updateWorker} className="grid gap-2 sm:grid-cols-2">
        {worker.current_site_id == null ? (
          <p className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
            لا يوجد موقع حالي لهذا الموظف — اختر «الموقع» من القائمة ثم احفظ (مطلوب لحفظ التعديل وللتحضير لاحقاً).
          </p>
        ) : null}
        <input type="hidden" name="workerId" value={worker.id} />
        <Input name="name" defaultValue={worker.name} required />
        <Input
          name="employeeCode"
          defaultValue={worker.employee_code ?? ""}
          placeholder="كود الموظف (فريد)"
          maxLength={64}
          autoComplete="off"
        />
        <Input
          name="idNumber"
          defaultValue={worker.id_number}
          required
          readOnly={!canViewSensitive}
          className={!canViewSensitive ? "bg-slate-100" : undefined}
          title={!canViewSensitive ? "بيانات الهوية/الإقامة والراتب تتطلب صلاحية عرض البيانات الحساسة" : undefined}
        />
        <Input name="jobTitle" defaultValue={worker.job_title ?? ""} placeholder="المسمى الوظيفي" />
        <Input
          name="basicSalary"
          type="number"
          step="0.01"
          defaultValue={canViewSensitive ? (worker.basic_salary ?? "") : ""}
          placeholder={canViewSensitive ? "الراتب" : "—"}
          readOnly={!canViewSensitive}
          className={!canViewSensitive ? "bg-slate-100" : undefined}
        />
        <Input
          name="iqamaExpiry"
          type="date"
          defaultValue={canViewSensitive ? (worker.iqama_expiry ?? "") : ""}
          readOnly={!canViewSensitive}
          className={!canViewSensitive ? "bg-slate-100" : undefined}
        />
        <select
          name="paymentType"
          defaultValue={worker.payment_type}
          className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
        >
          <option value="salary">راتب شهري</option>
          <option value="daily">راتب يومي</option>
        </select>
        <select
          name="contractorId"
          defaultValue={worker.contractor_id ?? ""}
          className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
        >
          <option value="">المقاول</option>
          {contractors.map((contractor) => (
            <option key={contractor.id} value={contractor.id}>
              {contractor.name}
            </option>
          ))}
        </select>
        <select
          name="siteId"
          defaultValue={worker.current_site_id ?? ""}
          required={worker.current_site_id == null}
          className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
        >
          <option value="" disabled={worker.current_site_id == null}>
            {worker.current_site_id == null ? "— اختر الموقع (إلزامي) —" : "الموقع"}
          </option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
        <select
          name="shiftRound"
          defaultValue={worker.shift_round === 1 ? "1" : worker.shift_round === 2 ? "2" : ""}
          className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
        >
          <option value="">الوردية — الورديتان</option>
          <option value="1">صباحي</option>
          <option value="2">مسائي</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600 sm:col-span-2"
        >
          حفظ التعديل
        </button>
      </form>
    </Card>
  );
}

const WorkerListRowCard = memo(function WorkerListRowCard({
  worker,
  isEditing,
  queryBase,
  toggleActive,
  softDeleteWorker,
  restoreWorker,
  canEditWorkers,
  canViewSensitive,
}: RowProps) {
  const idLine = canViewSensitive ? worker.id_number : "••••••••";
  return (
    <div className="pb-3">
      <Card className={isEditing ? "ring-2 ring-emerald-500 ring-offset-2" : undefined}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex flex-wrap items-center gap-2 font-extrabold text-slate-900">
              <span>{worker.name}</span>
              {worker.shift_round === 1 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  صباحي
                </span>
              ) : worker.shift_round === 2 ? (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-900">
                  مسائي
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  الورديتان
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              {worker.employee_code ? (
                <span className="font-bold text-slate-700">كود: {worker.employee_code}</span>
              ) : null}
              {worker.employee_code ? " · " : null}
              {idLine} | {worker.sites?.name ?? "بدون موقع"} | {worker.contractors?.name ?? "بدون مقاول"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditWorkers && !worker.is_deleted ? (
              <form action={toggleActive}>
                <input type="hidden" name="workerId" value={worker.id} />
                <input type="hidden" name="isActive" value={String(worker.is_active)} />
                <button
                  type="submit"
                  className={`rounded px-3 py-1 text-xs font-bold text-white ${
                    worker.is_active ? "bg-emerald-600" : "bg-slate-500"
                  }`}
                >
                  {worker.is_active ? "نشط" : "موقوف"}
                </button>
              </form>
            ) : null}

            {canEditWorkers ? (
              <Link
                href={buildWorkersHref({
                  ...queryBase,
                  editId: isEditing ? undefined : String(worker.id),
                })}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700"
              >
                {isEditing ? "إلغاء التعديل" : "تعديل"}
              </Link>
            ) : null}

            {canEditWorkers && worker.is_deleted ? (
              <form action={restoreWorker}>
                <input type="hidden" name="workerId" value={worker.id} />
                <button type="submit" className="rounded bg-[#0f766e] px-3 py-1 text-xs font-bold text-white">
                  استرجاع
                </button>
              </form>
            ) : null}
            {canEditWorkers && !worker.is_deleted ? (
              <form action={softDeleteWorker}>
                <input type="hidden" name="workerId" value={worker.id} />
                <button type="submit" className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  حذف
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
});

type Props = {
  workers: WorkersListRow[];
  sites: SiteOpt[];
  contractors: ContractorOpt[];
  queryBase: Record<string, string | undefined>;
  editId: number | null;
  showStopped: boolean;
  showDeleted: boolean;
  deletedCount: number;
  updateWorker: (formData: FormData) => Promise<void>;
  toggleActive: (formData: FormData) => Promise<void>;
  softDeleteWorker: (formData: FormData) => Promise<void>;
  restoreWorker: (formData: FormData) => Promise<void>;
  canEditWorkers?: boolean;
  canViewSensitive?: boolean;
};

const LIST_H = "min(72vh, 920px)";

export function WorkersListClient({
  workers,
  sites,
  contractors,
  queryBase,
  editId,
  showStopped,
  showDeleted,
  deletedCount,
  updateWorker,
  toggleActive,
  softDeleteWorker,
  restoreWorker,
  canEditWorkers = true,
  canViewSensitive = true,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.trim();
    if (!s) return workers;
    return workers.filter((w) => matchesClientSearch(w.name, w.id_number, s, w.employee_code));
  }, [workers, search]);

  const resetSearch = useCallback(() => {
    setSearch("");
  }, []);

  const onRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const editingWorker = useMemo(() => {
    if (editId == null) return null;
    return workers.find((w) => w.id === editId) ?? null;
  }, [editId, workers]);

  const itemContent = useCallback(
    (_index: number, worker: WorkersListRow) => (
      <WorkerListRowCard
        worker={worker}
        isEditing={editId === worker.id}
        queryBase={queryBase}
        toggleActive={toggleActive}
        softDeleteWorker={softDeleteWorker}
        restoreWorker={restoreWorker}
        canEditWorkers={canEditWorkers}
        canViewSensitive={canViewSensitive}
      />
    ),
    [editId, queryBase, toggleActive, softDeleteWorker, restoreWorker, canEditWorkers, canViewSensitive],
  );

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs font-bold text-slate-700">بحث فوري</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم أو رقم هوية…"
              className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-1.5 text-sm"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={resetSearch}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
          >
            عرض الكل / إعادة ضبط
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          يظهر {filtered.length} من أصل {workers.length}
        </p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildWorkersHref({
              ...queryBase,
              showStopped: showStopped ? undefined : "1",
              showDeleted: undefined,
            })}
            className="rounded bg-amber-500 px-3 py-2 text-xs font-bold text-white"
          >
            {showStopped ? "إلغاء عرض الموقوفين" : "عرض الموقوفين"}
          </Link>
          <Link
            href={buildWorkersHref({
              ...queryBase,
              showDeleted: showDeleted ? undefined : "1",
              showStopped: undefined,
            })}
            className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white"
          >
            {showDeleted ? `إخفاء المحذوفين (${deletedCount})` : `عرض المحذوفين (${deletedCount})`}
          </Link>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded bg-slate-700 px-3 py-2 text-xs font-bold text-white"
          >
            تحديث
          </button>
        </div>
      </Card>

      {editId != null && editingWorker == null ? (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-950">
          لا يمكن عرض نموذج التعديل: الموظف غير موجود في القائمة الحالية (جرّب إعادة ضبط البحث أو تحديث الصفحة).
        </Card>
      ) : null}

      {editingWorker != null ? (
        <WorkersDockedEditForm
          key={editingWorker.id}
          worker={editingWorker}
          queryBase={queryBase}
          sites={sites}
          contractors={contractors}
          updateWorker={updateWorker}
          canViewSensitive={canViewSensitive}
        />
      ) : null}

      {filtered.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">
          {workers.length === 0
            ? "لا توجد بيانات مطابقة للفلترة الحالية."
            : "لا يوجد تطابق للبحث ضمن القائمة الحالية."}
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50" style={{ height: LIST_H }}>
          <Virtuoso
            data={filtered}
            style={{ height: "100%" }}
            increaseViewportBy={{ top: 240, bottom: 400 }}
            itemContent={itemContent}
          />
        </div>
      )}
    </>
  );
}
