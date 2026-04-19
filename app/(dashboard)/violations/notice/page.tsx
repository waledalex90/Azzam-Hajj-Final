import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/branding/brand-logo";
import { PrintButton } from "@/components/violations/print-button";
import { NoticeLinkedSelects } from "@/components/violations/notice-linked-selects";
import { NoticeAttachments } from "@/components/violations/notice-attachments";
import { NoticeViolationTypeDropdown } from "@/components/violations/notice-violation-type-dropdown";
import { NoticeModeBar } from "@/components/violations/notice-mode-bar";
import { getSessionContext } from "@/lib/auth/session";
import {
  getInfractionNoticeOptions,
  getNoticeBundleForView,
  getRecentContractorNotices,
  uploadContractorNoticeMediaFiles,
  type NoticeBundleView,
  type NoticeSiteKey,
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

function siteLabelAr(key: NoticeSiteKey) {
  switch (key) {
    case "mina":
      return "منى";
    case "arafat":
      return "عرفات";
    case "muzdalifah":
      return "مزدلفة";
    default:
      return key;
  }
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
          <PrintButton />
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

      <Card className="paper-card overflow-hidden border border-black bg-white p-0">
        {viewBundle ? (
          <ViewNoticeBody
            options={options}
            workersForSelect={workersForSelect}
            viewBundle={viewBundle}
            contractorNameForView={contractorNameForView ?? "—"}
          />
        ) : (
          <form action={saveNotice} className="paper-form" encType="multipart/form-data">
            <EditNoticeBody options={options} workersForSelect={workersForSelect} now={now} />
          </form>
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
        .violation-details {
          border: 1px solid #111;
          background: #fff;
        }
        .violation-details-summary {
          cursor: pointer;
          list-style: none;
          padding: 10px 12px;
          font-weight: 700;
          direction: rtl;
        }
        .violation-details-summary::-webkit-details-marker {
          display: none;
        }
        .violation-details-panel {
          max-height: 220px;
          overflow-y: auto;
          border-top: 1px solid #111;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .violation-details-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-weight: 600;
          line-height: 1.35;
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
          .no-print,
          aside,
          header {
            display: none !important;
          }
          .only-print {
            display: block !important;
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
            min-height: auto;
            margin: 0 !important;
            box-sizing: border-box;
            border: 1px solid #111;
            padding: 5mm 4mm !important;
            font-size: 11.5pt;
            line-height: 1.45;
          }
          .paper-title h2 {
            font-size: 22pt !important;
            line-height: 1.15 !important;
          }
          .paper-title p {
            font-size: 12pt !important;
          }
          .paper-logo :is(img, svg) {
            max-width: 130px !important;
            height: auto !important;
          }
          .section-title {
            font-size: 16pt !important;
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
            max-height: 65mm;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
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
      <PaperHeader />

      <div className="paper-grid three">
        <label>
          التاريخ:
          <Input name="date" type="date" defaultValue={toDateValue(now)} />
        </label>
        <label>
          الوقت:
          <Input name="time" type="time" defaultValue={toTimeValue(now)} />
        </label>
        <label>
          رقم الإشعار:
          <Input name="noticeNo" defaultValue={String(options.noticeNo)} readOnly />
        </label>
      </div>

      <div className="paper-grid two">
        <label>
          رقم مجمع:
          <Input name="complexNo" />
        </label>
        <label>
          اسم مشرف المقاول:
          <Input name="supervisorName" />
        </label>
      </div>

      <NoticeLinkedSelects
        workers={workersForSelect}
        contractors={options.contractors}
        siteMapping={options.siteMapping}
      />

      <div className="section-title">تفاصيل المخالفة</div>
      <NoticeViolationTypeDropdown types={options.violationTypes} />

      <label>
        ملاحظات إضافية:
        <textarea name="extraNotes" rows={4} />
      </label>

      <label>
        اسم المندوب:
        <Input name="delegateName" />
      </label>

      <NoticeAttachments />

      <NotesBlock />

      <SignaturesBlock />

      <div className="no-print save-wrap">
        <Button type="submit">حفظ إشعار المخالفة</Button>
      </div>
    </>
  );
}

function ViewNoticeBody({
  options,
  workersForSelect,
  viewBundle,
  contractorNameForView,
}: {
  options: Awaited<ReturnType<typeof getInfractionNoticeOptions>>;
  workersForSelect: Awaited<ReturnType<typeof getInfractionNoticeOptions>>["workers"];
  viewBundle: NoticeBundleView;
  contractorNameForView: string;
}) {
  const d = new Date(viewBundle.occurredAtIso);
  return (
    <div className="paper-form">
      <PaperHeader />

      <div className="paper-grid three">
        <label>
          التاريخ:
          <Input name="date" type="date" readOnly value={toDateValue(d)} />
        </label>
        <label>
          الوقت:
          <Input name="time" type="time" readOnly value={toTimeValue(d)} />
        </label>
        <label>
          رقم الإشعار:
          <Input name="noticeNo" readOnly value={viewBundle.parsed.noticeNo} />
        </label>
      </div>

      <div className="paper-grid two">
        <label>
          رقم مجمع:
          <Input readOnly value={viewBundle.parsed.complexNo || "—"} />
        </label>
        <label>
          اسم مشرف المقاول:
          <Input readOnly value={viewBundle.parsed.supervisorName || "—"} />
        </label>
      </div>

      <NoticeLinkedSelects
        key={`view-${viewBundle.primaryViolationId}`}
        mode="view"
        workers={workersForSelect}
        contractors={options.contractors}
        siteMapping={options.siteMapping}
        viewLabels={{
          contractorName: contractorNameForView,
          workerLabel: `${viewBundle.worker.name} - ${viewBundle.worker.id_number}`,
          siteLabel: siteLabelAr(viewBundle.siteKey),
        }}
      />

      <div className="section-title">تفاصيل المخالفة</div>
      <NoticeViolationTypeDropdown
        types={options.violationTypes}
        viewMode
        viewSelectedIds={viewBundle.violationTypeIds}
      />

      <label>
        ملاحظات إضافية:
        <textarea readOnly rows={4} value={viewBundle.parsed.extraNotes || "—"} />
      </label>

      <label>
        اسم المندوب:
        <Input readOnly value={viewBundle.parsed.delegateName || "—"} />
      </label>

      <NoticeAttachments readOnly initialUrls={viewBundle.attachmentUrls} />

      <NotesBlock />

      <SignaturesBlock />
    </div>
  );
}

function PaperHeader() {
  return (
    <div className="paper-header">
      <div className="paper-logo">
        <BrandLogo priority className="w-[160px]" />
      </div>
      <div className="paper-title">
        <h2>إشعار مخالفة</h2>
        <p>مشاريع دورات المياه موسم حج 1447هـ</p>
      </div>
    </div>
  );
}

function NotesBlock() {
  return (
    <div className="notes">
      <p>1- وفقاً لجدول الغرامات المرفق بالعقد سيتم توقيع الغرامات الواردة بالعقد.</p>
      <p>2- الإشعار من أصل يرسل للحسابات والصورة لمندوب المقاول ويوقع بالاستلام.</p>
      <p>3- في حال عدم حضور أو رفض مندوب المقاول التوقيع يتم إثبات الرفض على الإشعار.</p>
      <p>4- يتم إرسال صورة الإشعار على الجروب المخصص للأعمال.</p>
    </div>
  );
}

function SignaturesBlock() {
  return (
    <div className="signatures">
      <div>
        <p className="sig-title">المشرف:</p>
        <p>الاسم: ..............................................</p>
        <p>التوقيع: ............................................</p>
      </div>
      <div>
        <p className="sig-title">المندوب:</p>
        <p>الاسم: ..............................................</p>
        <p>التوقيع: ............................................</p>
      </div>
    </div>
  );
}
