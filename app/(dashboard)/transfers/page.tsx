import Link from "next/link";

import {
  createWorkerTransferRequest,
  destinationApproveTransfer,
  destinationRejectTransfer,
  hrApproveTransfer,
  hrRejectTransfer,
} from "@/app/(dashboard)/transfers/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TabPanelTransition } from "@/components/ui/tab-panel-transition";
import { Input } from "@/components/ui/input";
import {
  canRespondAsHr,
  isAdminOrHrRole,
  isFieldObserver,
  isTechnicalObserver,
  resolveAllowedSiteIdsForSession,
} from "@/lib/auth/transfer-access";
import { requireScreen } from "@/lib/auth/require-screen";
import { PERM } from "@/lib/permissions/keys";
import { getSiteOptions } from "@/lib/data/attendance";
import {
  getTransferAlertCounts,
  getWorkersForTransferPicker,
  listTransferRequestsByStatus,
  listTransferRequestsHistory,
} from "@/lib/data/transfer-requests";
import type { WorkerTransferRequestRow } from "@/lib/types/db";

type Props = {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    error?: string;
    ok?: string;
  }>;
};

const TABS = [
  { id: "new", label: "طلب نقل جديد" },
  { id: "incoming", label: "وارد — موافقة الوجهة" },
  { id: "hr", label: "موارد — اعتماد نهائي" },
  { id: "history", label: "السجل" },
] as const;

function statusLabel(s: WorkerTransferRequestRow["status"]) {
  const m: Record<WorkerTransferRequestRow["status"], string> = {
    pending_destination: "بانتظار مراقب الوجهة",
    rejected_destination: "مرفوض من الوجهة",
    pending_hr: "بانتظار الموارد/الأدمن",
    rejected_hr: "مرفوض من الموارد",
    approved: "معتمد — تم النقل",
  };
  return m[s] ?? s;
}

export default async function TransfersPage({ searchParams }: Props) {
  const appUser = await requireScreen(PERM.TRANSFERS);
  const params = await searchParams;
  const tab = TABS.some((t) => t.id === params.tab) ? params.tab! : "new";
  const q = params.q?.trim();

  const role = appUser?.role ?? "";
  const sessionSites = appUser ? await resolveAllowedSiteIdsForSession(appUser) : undefined;
  const canHr = appUser ? canRespondAsHr(appUser) : false;
  const showHrTab = canHr;
  const canSeeAllDest = isAdminOrHrRole(role) || isTechnicalObserver(role);

  const sites = await getSiteOptions();

  const alerts = appUser
    ? await getTransferAlertCounts({
        destinationSiteIds: sessionSites === undefined ? null : sessionSites,
        isHr: canHr,
      })
    : { destinationPending: 0, hrPending: 0 };

  let workersPick: Awaited<ReturnType<typeof getWorkersForTransferPicker>> = [];
  if (tab === "new" && appUser) {
    const siteFilter: number[] | null = canSeeAllDest ? null : sessionSites === undefined ? null : sessionSites;
    workersPick = await getWorkersForTransferPicker({ siteIds: siteFilter, q });
  }

  let incoming: WorkerTransferRequestRow[] = [];
  if (tab === "incoming") {
    incoming = await listTransferRequestsByStatus(
      ["pending_destination"],
      canSeeAllDest ? undefined : { toSiteIdIn: sessionSites ?? [] },
    );
  }

  let hrQueue: WorkerTransferRequestRow[] = [];
  if (tab === "hr" && showHrTab) {
    hrQueue = await listTransferRequestsByStatus(["pending_hr"]);
  }

  let history: WorkerTransferRequestRow[] = [];
  if (tab === "history") {
    history = await listTransferRequestsHistory();
  }

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">نقل الموظفين (طلبات وموافقات)</h1>
        <p className="mt-1 text-sm text-slate-600">
          (أ) مراقب الموقع الأصلي يطلب نقل العامل إلى موقع (ب) → (ب) يوافق أو يرفض → الموارد البشرية / الأدمن يعتمدون نهائياً → يتحدّث{" "}
          <span className="font-bold">موقع العامل</span> تلقائياً.
        </p>
        {(alerts.destinationPending > 0 || alerts.hrPending > 0) && (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
            لديك طلبات: {alerts.destinationPending > 0 ? `${alerts.destinationPending} بانتظار موافقة الوجهة` : ""}
            {alerts.destinationPending > 0 && alerts.hrPending > 0 ? " — " : ""}
            {alerts.hrPending > 0 ? `${alerts.hrPending} بانتظار اعتماد الموارد` : ""}
          </p>
        )}
        {isFieldObserver(role) && sessionSites !== undefined && sessionSites.length === 0 && (
          <p className="mt-2 text-xs font-bold text-red-700">
            لا توجد مواقع مسموحة لحسابك. حدّد المواقع من «المستخدمون والأدوار» (أو جدول app_user_sites) لربط المواقع بالموافقات.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-sm">
          {TABS.filter((t) => (t.id === "hr" ? showHrTab : true)).map((t) => (
            <Link
              key={t.id}
              href={`/transfers?tab=${t.id}`}
              className={`rounded-t-lg px-3 py-2 font-extrabold transition-colors ${
                tab === t.id
                  ? "bg-[#14532d] text-white shadow-sm ring-2 ring-[#14532d]/25"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {params.error && (
          <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{decodeURIComponent(params.error)}</p>
        )}
        {params.ok && (
          <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">تم تنفيذ العملية بنجاح.</p>
        )}
      </Card>

      <TabPanelTransition key={tab}>
      {tab === "new" && (
        <>
          <form className="flex flex-wrap items-end gap-2" method="get">
            <input type="hidden" name="tab" value="new" />
            <div>
              <label className="text-xs font-bold text-slate-600">بحث بالاسم أو الهوية</label>
              <Input name="q" defaultValue={q} placeholder="بحث…" className="mt-1 max-w-xs" />
            </div>
            <Button type="submit">بحث</Button>
          </form>

          <div className="space-y-3">
            {workersPick.map((worker) => (
              <Card key={worker.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{worker.name}</p>
                    <p className="text-xs text-slate-500">
                      {worker.id_number} | من: {worker.sites?.name ?? "بدون موقع"} | مقاول: {worker.contractors?.name ?? "—"}
                    </p>
                  </div>
                  <form action={createWorkerTransferRequest} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="workerId" value={worker.id} />
                    <select
                      name="toSiteId"
                      required
                      className="min-h-10 min-w-[180px] rounded border border-slate-300 bg-white px-3 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        اختر موقع الوجهة
                      </option>
                      {sites
                        .filter((s) => s.id !== worker.current_site_id)
                        .map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded bg-[#0f766e] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                      disabled={!appUser}
                    >
                      إرسال طلب نقل
                    </button>
                  </form>
                </div>
              </Card>
            ))}
            {workersPick.length === 0 && (
              <Card className="text-center text-sm text-slate-500">لا يوجد عمال ضمن النطاق أو لا توجد نتائج بحث.</Card>
            )}
          </div>
        </>
      )}

      {tab === "incoming" && (
        <div className="space-y-3">
          {incoming.map((row) => (
            <Card key={row.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{row.worker?.name ?? `#${row.worker_id}`}</p>
                  <p className="text-xs text-slate-500">
                    من: {row.from_site?.name ?? "—"} → إلى: {row.to_site?.name ?? "—"} | طلب من: {row.requester?.full_name ?? "—"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-amber-800">{statusLabel(row.status)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <form action={destinationApproveTransfer}>
                    <input type="hidden" name="requestId" value={row.id} />
                    <button type="submit" className="w-full rounded bg-emerald-700 px-4 py-2 text-xs font-bold text-white sm:w-auto">
                      موافقة الوجهة
                    </button>
                  </form>
                  <form action={destinationRejectTransfer} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="requestId" value={row.id} />
                    <Input name="note" placeholder="سبب الرفض (اختياري)" className="min-w-[160px] text-sm" />
                    <button type="submit" className="rounded border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-800">
                      رفض
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
          {incoming.length === 0 && (
            <Card className="text-center text-sm text-slate-500">لا توجد طلبات بانتظار موافقة الوجهة.</Card>
          )}
        </div>
      )}

      {tab === "hr" && showHrTab && (
        <div className="space-y-3">
          {hrQueue.map((row) => (
            <Card key={row.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{row.worker?.name ?? `#${row.worker_id}`}</p>
                  <p className="text-xs text-slate-500">
                    من: {row.from_site?.name ?? "—"} → إلى: {row.to_site?.name ?? "—"} | وافق الوجهة:{" "}
                    {row.destination_responder?.full_name ?? "—"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <form action={hrApproveTransfer}>
                    <input type="hidden" name="requestId" value={row.id} />
                    <button type="submit" className="w-full rounded bg-slate-900 px-4 py-2 text-xs font-bold text-white sm:w-auto">
                      اعتماد نهائي وتحديث موقع العامل
                    </button>
                  </form>
                  <form action={hrRejectTransfer} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="requestId" value={row.id} />
                    <Input name="note" placeholder="سبب الرفض" className="min-w-[160px] text-sm" />
                    <button type="submit" className="rounded border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-800">
                      رفض نهائي
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
          {hrQueue.length === 0 && (
            <Card className="text-center text-sm text-slate-500">لا توجد طلبات بانتظار الموارد البشرية.</Card>
          )}
        </div>
      )}

      {tab === "history" && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-right">العامل</th>
                <th className="px-3 py-2 text-right">من → إلى</th>
                <th className="px-3 py-2 text-right">الحالة</th>
                <th className="px-3 py-2 text-right">تاريخ</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    <p className="font-bold">{row.worker?.name ?? "-"}</p>
                    <p className="text-xs text-slate-500">{row.worker?.id_number}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.from_site?.name ?? "—"} → {row.to_site?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{statusLabel(row.status)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{row.created_at?.slice(0, 16)?.replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && <div className="p-6 text-center text-sm text-slate-500">لا يوجد سجل بعد.</div>}
        </Card>
      )}
      </TabPanelTransition>
    </section>
  );
}
