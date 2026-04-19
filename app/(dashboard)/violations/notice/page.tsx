import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/branding/brand-logo";
import { PrintButton } from "@/components/violations/print-button";
import { NoticeLinkedSelects } from "@/components/violations/notice-linked-selects";
import { getSessionContext } from "@/lib/auth/session";
import { getInfractionNoticeOptions } from "@/lib/data/violations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type Props = {
  searchParams: Promise<{ workerQ?: string; saved?: string }>;
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
    const notes = String(formData.get("extraNotes") || "").trim();
    const date = String(formData.get("date") || "");
    const time = String(formData.get("time") || "");
    const violationTypeIds = formData
      .getAll("violationTypeIds")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

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
      `المقاول: ${contractor?.name ?? "-"}\n` +
      `اسم مشرف المقاول: ${supervisorName || "-"}\n` +
      `المندوب: ${delegateName || "-"}\n` +
      `تفاصيل المخالفة: ${typeNamesJoined}\n` +
      `ملاحظات: ${notes || "-"}`;

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
  const workerQ = params.workerQ?.trim();
  const now = new Date();
  const options = await getInfractionNoticeOptions(workerQ);

  return (
    <section className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-900">إشعار مخالفة (نسخة 1447هـ)</h1>
        <div className="flex gap-2">
          <PrintButton />
          <Link href="/violations">
            <Button variant="ghost">العودة إلى المخالفات</Button>
          </Link>
        </div>
      </div>

      {params.saved === "1" && (
        <Card className="no-print border-emerald-300 bg-emerald-50 text-emerald-800">
          تم حفظ إشعار المخالفة بنجاح.
        </Card>
      )}

      <Card className="paper-card overflow-hidden border border-black bg-white p-0">
        <form action={saveNotice} className="paper-form">
          <div className="paper-header">
            <div className="paper-logo">
              <BrandLogo priority className="w-[160px]" />
            </div>
            <div className="paper-title">
              <h2>إشعار مخالفة</h2>
              <p>مشاريع دورات المياه موسم حج 1447هـ</p>
            </div>
          </div>

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
            workers={options.workers}
            contractors={options.contractors}
            siteMapping={options.siteMapping}
          />

          <div className="section-title">تفاصيل المخالفة</div>
          <label className="multi-select-label">
            اختر نوع/أنواع المخالفة:
            <select name="violationTypeIds" multiple size={9} required>
              {options.violationTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name_ar}
                </option>
              ))}
            </select>
          </label>

          <label>
            ملاحظات إضافية:
            <textarea name="extraNotes" rows={4} />
          </label>

          <div className="notes">
            <p>1- وفقاً لجدول الغرامات المرفق بالعقد سيتم توقيع الغرامات الواردة بالعقد.</p>
            <p>2- الإشعار من أصل يرسل للحسابات والصورة لمندوب المقاول ويوقع بالاستلام.</p>
            <p>3- في حال عدم حضور أو رفض مندوب المقاول التوقيع يتم إثبات الرفض على الإشعار.</p>
            <p>4- يتم إرسال صورة الإشعار على الجروب المخصص للأعمال.</p>
          </div>

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

          <div className="no-print save-wrap">
            <Button type="submit">حفظ إشعار المخالفة</Button>
          </div>
        </form>
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
        .section-title {
          text-align: center;
          font-size: 30px;
          font-weight: 800;
          border-top: 1px solid #111;
          border-bottom: 1px solid #111;
          margin: 12px 0 10px;
          padding: 6px 0;
        }
        .multi-select-label select {
          min-height: 230px;
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
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .paper-card {
            max-width: 100% !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .paper-form {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            box-sizing: border-box;
            border: 1px solid #111;
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
