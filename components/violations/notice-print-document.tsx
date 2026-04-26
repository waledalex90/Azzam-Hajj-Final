import { BrandLogo } from "@/components/branding/brand-logo";
import type { ViolationTypeOption } from "@/lib/types/db";
import type { NoticeSiteKey } from "@/lib/data/violations";
import { sortNoticeViolationTypesForDisplay } from "@/lib/violations/notice-violation-catalog";

/** بيانات جاهزة للطباعة — نصوص فقط، بدون حقول إدخال */
export type NoticePrintData = {
  date: string;
  time: string;
  noticeNo: string;
  siteKey: NoticeSiteKey;
  complexNo: string;
  contractorName: string;
  supervisorName: string;
  workerLabel: string;
  delegateName: string;
  extraNotes: string;
  violationTypeIds: number[];
};

const SITE_LABELS: Record<NoticeSiteKey, string> = {
  mina: "منى",
  arafat: "عرفات",
  muzdalifah: "مزدلفة",
};

type Props = {
  data: NoticePrintData;
  violationTypes: ViolationTypeOption[];
};

/**
 * نموذج إشعار مخالفة للطباعة فقط: جداول، شعار، مربعات ✓ للمخالفات المختارة،
 * دون قوائم منسدلة أو حقول — نصوص مطبوعة فقط.
 */
export function NoticePrintDocument({ data, violationTypes }: Props) {
  const selected = new Set(data.violationTypeIds);
  const complexDisplay = data.complexNo.trim() || "—";
  const orderedTypes = sortNoticeViolationTypesForDisplay(violationTypes);

  return (
    <div className="np-print-root" dir="rtl">
      <div className="np-header np-print-header">
        <div className="np-titles">
          <h1 className="np-main-title">إشعار مخالفة</h1>
          <p className="np-sub-title">مشاريع دورات المياه موسم حج 1447هـ</p>
        </div>
        <div className="np-logo">
          <BrandLogo priority surface="document" className="np-logo-img" />
        </div>
      </div>

      <table className="np-table np-meta">
        <tbody>
          <tr>
            <td className="np-td">
              <span className="np-inline-label">التاريخ:</span>
              <span className="np-print-value">{data.date || "—"}</span>
            </td>
            <td className="np-td">
              <span className="np-inline-label">الوقت:</span>
              <span className="np-print-value">{data.time || "—"}</span>
            </td>
            <td className="np-td">
              <span className="np-inline-label">رقم الإشعار:</span>
              <span className="np-print-value">{data.noticeNo || "—"}</span>
            </td>
            <td className="np-td">
              <span className="np-inline-label">رقم:</span>
              <span className="np-print-value">{data.noticeNo || "—"}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="np-table np-site">
        <tbody>
          <tr>
            <td className="np-td np-site-cell" colSpan={4}>
              <span className="np-inline-label np-site-heading">الموقع (المشعر):</span>
              <div className="np-site-radios">
                {(["mina", "arafat", "muzdalifah"] as const).map((key) => (
                  <span key={key} className="np-print-site-item">
                    <span className="np-paper-sq">{data.siteKey === key ? "✓" : ""}</span>
                    {SITE_LABELS[key]}
                  </span>
                ))}
              </div>
              <span className="np-inline-label np-complex-wrap">
                مجمع رقم:
                <span className="np-print-value np-complex-print">{complexDisplay}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="np-table np-personnel">
        <tbody>
          <tr>
            <td className="np-td np-person-half">
              <div className="np-block-label">بيانات المقاول:</div>
              <div className="np-dashed-line np-print-line">{data.contractorName || "—"}</div>
            </td>
            <td className="np-td np-person-half">
              <div className="np-block-label">اسم مشرف المقاول:</div>
              <div className="np-dashed-line np-print-line">{data.supervisorName || "—"}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="np-table">
        <tbody>
          <tr>
            <td className="np-td">
              <div className="np-block-label">العامل:</div>
              <div className="np-dashed-line np-print-line">{data.workerLabel || "—"}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="np-violation-sheet">
        <div className="np-section-title">تفاصيل المخالفة</div>
        <div className="np-violation-list">
          {orderedTypes.map((t) => {
            const on = selected.has(t.id);
            return (
              <div key={t.id} className="np-viol-row">
                <span className="np-paper-cb np-paper-cb-static" aria-hidden>
                  {on ? "✓" : ""}
                </span>
                <span className="np-viol-text">{t.name_ar}</span>
              </div>
            );
          })}
        </div>
        <div className="np-violation-extra-lines" />
      </div>

      {data.extraNotes.trim() ? (
        <table className="np-table">
          <tbody>
            <tr>
              <td className="np-td">
                <div className="np-block-label">بيان إضافي:</div>
                <div className="np-print-notes">{data.extraNotes.trim()}</div>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}

      <div className="np-legal-notes">
        <p className="np-legal-title">ملاحظات إضافية:</p>
        <p>1- وفقاً لجدول الغرامات المرفق بالعقد سيتم توقيع الغرامات الواردة بالعقد.</p>
        <p>2- الإشعار من أصل يرسل للحسابات والصورة لمندوب المقاول ويوقع بالاستلام.</p>
        <p>3- في حال عدم حضور أو رفض مندوب المقاول التوقيع يتم إثبات الرفض على الإشعار.</p>
        <p>4- يتم إرسال صورة الإشعار على الجروب المخصص للأعمال.</p>
      </div>

      {data.delegateName.trim() ? (
        <table className="np-table">
          <tbody>
            <tr>
              <td className="np-td np-td-inline">
                <span className="np-inline-label">اسم المندوب:</span>
                <span className="np-print-value np-print-inline-name">{data.delegateName.trim()}</span>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}

      <div className="np-sign-grid np-print-signatures">
        <div className="np-sign-col">
          <p className="np-sign-h">المشرف:</p>
          <p className="np-sign-line">
            الاسم:{" "}
            {data.supervisorName.trim() ? (
              <strong className="np-print-sig-name">{data.supervisorName.trim()}</strong>
            ) : (
              <span className="np-print-sig-blank">..............................................</span>
            )}
          </p>
          <p className="np-sign-line">التوقيع: ............................................</p>
        </div>
        <div className="np-sign-col">
          <p className="np-sign-h">المندوب:</p>
          <p className="np-sign-line">
            الاسم:{" "}
            {data.delegateName.trim() ? (
              <strong className="np-print-sig-name">{data.delegateName.trim()}</strong>
            ) : (
              <span className="np-print-sig-blank">..............................................</span>
            )}
          </p>
          <p className="np-sign-line">التوقيع: ............................................</p>
        </div>
      </div>
    </div>
  );
}
