import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NoticeFormShell } from "@/components/violations/notice-form-shell";
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
import { requireScreen } from "@/lib/auth/require-screen";
import { PERM } from "@/lib/permissions/keys";
import {
  getInfractionNoticeOptions,
  getNoticeBundleForView,
  getRecentContractorNotices,
  type NoticeBundleView,
} from "@/lib/data/violations";
import { todayIsoDateInAppTimeZone } from "@/lib/utils/today";

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
  await requireScreen(PERM.VIOLATION_NOTICE);

  const params = await searchParams;
  const viewIdNum = params.viewId ? Number(params.viewId) : NaN;
  const viewMode = Number.isFinite(viewIdNum) && viewIdNum > 0;

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
          <NoticeFormShell showSavedBanner={params.saved === "1"}>
            <EditNoticeBody options={options} workersForSelect={workersForSelect} />
          </NoticeFormShell>
        )}
      </Card>

      <style>{`
        .paper-card {
          max-width: 900px;
          margin: 0 auto;
        }
        .only-print {
          display: none !important;
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
        /* نموذج الطباعة النصي (NoticePrintDocument) */
        .np-print-value {
          display: inline-block;
          font-weight: 700;
          padding: 2px 4px;
          min-height: 22px;
        }
        .np-print-site-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-inline-end: 12px;
          font-weight: 700;
        }
        .np-complex-print {
          min-width: 48px;
          margin-inline-start: 6px;
        }
        .np-print-notes {
          white-space: pre-wrap;
          word-break: break-word;
          font-weight: 600;
          line-height: 1.45;
        }
        .np-print-sig-name {
          font-weight: 800;
        }
        .notice-print-a4 {
          max-width: 190mm;
          margin: 0 auto;
          box-sizing: border-box;
          background: #fff;
          color: #111;
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
        .notice-media-tile {
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }
        .np-field-error {
          outline: 3px solid #b91c1c !important;
          outline-offset: 2px;
          background-color: #fef2f2 !important;
        }
        .notice-save-flash {
          background-color: #15803d !important;
          border-color: #14532d !important;
          color: #fff !important;
        }
        @keyframes notice-indeterminate {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(250%);
          }
        }
        .notice-upload-progress-indeterminate {
          width: 40%;
          animation: notice-indeterminate 1.1s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .notice-upload-progress-indeterminate {
            animation: none;
            width: 100%;
            opacity: 0.85;
          }
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

        /* ——— موبايل فقط: شاشة وليس طباعة ——— */
        @media screen and (max-width: 640px) {
          .notice-form-top-mobile {
            margin: 0 -2px 6px;
            padding: 0 2px 4px;
          }
          .notice-form-top-mobile .np-table {
            margin-bottom: 6px;
          }
          .notice-form-top-mobile .np-header {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 8px;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .notice-form-top-mobile .np-logo-img {
            max-width: 120px;
          }
          .paper-form {
            padding: 10px 8px !important;
          }
          /* صف التاريخ / الإشعار: شبكة عمودين مرتبة */
          .notice-form-top-mobile .np-meta {
            display: block;
          }
          .notice-form-top-mobile .np-meta tbody {
            display: block;
          }
          .notice-form-top-mobile .np-meta tr {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-areas:
              "notice date"
              "numdup time";
            gap: 6px 8px;
          }
          .notice-form-top-mobile .np-meta .np-td {
            width: 100% !important;
            display: block;
            padding: 6px !important;
            vertical-align: top;
          }
          .notice-form-top-mobile .np-meta .np-td:nth-child(1) {
            grid-area: date;
          }
          .notice-form-top-mobile .np-meta .np-td:nth-child(2) {
            grid-area: time;
          }
          .notice-form-top-mobile .np-meta .np-td:nth-child(3) {
            grid-area: notice;
          }
          .notice-form-top-mobile .np-meta .np-td:nth-child(4) {
            grid-area: numdup;
          }
          .notice-form-top-mobile .np-inline-label {
            display: block;
            font-size: 11px !important;
            font-weight: 700;
            color: #64748b;
            white-space: normal;
            margin-bottom: 4px;
          }
          .notice-form-top-mobile .np-field,
          .notice-form-top-mobile .np-field-plain,
          .notice-form-top-mobile .np-paper .np-field {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            box-sizing: border-box;
          }
          /* الموقع (حبوب) + مجمع */
          .notice-form-top-mobile .np-site {
            display: block;
          }
          .notice-form-top-mobile .np-site tbody,
          .notice-form-top-mobile .np-site tr {
            display: block;
          }
          .notice-form-top-mobile .np-site .np-site-cell {
            display: block;
            padding: 6px !important;
          }
          .notice-form-top-mobile .np-site-radios {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
            margin: 6px 0;
          }
          .notice-form-top-mobile .np-site-pill {
            width: 100%;
            justify-content: flex-start;
          }
          .notice-form-top-mobile .np-complex-wrap {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
            margin-inline-start: 0;
            margin-top: 8px;
          }
          .notice-form-top-mobile .np-complex-input {
            width: 100% !important;
            max-width: none !important;
          }
          /* مقاول | مشرف: عمودان ثم تكديس عند الضيق */
          .notice-form-top-mobile .np-personnel {
            display: block;
          }
          .notice-form-top-mobile .np-personnel tbody {
            display: block;
          }
          .notice-form-top-mobile .np-personnel tr {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 8px;
          }
          .notice-form-top-mobile .np-personnel .np-td {
            display: block;
            width: 100% !important;
            padding: 6px !important;
          }
          .notice-form-top-mobile .np-block-label {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 4px;
          }
          .notice-form-top-mobile .np-personnel .np-field-plain {
            min-height: 38px;
            font-size: 14px !important;
            color: #0f172a !important;
          }
          .notice-form-top-mobile .np-personnel + .np-table {
            display: block;
          }
          .notice-form-top-mobile .np-personnel + .np-table tbody,
          .notice-form-top-mobile .np-personnel + .np-table tr {
            display: block;
          }
          .notice-form-top-mobile .np-personnel + .np-table .np-td {
            padding: 6px !important;
          }
        }
        @media screen and (max-width: 380px) {
          .notice-form-top-mobile .np-personnel tr {
            grid-template-columns: 1fr;
          }
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
          .only-print {
            display: block !important;
          }
          /* طباعة النموذج الرسمي فقط (بوابة body) — نصوص وليست لقطة شاشة */
          body * {
            visibility: hidden !important;
          }
          body > .only-print.notice-print-portal,
          body > .only-print.notice-print-portal * {
            visibility: visible !important;
          }
          body > .only-print.notice-print-portal {
            display: block !important;
            position: relative;
            width: 100%;
            max-width: 190mm !important;
            margin: 0 auto !important;
            padding: 8mm 12mm !important;
            box-sizing: border-box !important;
            background: #fff !important;
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
}: {
  options: Awaited<ReturnType<typeof getInfractionNoticeOptions>>;
  workersForSelect: Awaited<ReturnType<typeof getInfractionNoticeOptions>>["workers"];
}) {
  return (
    <>
      <div className="notice-form-top-mobile">
        <NoticeOfficialHeader />

        <NoticeOfficialMetaRow
          dateDefault={todayIsoDateInAppTimeZone()}
          timeDefault=""
          noticeNo={String(options.noticeNo)}
          dateFieldWrapId="notice-field-date"
        />

        <NoticeOfficialPaperFields
          workers={workersForSelect}
          contractors={options.contractors}
          siteMapping={options.siteMapping}
          defaultSiteKey="mina"
        />
      </div>

      <NoticeOfficialViolationList types={options.violationTypes} violationsSectionId="notice-field-violations" />

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

