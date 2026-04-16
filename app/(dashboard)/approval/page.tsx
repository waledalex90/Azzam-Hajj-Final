import { randomUUID } from "node:crypto";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { ApprovalHistoryShell } from "@/components/approval/approval-history-shell";
import { ApprovalPendingShell } from "@/components/approval/approval-pending-shell";
import { AttendanceFilterToolbar } from "@/components/attendance/attendance-filter-toolbar";
import { AttendanceResetButton } from "@/components/attendance/attendance-reset-button";
import { Card } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import {
  getAttendanceChecksPage,
  getPendingApprovalCheckIds,
  getSiteOptionsLive,
  normalizeShiftRound,
} from "@/lib/data/attendance";
import { buildPaginationMeta } from "@/lib/utils/pagination";

type Props = {
  searchParams: Promise<{
    tab?: string;
    date?: string;
    siteId?: string;
    shift?: string;
  }>;
};

const FULL_LOAD = 50000;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ApprovalPage({ searchParams }: Props) {
  noStore();
  const mountKey = randomUUID();
  const { appUser } = await getSessionContext();
  const canCorrection = Boolean(appUser && hasPermission(appUser, PERM.CORRECTION_REQUEST));
  const canResetAttendance = Boolean(
    appUser && (hasPermission(appUser, PERM.PREP) || hasPermission(appUser, PERM.APPROVAL)),
  );

  const params = await searchParams;
  const activeTab = params.tab === "history" ? "history" : "pending";
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const workDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);

  const roundNo = normalizeShiftRound(params.shift);

  const sid = Number.isFinite(siteId) ? siteId : undefined;

  let sites: Awaited<ReturnType<typeof getSiteOptionsLive>> = [];
  let pendingBlock: Awaited<ReturnType<typeof getAttendanceChecksPage>> | null = null;
  let historyBlock: Awaited<ReturnType<typeof getAttendanceChecksPage>> | null = null;
  let pendingFilteredTotal = 0;

  try {
    sites = await getSiteOptionsLive();
    [pendingBlock, historyBlock, pendingFilteredTotal] = await Promise.all([
      activeTab === "pending"
        ? getAttendanceChecksPage({
            page: 1,
            pageSize: FULL_LOAD,
            workDate,
            siteId: sid,
            search: undefined,
            confirmationStatus: "pending",
            roundNo,
          })
        : Promise.resolve(null),
      activeTab === "history"
        ? getAttendanceChecksPage({
            page: 1,
            pageSize: FULL_LOAD,
            workDate,
            siteId: sid,
            search: undefined,
            confirmationStatus: "confirmed",
            roundNo,
          })
        : Promise.resolve(null),
      activeTab === "pending"
        ? getPendingApprovalCheckIds({
            workDate,
            siteId: sid,
            search: undefined,
            roundNo,
          }).then((ids) => ids.length)
        : Promise.resolve(0),
    ]);
  } catch {
    sites = [];
    pendingBlock =
      activeTab === "pending"
        ? { rows: [], meta: buildPaginationMeta(0, 1, 1) }
        : null;
    historyBlock =
      activeTab === "history"
        ? { rows: [], meta: buildPaginationMeta(0, 1, 1) }
        : null;
    pendingFilteredTotal = 0;
  }

  const pendingRows = pendingBlock?.rows ?? [];
  const historyRows = historyBlock?.rows ?? [];

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">اعتماد الحضور</h1>
        <div className="mt-3 flex items-center gap-2 border-b border-slate-200 text-sm">
          <Link
            href={`/approval?tab=pending&date=${workDate}&shift=${roundNo}${params.siteId ? `&siteId=${params.siteId}` : ""}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold ${
              activeTab === "pending" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            الاعتمادات المعلقة
          </Link>
          <Link
            href={`/approval?tab=history&date=${workDate}&shift=${roundNo}${params.siteId ? `&siteId=${params.siteId}` : ""}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold ${
              activeTab === "history" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            الاعتمادات المعتمدة
          </Link>
        </div>
        <AttendanceFilterToolbar
          basePath="/approval"
          tab={activeTab}
          workDate={workDate}
          roundNo={roundNo}
          siteId={params.siteId}
          sites={sites}
          contractors={[]}
          showContractor={false}
        />
        {canResetAttendance ? (
          <div className="mt-2 flex flex-wrap justify-end">
            <AttendanceResetButton workDate={workDate} roundNo={roundNo} siteId={params.siteId} />
          </div>
        ) : null}
      </Card>

      {activeTab === "pending" ? (
        <ApprovalPendingShell
          key={`pend-${workDate}-${roundNo}-${params.siteId ?? ""}-${mountKey}`}
          initialRows={pendingRows}
          totalPendingFiltered={pendingFilteredTotal}
          workDate={workDate}
          siteId={params.siteId}
          roundNo={roundNo}
        />
      ) : (
        <ApprovalHistoryShell
          key={`hist-${workDate}-${roundNo}-${params.siteId ?? ""}-${mountKey}`}
          initialRows={historyRows}
          canRequestCorrection={canCorrection}
        />
      )}
    </section>
  );
}
