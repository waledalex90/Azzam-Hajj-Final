import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/pagination/pagination-controls";
import { CorrectionResolveRow } from "@/components/corrections/correction-resolve-row";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSiteOptions } from "@/lib/data/attendance";
import { parsePage } from "@/lib/utils/pagination";

type Props = {
  searchParams: Promise<{
    page?: string;
    date?: string;
    siteId?: string;
    q?: string;
  }>;
};

const PAGE_SIZE = 25;
const PENDING_CAP = 8000;

export default async function CorrectionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const workDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);
  const q = params.q?.trim().toLowerCase();

  const supabase = createSupabaseAdminClient();

  const { data: reqRows, error } = await supabase
    .from("correction_requests")
    .select("id, attendance_id, reason, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(PENDING_CAP);

  const requests = ((reqRows ?? []) as Array<{ id: number; attendance_id: number | null; reason: string | null; created_at: string }>).filter(
    (r) => r.attendance_id,
  );

  const attendanceIds = Array.from(new Set(requests.map((r) => r.attendance_id!)));
  type CheckInfo = {
    status: "present" | "absent" | "half";
    workers?: { name: string; id_number: string } | null;
    siteName?: string | null;
    workDate?: string | null;
    roundNo?: number | null;
    siteId?: number | null;
  };
  const checkMap = new Map<number, CheckInfo>();

  const CH = 400;
  for (let i = 0; i < attendanceIds.length; i += CH) {
    const chunk = attendanceIds.slice(i, i + CH);
    if (chunk.length === 0) break;
    const { data: checks } = await supabase
      .from("attendance_checks")
      .select("id, status, workers(name, id_number), attendance_rounds(work_date, round_no, site_id, sites(name))")
      .in("id", chunk);
    type CheckRow = {
      id: number;
      status: "present" | "absent" | "half";
      workers?: { name: string; id_number: string } | { name: string; id_number: string }[] | null;
      attendance_rounds?:
        | {
            work_date: string;
            round_no: number;
            site_id?: number;
            sites?: { name: string } | { name: string }[] | null;
          }
        | {
            work_date: string;
            round_no: number;
            site_id?: number;
            sites?: { name: string } | { name: string }[] | null;
          }[]
        | null;
    };
    for (const row of (checks ?? []) as unknown as CheckRow[]) {
      const w = Array.isArray(row.workers) ? row.workers[0] : row.workers;
      const round = Array.isArray(row.attendance_rounds)
        ? row.attendance_rounds[0]
        : row.attendance_rounds;
      const site = round?.sites ? (Array.isArray(round.sites) ? round.sites[0] : round.sites) : null;
      checkMap.set(row.id, {
        status: row.status,
        workers: w ?? null,
        siteName: site?.name ?? null,
        workDate: round?.work_date ?? null,
        roundNo: round?.round_no ?? null,
        siteId: round?.site_id ?? null,
      });
    }
  }

  let merged = requests
    .map((req) => ({ req, check: req.attendance_id ? checkMap.get(req.attendance_id) : undefined }))
    .filter((x): x is typeof x & { check: CheckInfo } => Boolean(x.check));

  merged = merged.filter((x) => {
    if (x.check.workDate && x.check.workDate !== workDate) return false;
    if (siteId && Number.isFinite(siteId) && x.check.siteId !== siteId) return false;
    if (q) {
      const name = x.check.workers?.name?.toLowerCase() ?? "";
      const idn = x.check.workers?.id_number?.toLowerCase() ?? "";
      if (!name.includes(q) && !idn.includes(q)) return false;
    }
    return true;
  });

  const totalRows = merged.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const sliceFrom = (page - 1) * PAGE_SIZE;
  const display = merged.slice(sliceFrom, sliceFrom + PAGE_SIZE);

  const sites = await getSiteOptions();

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">طلبات التعديل</h1>
        <p className="mt-1 text-xs text-slate-600">طلبات معلّقة فقط. اختر الحالة الجديدة لإغلاق الطلب.</p>
        <form className="mt-4 grid gap-2 sm:grid-cols-4" method="get">
          <Input type="date" name="date" defaultValue={workDate} />
          <select
            name="siteId"
            defaultValue={params.siteId}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <option value="">كل المواقع</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <Input name="q" defaultValue={params.q} placeholder="بحث بالاسم أو الهوية" />
          <Button type="submit">تطبيق</Button>
        </form>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 text-sm text-red-800">تعذّر تحميل الطلبات.</Card>
      )}

      <div className="space-y-3">
        {display.map(({ req, check }) => {
          const workerLabel = check.workers
            ? `${check.workers.name} (${check.workers.id_number})`
            : `سجل #${req.attendance_id ?? "—"}`;
          const metaLine = `${check.siteName ?? "—"} | ${check.workDate ?? "—"} / #${check.roundNo ?? "—"} | الحالة الحالية: ${
            check.status === "present" ? "حاضر" : check.status === "absent" ? "غائب" : "نصف يوم"
          }`;
          return (
            <CorrectionResolveRow
              key={req.id}
              requestId={req.id}
              workerLabel={workerLabel}
              metaLine={metaLine}
              reason={req.reason ?? ""}
            />
          );
        })}
        {display.length === 0 && !error && (
          <Card className="text-center text-sm text-slate-500">لا توجد طلبات تعديل معلّقة ضمن الفلتر.</Card>
        )}
      </div>

      <PaginationControls page={page} totalPages={totalPages} basePath="/corrections" query={{ date: workDate, siteId: params.siteId, q }} />
    </section>
  );
}
