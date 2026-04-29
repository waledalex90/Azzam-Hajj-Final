import { randomUUID } from "node:crypto";
import { SpaLink } from "@/components/navigation/spa-link";
import { unstable_noStore as noStore } from "next/cache";

import { ApprovalHistoryShell } from "@/components/approval/approval-history-shell";
import { ApprovalPendingShell } from "@/components/approval/approval-pending-shell";
import { AttendanceFilterToolbar } from "@/components/attendance/attendance-filter-toolbar";
import { Card } from "@/components/ui/card";
import { TabPanelTransition } from "@/components/ui/tab-panel-transition";
import { requireScreen } from "@/lib/auth/require-screen";
import { canRequestAttendanceCorrection, hasPermission } from "@/lib/auth/permissions";
import { resolveAllowedSiteIdsForSession } from "@/lib/auth/transfer-access";
import { PERM } from "@/lib/permissions/keys";
import {
  getApprovalFilterCounts,
  getAttendanceChecksPage,
  getContractorOptionsLive,
  getPendingApprovalCheckIds,
  getSiteOptionsLive,
  normalizeShiftRound,
} from "@/lib/data/attendance";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { resolveWorkDateFromSearchParam } from "@/lib/utils/today";

type Props = {
  searchParams: Promise<{
    tab?: string;
    date?: string;
    siteId?: string;
    contractorId?: string;
    shift?: string;
  }>;
};

const FULL_LOAD = 50000;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 120;

function approvalQueryString(params: {
  tab: string;
  workDate: string;
  roundNo: number;
  siteId?: string;
  contractorId?: string;
}) {
  const q = new URLSearchParams();
  q.set("tab", params.tab);
  if (params.workDate.trim() !== "") q.set("date", params.workDate);
  q.set("shift", String(params.roundNo));
  if (params.siteId) q.set("siteId", params.siteId);
  if (params.contractorId) q.set("contractorId", params.contractorId);
  return q.toString();
}

export default async function ApprovalPage({ searchParams }: Props) {
  noStore();
  const mountKey = randomUUID();
  const appUser = await requireScreen(PERM.APPROVE_ATTENDANCE);
  const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);
  const canCorrection = canRequestAttendanceCorrection(appUser);
  const canResetAttendance = Boolean(
    appUser &&
      (hasPermission(appUser, PERM.EDIT_ATTENDANCE) || hasPermission(appUser, PERM.APPROVE_ATTENDANCE)),
  );

  const params = await searchParams;
  const activeTab = params.tab === "history" ? "history" : "pending";
  let siteId = params.siteId ? Number(params.siteId) : undefined;
  if (allowedSiteIds !== undefined) {
    if (allowedSiteIds.length === 0) {
      siteId = undefined;
    } else if (!Number.isFinite(siteId) || (siteId !== undefined && !allowedSiteIds.includes(siteId))) {
      siteId = undefined;
    }
  }
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;
  const workDate = resolveWorkDateFromSearchParam(params.date);

  const roundNo = normalizeShiftRound(params.shift);

  const sid = Number.isFinite(siteId) ? siteId : undefined;
  const cid = Number.isFinite(contractorId) ? contractorId : undefined;

  let sites: Awaited<ReturnType<typeof getSiteOptionsLive>> = [];
  let contractors: Awaited<ReturnType<typeof getContractorOptionsLive>> = [];
  let pendingBlock: Awaited<ReturnType<typeof getAttendanceChecksPage>> | null = null;
  let historyBlock: Awaited<ReturnType<typeof getAttendanceChecksPage>> | null = null;
  let pendingFilteredTotal = 0;
  let approvalStats = { pending: 0, confirmed: 0, total: 0 };

  try {
    [sites, contractors, approvalStats] = await Promise.all([
      getSiteOptionsLive(),
      getContractorOptionsLive(),
      getApprovalFilterCounts({
        workDate,
        siteId: sid,
        contractorId: cid,
        roundNo,
        allowedSiteIds,
      }),
    ]);

    [pendingBlock, historyBlock, pendingFilteredTotal] = await Promise.all([
      activeTab === "pending"
        ? getAttendanceChecksPage({
            page: 1,
            pageSize: FULL_LOAD,
            workDate,
            siteId: sid,
            allowedSiteIds,
            contractorId: cid,
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
            allowedSiteIds,
            contractorId: cid,
            search: undefined,
            confirmationStatus: "confirmed",
            roundNo,
          })
        : Promise.resolve(null),
      activeTab === "pending"
        ? getPendingApprovalCheckIds({
            workDate,
            siteId: sid,
            contractorId: cid,
            search: undefined,
            roundNo,
            allowedSiteIds,
          }).then((ids) => ids.length)
        : Promise.resolve(0),
    ]);
  } catch {
    sites = [];
    contractors = [];
    pendingBlock =
      activeTab === "pending"
        ? { rows: [], meta: buildPaginationMeta(0, 1, 1) }
        : null;
    historyBlock =
      activeTab === "history"
        ? { rows: [], meta: buildPaginationMeta(0, 1, 1) }
        : null;
    pendingFilteredTotal = 0;
    approvalStats = { pending: 0, confirmed: 0, total: 0 };
  }

  if (allowedSiteIds !== undefined) {
    sites = allowedSiteIds.length > 0 ? sites.filter((s) => allowedSiteIds.includes(s.id)) : [];
  }

  const pendingRows = pendingBlock?.rows ?? [];
  const historyRows = historyBlock?.rows ?? [];

  const tabQs = {
    pending: approvalQueryString({
      tab: "pending",
      workDate,
      roundNo,
      siteId: params.siteId,
      contractorId: params.contractorId,
    }),
    history: approvalQueryString({
      tab: "history",
      workDate,
      roundNo,
      siteId: params.siteId,
      contractorId: params.contractorId,
    }),
  };

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">اعتماد الحضور</h1>
        <div className="mt-3 flex items-center gap-2 border-b border-slate-200 text-sm">
          <SpaLink
            href={`/approval?${tabQs.pending}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold transition-colors ${
              activeTab === "pending"
                ? "bg-[#14532d] text-white shadow-sm ring-2 ring-[#14532d]/25"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            الاعتمادات المعلقة
          </SpaLink>
          <SpaLink
            href={`/approval?${tabQs.history}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold transition-colors ${
              activeTab === "history"
                ? "bg-[#14532d] text-white shadow-sm ring-2 ring-[#14532d]/25"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            الاعتمادات المعتمدة
          </SpaLink>
        </div>
        <AttendanceFilterToolbar
          basePath="/approval"
          tab={activeTab}
          workDate={workDate}
          prepShiftScope={roundNo === 2 ? 2 : 1}
          showAllShiftsOption={false}
          siteId={params.siteId}
          contractorId={params.contractorId}
          sites={sites}
          contractors={contractors}
          showContractor={true}
        />
      </Card>

      <TabPanelTransition key={activeTab}>
        {activeTab === "pending" ? (
          <ApprovalPendingShell
            key={`pend-${workDate}-${roundNo}-${params.siteId ?? ""}-${params.contractorId ?? ""}-${mountKey}`}
            initialRows={pendingRows}
            initialStats={approvalStats}
            totalPendingFiltered={pendingFilteredTotal}
            workDate={workDate}
            siteId={params.siteId}
            contractorId={params.contractorId}
            roundNo={roundNo}
            canCorrection={canCorrection}
          />
        ) : (
          <ApprovalHistoryShell
            key={`hist-${workDate}-${roundNo}-${params.siteId ?? ""}-${params.contractorId ?? ""}-${mountKey}`}
            initialRows={historyRows}
            stats={approvalStats}
            canRequestCorrection={canCorrection}
          />
        )}
      </TabPanelTransition>
    </section>
  );
}
