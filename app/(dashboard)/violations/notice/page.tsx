import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NoticePrintToolbar } from "@/components/violations/notice-print-toolbar";
import { NoticeAttachments } from "@/components/violations/notice-attachments";
import { NoticeModeBar } from "@/components/violations/notice-mode-bar";
import { NoticeOfficialPaperFields } from "@/components/violations/notice-official-paper-fields";
import {
  NoticeOfficialContractorBlock,
  NoticeOfficialHeader,
  NoticeOfficialMetaRow,
  NoticeOfficialNotesBlock,
  NoticeOfficialSignatures,
  NoticeOfficialSiteRow,
  NoticeOfficialViolationList,
} from "@/components/violations/notice-official-paper";
import { getSessionContext } from "@/lib/auth/session";
import {
  getInfractionNoticeOptions,
  getNoticeBundleForView,
  getRecentContractorNotices,
  uploadContractorNoticeMediaFiles,
  type NoticeBundleView,
} from "@/lib/data/violations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type Props = {
  searchParams: Promise<{ saved?: string; viewId?: string }>;
};

function toDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTimeValue(date: Date) {
  return date.toTimeString().slice(0, 5);
}

export default async function InfractionNoticePage({ searchParams }: Props) {
  async function saveNotice(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) {
      redirect("/violations/notice?saved=1");
    }

    const workerId = Number(formData.get("workerId"));
    const contractorId = Number(formData.get("contractorId"));
    const selectedSite = String(formData.get("siteKey") || "");
    const noticeNo = String(formData.get("noticeNo") || "");
    const supervisorName = String(formData.get("supervisorName") || "").trim();
    const delegateName = String(formData.get("delegateName") || "").trim();
    const complexNo = String(formData.get("complexNo") || "").trim();
    const notes = String(formData.get("extraNotes") || "").trim();
    const date = String(formData.get("date") || "");
    const time = String(formData.get("time") || "");
    const violationTypeIds = formData
      .getAll("violationTypeIds")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    const mediaRaw = formData.getAll("mediaFiles");
    const mediaFiles = mediaRaw.filter((f): f is File => typeof f === "object" && f !== null && "size" in f && f.size > 0);

    if (!workerId || !contractorId || violationTypeIds.length === 0) return;

    const { appUser } = await getSessionContext();
    if (!appUser) return;

    const supabase = createSupabaseAdminClient();
    const options = await getInfractionNoticeOptions();
    const { data: contractor } = await supabase
      .from("contractors")
      .select("name")
      .eq("id", contractorId)
      .single<{ name: string }>();

    const siteIdFromKey =
      selectedSite === "mina"
        ? options.siteMapping.minaSiteId
        : selectedSite === "arafat"
          ? options.siteMapping.arafatSiteId
          : selectedSite === "muzdalifah"
            ? options.siteMapping.muzdalifahSiteId
            : null;

    if (!siteIdFromKey) return;

    const occurredAt = new Date(`${date}T${time || "00:00"}:00`);
    const selectedTypes = options.violationTypes.filter((item) => violationTypeIds.includes(item.id));
    const typeNamesJoined = selectedTypes.map((item) => item.name_ar).join("، ");

    const summaryBase =
      `إشعار مخالفة رقم ${noticeNo}\n` +
      `الموقع: ${selectedSite}\n` +
      `رقم مجمع: ${complexNo || "-"}\n` +
      `المقاول: ${contractor?.name ?? "-"}\n` +
      `اسم مشرف المقاول: ${supervisorName || "-"}\n` +
      `المندوب: ${delegateName || "-"}\n` +
      `تفاصيل المخالفة: ${typeNamesJoined}\n` +
      `ملاحظات: ${notes || "-"}`;

    const mediaUrls = await uploadContractorNoticeMediaFiles(workerId, mediaFiles);

    /** سجل لكل نوع مخالفة — يُحسب خصم كل نوع في مستخلص المقاول بعد الاعتماد */
    const rowsToInsert = violationTypeIds.map((vid) => {
      const typeItem = options.violationTypes.find((t) => t.id === vid);
      const label = typeItem?.name_ar ?? `نوع #${vid}`;
      return {
        worker_id: workerId,
        site_id: siteIdFromKey,
        violation_type_id: vid,
        description: `${summaryBase}\n---\nسجل الخصم: «${label}» (قيمة الخصم من إعدادات النوع عند اعتماد المخالفة).`,
        occurred_at: occurredAt.toISOString(),
        reported_by: appUser.id,
        status: "pending_review" as const,
        attachment_urls: mediaUrls,
      };
    });

    if (rowsToInsert.length === 0) return;

    const { error: insertError } = await supabase.from("worker_violations").insert(rowsToInsert);
    if (insertError) {
      console.error(insertError);
      return;
    }

    revalidatePath("/violations");
    revalidatePath("/dashboard");
    revalidatePath("/violations/notice");
    redirect("/violations/notice?saved=1");
  }

  const params = await searchParams;
  const viewIdNum = params.viewId ? Number(params.viewId) : NaN;
  const viewMode = Number.isFinite(viewIdNum) && viewIdNum > 0;

  const now = new Date();
  const options = await getInfractionNoticeOptions();

  let viewBundle: NoticeBundleView | null = null;
  let workersForSelect = options.workers;

  if (viewMode) {
    const got = await getNoticeBundleForView(viewIdNum, options.workers);
    if (got) {
      viewBundle = got.bundle;
      workersForSelect = got.workers;
    }
  }

  const recentNotices = await getRecentContractorNotices(15);

  const contractorNameForView = viewBundle
    ? ((viewBundle.contractorId != null
        ? options.contractors.find((c) => c.id === viewBundle.contractorId)?.name
        : undefined) ?? viewBundle.parsed.contractorName)
    : undefined;

  return (
    <section className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900">إشعار مخالفة — مقاول (نسخة 1447هـ)</h1>
        <div className="flex flex-wrap gap-2">
          <NoticePrintToolbar
            violationTypes={options.violationTypes}
            contractors={options.contractors.map((c) => ({ id: c.id, name: c.name }))}
            workers={workersForSelect.map((w) => ({
              id: w.id,
              name: w.name,
              id_number: w.id_number,
            }))}
            viewPrintData={
              viewBundle
                ? {
                    date: toDateValue(new Date(viewBundle.occurredAtIso)),
                    time: toTimeValue(new Date(viewBundle.occurredAtIso)),
                    noticeNo: viewBundle.parsed.noticeNo,
                    siteKey: viewBundle.siteKey,
                    complexNo: viewBundle.parsed.complexNo?.trim() ?? "",
                    contractorName: contractorNameForView ?? "—",
                    supervisorName: viewBundle.parsed.supervisorName ?? "",
                    workerLabel: `${viewBundle.worker.name} — ${viewBundle.worker.id_number}`,
                    delegateName: viewBundle.parsed.delegateName ?? "",
                    extraNotes: viewBundle.parsed.extraNotes ?? "",
                    violationTypeIds: viewBundle.violationTypeIds,
                  }
                : null
            }
          />
          {viewBundle ? (
            <Link href="/violations/notice">
              <Button variant="primary">إشعار مخالفة جديد</Button>
            </Link>
          ) : null}
          <Link href="/violations">
            <Button variant="ghost">العودة إلى المخالفات</Button>
          </Link>
        </div>
      </div>

      <NoticeModeBar
        isViewMode={!!viewBundle}
        recent={recentNotices.map((n) => ({
          id: n.id,
          noticeNo: n.noticeNo,
          workerName: n.workerName,
          contractorName: n.contractorName,
        }))}
      />

      {params.saved === "1" && (
        <Card className="no-print border-emerald-300 bg-emerald-50 text-emerald-800">
          تم حفظ إشعار المخالفة بنجاح.
        </Card>
      )}

      {viewMode && !viewBundle && (
        <Card className="no-print border-amber-300 bg-amber-50 text-amber-900">
          لم يُعثر على إشعار بهذا الرقم أو لا يمكن عرضه.{" "}
          <Link className="font-bold underline" href="/violations/notice">
            العودة لنموذج جديد
          </Link>
        </Card>
      )}

      {viewBundle ? (
        <Card className="no-print border-slate-200 bg-slate-50 text-slate-800">
          <p className="font-bold">عرض إشعار محفوظ</p>
          <p className="text-sm">
            هذا النموذج للمراجعة أو الطباعة فقط. لإصدار إشعار جديد استخدم زر «إشعار مخالفة جديد» أعلاه.
          </p>
        </Card>
      ) : null}

      <Card className="no-print paper-card overflow-hidden border border-black bg-white p-0">
        {viewBundle ? (
          <ViewNoticeBody
            options={options}
            viewBundle={viewBundle}
            contractorNameForView={contractorNameForView ?? "—"}
          />
        ) : (
          <form
            id="notice-contractor-print"
            action={saveNotice}
            className="paper-form np-paper"
            encType="multipart/form-data"
            dir="rtl"
          >
            <EditNoticeBody options={options} workersForSelect={workersForSelect} now={now} />
          </form>
        )}
      </Card>

      <style>{`
        .paper-card {
          max-width: 900px;
          margin: 0 auto;
        }
        .paper-form {
          padding: 18px;
          color: #111;
          font-size: 14px;
          line-height: 1.5;
          border: 1px solid #111;
          background: #fff;
        }
        /* ——— نموذج الورقة الرسمية (إشعار مخالفة) ——— */
        .np-paper {
          box-sizing: border-box;
        }
        .np-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 10px;
          margin-bottom: 10px;
          border-bottom: 2px solid #111;
        }
        .np-logo {
          flex-shrink: 0;
        }
        .np-logo-img {
          width: 140px;
          height: auto;
          max-width: 38vw;
        }
        .np-titles {
          flex: 1;
          min-width: 0;
          text-align: center;
        }
        .np-main-title {
          margin: 0;
          font-size: clamp(22px, 4.2vw, 32px);
          font-weight: 800;
          line-height: 1.15;
        }
        .np-sub-title {
          margin: 6px 0 0;
          font-size: clamp(13px, 2.4vw, 17px);
          font-weight: 700;
        }
        .np-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin: 0 0 8px;
          border: 1px solid #111;
          background: #fff;
        }
        .np-td {
          border: 1px solid #111;
          padding: 6px 8px;
          vertical-align: middle;
        }
        .np-td-inline {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .np-td-inline .np-inline-label {
          flex-shrink: 0;
        }
        .np-meta .np-td {
          width: 25%;
        }
        .np-inline-label {
          font-weight: 800;
          white-space: nowrap;
        }
        .np-inline-label + .np-field,
        .np-inline-label + input {
          margin-inline-start: 6px;
        }
        .np-block-label {
          font-weight: 800;
          margin-bottom: 4px;
          font-size: 13px;
        }
        .np-field,
        .np-paper .np-field {
          display: inline-block;
          min-height: 34px;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #111 !important;
          border-radius: 0 !important;
          padding: 4px 8px !important;
          font-size: 14px !important;
          background: #fff !important;
        }
        .np-field-plain {
          display: inline-block;
          min-width: 72px;
          min-height: 34px;
          line-height: 26px;
          padding: 4px 8px;
          border: 1px solid #111;
          box-sizing: border-box;
          font-weight: 600;
        }
        .np-field-grow {
          flex: 1;
          width: auto;
          min-width: 140px;
        }
        .np-td .np-inline-label {
          display: inline-flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .np-site-cell {
          vertical-align: top;
        }
        .np-site-heading {
          display: inline-block;
          margin-inline-end: 8px;
        }
        .np-site-radios {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 10px 14px;
          align-items: center;
          margin: 4px 0;
        }
        .np-radio-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          cursor: pointer;
        }
        .np-paper-radio {
          width: 16px;
          height: 16px;
          accent-color: #111;
          flex-shrink: 0;
        }
        .np-complex-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-inline-start: 8px;
        }
        .np-complex-input {
          width: 120px;
          max-width: 40vw;
        }
        .np-site-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 2px 10px;
          border: 1px solid #111;
          background: #fff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          border-radius: 0;
        }
        .np-site-pill-on {
          background: #f3f4f6;
        }
        .np-paper-sq {
          display: inline-flex;
          width: 16px;
          height: 16px;
          align-items: center;
          justify-content: center;
          border: 1px solid #111;
          font-size: 11px;
          line-height: 1;
          flex-shrink: 0;
        }
        .np-person-half {
          width: 50%;
          vertical-align: top;
        }
        .np-dashed-line {
          min-height: 28px;
          padding: 4px 2px;
          border-bottom: 1px dashed #111;
          font-weight: 600;
        }
        .np-violation-sheet {
          border: 1px solid #111;
          padding: 10px 12px 12px;
          margin: 0 0 8px;
          background: #fff;
        }
        .np-section-title {
          text-align: center;
          font-weight: 800;
          font-size: 17px;
          margin: 0 0 10px;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .np-violation-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .np-viol-row {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 10px;
          direction: rtl;
          font-weight: 600;
          line-height: 1.35;
        }
        .np-paper-cb {
          width: 18px;
          height: 18px;
          min-width: 18px;
          min-height: 18px;
          margin-top: 2px;
          flex-shrink: 0;
          accent-color: #111;
        }
        .np-paper-cb-static {
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #111;
          background: #fff;
          font-size: 12px;
          line-height: 1;
        }
        .np-viol-text {
          flex: 1;
          text-align: right;
          min-width: 0;
        }
        .np-violation-extra-lines {
          margin-top: 12px;
          min-height: 20px;
          border-bottom: 1px dashed #111;
        }
        .np-violation-extra-lines::after {
          content: "";
          display: block;
          margin-top: 14px;
          border-bottom: 1px dashed #111;
        }
        .np-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #111;
          border-radius: 0;
          padding: 6px 8px;
          min-height: 72px;
          font: inherit;
          font-weight: 600;
          resize: vertical;
          background: #fff;
        }
        .np-legal-notes {
          border: 1px solid #111;
          padding: 8px 10px;
          margin: 0 0 8px;
          font-size: 12.5px;
          line-height: 1.45;
          font-weight: 600;
        }
        .np-legal-title {
          margin: 0 0 6px;
          font-weight: 800;
          font-size: 14px;
        }
        .np-legal-notes p {
          margin: 4px 0;
        }
        .np-sign-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid #111;
          font-weight: 700;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .np-sign-col {
          min-width: 0;
        }
        .np-sign-h {
          margin: 0 0 6px;
          font-weight: 800;
        }
        .np-sign-line {
          margin: 4px 0;
          font-size: 13px;
        }
        .np-select {
          width: 100%;
          font-weight: 600;
        }
        .violation-picker-wrap {
          position: relative;
        }
        .violation-picker-line {
          display: flex;
          width: 100%;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 40px;
          padding: 8px 12px;
          border: 1px solid #111;
          background: #fff;
          cursor: pointer;
          font-weight: 700;
          direction: rtl;
          text-align: right;
        }
        .violation-picker-line-text {
          flex: 1;
          color: #111;
        }
        .violation-picker-chevron {
          flex-shrink: 0;
          font-size: 14px;
          opacity: 0.85;
        }
        .violation-picker-float {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(100% + 2px);
          z-index: 60;
          border: 1px solid #111;
          background: #fff;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }
        .violation-picker-float-inner {
          max-height: min(55vh, 320px);
          overflow-y: auto;
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        /* عمود المربع ملاصق لعمود النص — بدون فراغ في المنتصف */
        .violation-picker-row {
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr);
          gap: 8px;
          align-items: start;
          direction: rtl;
          cursor: pointer;
          font-weight: 600;
          line-height: 1.4;
          padding: 4px 2px;
          border-radius: 2px;
        }
        .violation-picker-row:hover {
          background: #f3f4f6;
        }
        .violation-picker-cb {
          width: 16px;
          height: 16px;
          margin: 2px 0 0 0;
          flex-shrink: 0;
          accent-color: #166534;
        }
        .violation-picker-txt {
          text-align: right;
          word-break: break-word;
          min-width: 0;
        }
        .violation-selected-chips {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .violation-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          max-width: 100%;
          padding: 4px 8px;
          border: 1px solid #166534;
          border-radius: 999px;
          background: #f0fdf4;
          font-size: 12px;
          font-weight: 700;
        }
        .violation-chip-text {
          text-align: right;
          word-break: break-word;
        }
        .violation-chip-x {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          border: none;
          background: #fff;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          color: #991b1b;
        }
        .violation-print-box {
          border: 1px solid #111;
          padding: 10px 12px;
          background: #fafafa;
        }
        .violation-print-title {
          margin: 0 0 6px;
          font-weight: 800;
          font-size: 14px;
        }
        .violation-print-list {
          margin: 0;
          padding: 0 18px 0 0;
          list-style: disc;
        }
        .violation-print-li {
          margin: 4px 0;
          font-weight: 600;
        }
        .violation-print-empty {
          margin: 0;
          font-weight: 600;
          color: #555;
        }
        .paper-header {
          display: grid;
          grid-template-columns: 1fr 2fr;
          align-items: center;
          border-bottom: 1px solid #111;
          padding-bottom: 10px;
          margin-bottom: 10px;
          gap: 8px;
        }
        .paper-logo {
          display: flex;
          justify-content: flex-start;
        }
        .paper-title {
          text-align: center;
        }
        .paper-title h2 {
          margin: 0;
          font-size: 44px;
          font-weight: 800;
          line-height: 1.1;
        }
        .paper-title p {
          margin: 2px 0 0;
          font-size: 24px;
          font-weight: 700;
        }
        .paper-grid {
          display: grid;
          gap: 8px;
          margin-bottom: 8px;
        }
        .paper-grid.three {
          grid-template-columns: 1fr 1fr 1fr;
        }
        .paper-grid.two {
          grid-template-columns: 1fr 1fr;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-weight: 700;
        }
        select,
        textarea,
        input {
          border: 1px solid #111;
          border-radius: 0;
          background: white;
          min-height: 36px;
          padding: 6px 8px;
          font-size: 14px;
        }
        textarea {
          min-height: 100px;
        }
        .section-title {
          text-align: center;
          font-size: 30px;
          font-weight: 800;
          border-top: 1px solid #111;
          border-bottom: 1px solid #111;
          margin: 12px 0 10px;
          padding: 6px 0;
        }
        .violation-checkboxes {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin: 8px 0 12px;
          padding: 10px 12px;
          border: 1px solid #111;
          background: #fafafa;
        }
        .violation-check-row {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 10px;
          font-weight: 600;
          line-height: 1.35;
        }
        .violation-check-row input {
          margin-top: 4px;
          min-height: auto;
        }
        .violation-check-glyph {
          font-size: 16px;
          line-height: 1.2;
          min-width: 1.2em;
        }
        .notice-view-fields .notice-view-label {
          font-weight: 700;
          display: block;
          margin-bottom: 4px;
        }
        .notice-view-value {
          margin: 0;
          font-weight: 600;
          border: 1px solid #111;
          padding: 8px;
          min-height: 38px;
          background: #fff;
        }
        .notice-media-block {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px dashed #ccc;
        }
        .notice-media-title {
          font-size: 18px !important;
          margin: 8px 0 !important;
        }
        .notice-media-hint {
          font-size: 13px;
          font-weight: 600;
          color: #444;
          margin: 0 0 8px;
        }
        .notice-media-empty {
          margin: 0;
          font-weight: 600;
          color: #555;
        }
        .notice-file-input {
          max-width: 100%;
          font-weight: 600;
        }
        .notice-media-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
          margin-top: 10px;
        }
        .notice-media-item {
          width: 100%;
          max-height: 220px;
          object-fit: contain;
          border: 1px solid #111;
          background: #f8f8f8;
        }
        .notes {
          border-top: 1px solid #111;
          margin-top: 10px;
          padding-top: 10px;
          font-size: 14px;
        }
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          border-top: 1px solid #111;
          margin-top: 12px;
          padding-top: 10px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .sig-title {
          font-weight: 800;
        }
        .save-wrap {
          margin-top: 12px;
          text-align: center;
        }
        @media (max-width: 900px) {
          .paper-title h2 {
            font-size: 34px;
          }
          .paper-title p {
            font-size: 18px;
          }
          .paper-grid.three,
          .paper-grid.two,
          .signatures {
            grid-template-columns: 1fr;
          }
        }
        @media print {
          .paper-form,
          .paper-form * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          aside,
          header {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .paper-card {
            max-width: 100% !important;
            border: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          .paper-form {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            box-sizing: border-box;
            border: 1px solid #111;
            padding: 3mm 3mm !important;
            font-size: 10pt !important;
            line-height: 1.35 !important;
          }
          .np-header {
            margin-bottom: 4px !important;
            padding-bottom: 4px !important;
          }
          .np-main-title {
            font-size: 16pt !important;
          }
          .np-sub-title {
            font-size: 9pt !important;
          }
          .np-logo-img {
            max-width: 88px !important;
          }
          .np-table {
            font-size: 9.5pt !important;
          }
          .np-section-title {
            font-size: 11pt !important;
          }
          .np-legal-notes {
            font-size: 8.5pt !important;
          }
          .np-textarea {
            min-height: 40px !important;
            font-size: 9pt !important;
          }
          .np-violation-sheet,
          .np-sign-grid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .paper-header {
            margin-bottom: 6px !important;
            padding-bottom: 6px !important;
          }
          .paper-title h2 {
            font-size: 17pt !important;
            line-height: 1.1 !important;
          }
          .paper-title p {
            font-size: 10pt !important;
          }
          .paper-logo :is(img, svg) {
            max-width: 100px !important;
            height: auto !important;
          }
          .section-title {
            font-size: 13pt !important;
            margin: 6px 0 !important;
            padding: 4px 0 !important;
          }
          .paper-grid {
            gap: 4px !important;
            margin-bottom: 4px !important;
          }
          label {
            gap: 2px !important;
          }
          textarea {
            min-height: 52px !important;
            font-size: 9.5pt !important;
          }
          .section-title,
          .paper-title h2 {
            break-after: avoid;
            page-break-after: avoid;
          }
          .signatures,
          .violation-checkboxes,
          .violation-type-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .notice-media-grid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .notice-media-item {
            max-height: 45mm !important;
          }
          .notes {
            font-size: 8.5pt !important;
            margin-top: 6px !important;
            padding-top: 6px !important;
          }
          .notes p {
            margin: 2px 0 !important;
          }
          .signatures {
            margin-top: 8px !important;
            padding-top: 8px !important;
            gap: 10px !important;
            font-size: 9pt !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
        }
      `}</style>
    </section>
  );
}

function EditNoticeBody({
  options,
  workersForSelect,
  now,
}: {
  options: Awaited<ReturnType<typeof getInfractionNoticeOptions>>;
  workersForSelect: Awaited<ReturnType<typeof getInfractionNoticeOptions>>["workers"];
  now: Date;
}) {
  return (
    <>
      <NoticeOfficialHeader />

      <NoticeOfficialMetaRow
        dateDefault={toDateValue(now)}
        timeDefault={toTimeValue(now)}
        noticeNo={String(options.noticeNo)}
      />

      <NoticeOfficialPaperFields
        workers={workersForSelect}
        contractors={options.contractors}
        siteMapping={options.siteMapping}
        defaultSiteKey="mina"
      />

      <NoticeOfficialViolationList types={options.violationTypes} />

      <table className="np-table">
        <tbody>
          <tr>
            <td className="np-td">
              <div className="np-block-label">بيان إضافي (اختياري):</div>
              <textarea name="extraNotes" className="np-textarea" rows={3} />
            </td>
          </tr>
        </tbody>
      </table>

      <NoticeOfficialNotesBlock />

      <table className="np-table">
        <tbody>
          <tr>
            <td className="np-td np-td-inline">
              <span className="np-inline-label">اسم المندوب:</span>
              <Input name="delegateName" className="np-field np-field-grow" />
            </td>
          </tr>
        </tbody>
      </table>

      <NoticeAttachments />

      <NoticeOfficialSignatures />

      <div className="no-print save-wrap">
        <Button type="submit">حفظ إشعار المخالفة</Button>
      </div>
    </>
  );
}

function ViewNoticeBody({
  options,
  viewBundle,
  contractorNameForView,
}: {
  options: Awaited<ReturnType<typeof getInfractionNoticeOptions>>;
  viewBundle: NoticeBundleView;
  contractorNameForView: string;
}) {
  const d = new Date(viewBundle.occurredAtIso);
  return (
    <div id="notice-contractor-print" className="paper-form np-paper" dir="rtl">
      <NoticeOfficialHeader />

      <NoticeOfficialMetaRow
        readOnly
        dateDefault={toDateValue(d)}
        timeDefault={toTimeValue(d)}
        noticeNo={viewBundle.parsed.noticeNo}
      />

      <NoticeOfficialSiteRow
        readOnly
        defaultSiteKey={viewBundle.siteKey}
        complexDefault={viewBundle.parsed.complexNo?.trim() || "—"}
      />

      <NoticeOfficialContractorBlock
        readOnly
        viewContractorName={contractorNameForView}
        viewWorkerLabel={`${viewBundle.worker.name} — ${viewBundle.worker.id_number}`}
        supervisorDefault={viewBundle.parsed.supervisorName}
      />

      <NoticeOfficialViolationList
        key={`view-vt-${viewBundle.primaryViolationId}-${viewBundle.violationTypeIds.join(",")}`}
        readOnly
        types={options.violationTypes}
        selectedIds={viewBundle.violationTypeIds}
      />

      <table className="np-table">
        <tbody>
          <tr>
            <td className="np-td">
              <div className="np-block-label">بيان إضافي (اختياري):</div>
              <textarea readOnly className="np-textarea" rows={3} value={viewBundle.parsed.extraNotes || "—"} />
            </td>
          </tr>
        </tbody>
      </table>

      <NoticeOfficialNotesBlock />

      <table className="np-table">
        <tbody>
          <tr>
            <td className="np-td np-td-inline">
              <span className="np-inline-label">اسم المندوب:</span>
              <Input readOnly className="np-field np-field-grow" value={viewBundle.parsed.delegateName || "—"} />
            </td>
          </tr>
        </tbody>
      </table>

      <NoticeAttachments readOnly initialUrls={viewBundle.attachmentUrls} />

      <NoticeOfficialSignatures />
    </div>
  );
}

