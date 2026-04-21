import type { ViolationTypeOption } from "@/lib/types/db";

import { BrandLogo } from "@/components/branding/brand-logo";
import { Input } from "@/components/ui/input";

import type { NoticeSiteKey } from "@/lib/data/violations";

type MetaProps = {
  dateDefault: string;
  timeDefault: string;
  noticeNo: string;
  readOnly?: boolean;
  /** لتمرير التركيز عند التحقق من النموذج */
  dateFieldWrapId?: string;
};

/** الصف العلوي: تاريخ، وقت، رقم إشعار، رقم (عرض فقط — نفس الرقم دون تكرار حقول النموذج) */
export function NoticeOfficialMetaRow({ dateDefault, timeDefault, noticeNo, readOnly, dateFieldWrapId }: MetaProps) {
  return (
    <table className="np-table np-meta">
      <tbody>
        <tr>
          <td className="np-td" id={dateFieldWrapId}>
            <span className="np-inline-label">التاريخ:</span>
            <Input
              name="date"
              type="date"
              readOnly={readOnly}
              defaultValue={dateDefault}
              placeholder="اختر التاريخ"
              className="np-field"
            />
          </td>
          <td className="np-td">
            <span className="np-inline-label">الوقت:</span>
            <Input
              name="time"
              type="time"
              readOnly={readOnly}
              defaultValue={timeDefault}
              placeholder="اختر الوقت"
              className="np-field"
            />
          </td>
          <td className="np-td">
            <span className="np-inline-label">رقم الإشعار:</span>
            <Input name="noticeNo" readOnly={readOnly} defaultValue={noticeNo} className="np-field" />
          </td>
          <td className="np-td">
            <span className="np-inline-label">رقم:</span>
            <span className="np-field np-field-plain">{noticeNo}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

type SiteProps = {
  defaultSiteKey: NoticeSiteKey;
  complexDefault?: string;
  readOnly?: boolean;
};

/** الموقع (المشعر) بثلاث خانات + مجمع — وضع العرض فقط */
export function NoticeOfficialSiteRow({ defaultSiteKey, complexDefault, readOnly }: SiteProps) {
  const sites: { key: NoticeSiteKey; label: string }[] = [
    { key: "mina", label: "منى" },
    { key: "arafat", label: "عرفات" },
    { key: "muzdalifah", label: "مزدلفة" },
  ];
  return (
    <table className="np-table np-site">
      <tbody>
        <tr>
          <td className="np-td np-site-cell" colSpan={4}>
            <span className="np-inline-label np-site-heading">الموقع (المشعر):</span>
            <div className="np-site-radios">
              {sites.map((s) => (
                <label key={s.key} className="np-radio-label">
                  <input
                    type="radio"
                    name="siteKey"
                    value={s.key}
                    defaultChecked={defaultSiteKey === s.key}
                    disabled={readOnly}
                    required={!readOnly}
                    className="np-paper-radio"
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
            <span className="np-inline-label np-complex-wrap">
              مجمع رقم:
              <Input
                name="complexNo"
                readOnly={readOnly}
                defaultValue={complexDefault ?? ""}
                className="np-field np-complex-input"
              />
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

type CwProps = {
  readOnly?: boolean;
  viewContractorName?: string;
  viewWorkerLabel?: string;
  supervisorDefault?: string;
};

/** بيانات المقاول | مشرف المقاول | العامل — وضع العرض فقط */
export function NoticeOfficialContractorBlock({ readOnly, viewContractorName, viewWorkerLabel, supervisorDefault }: CwProps) {
  if (!readOnly || !viewContractorName || !viewWorkerLabel) return null;

  return (
    <>
      <table className="np-table np-personnel">
        <tbody>
          <tr>
            <td className="np-td np-person-half">
              <div className="np-block-label">بيانات المقاول:</div>
              <div className="np-dashed-line">{viewContractorName}</div>
            </td>
            <td className="np-td np-person-half">
              <div className="np-block-label">اسم مشرف المقاول:</div>
              <div className="np-dashed-line">{supervisorDefault ?? "—"}</div>
            </td>
          </tr>
        </tbody>
      </table>
      <table className="np-table">
        <tbody>
          <tr>
            <td className="np-td">
              <div className="np-block-label">العامل:</div>
              <div className="np-dashed-line">{viewWorkerLabel}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

type ViolProps = {
  types: ViolationTypeOption[];
  readOnly?: boolean;
  selectedIds?: number[];
  violationsSectionId?: string;
};

/** قائمة المخالفات كالورقة الرسمية — مربع يمين النص */
export function NoticeOfficialViolationList({ types, readOnly, selectedIds, violationsSectionId }: ViolProps) {
  return (
    <div className="np-violation-sheet" id={violationsSectionId}>
      <div className="np-section-title">تفاصيل المخالفة</div>
      <div className="np-violation-list">
        {types.map((t) => {
          const checked = selectedIds ? selectedIds.includes(t.id) : false;
          return (
            <div key={t.id} className="np-viol-row">
              {readOnly ? (
                <span className="np-paper-cb np-paper-cb-static" aria-hidden>
                  {checked ? "✓" : ""}
                </span>
              ) : (
                <input
                  type="checkbox"
                  name="violationTypeIds"
                  value={t.id}
                  className="np-paper-cb"
                  defaultChecked={false}
                />
              )}
              <span className="np-viol-text">{t.name_ar}</span>
            </div>
          );
        })}
      </div>
      <div className="np-violation-extra-lines" />
    </div>
  );
}

export function NoticeOfficialHeader() {
  return (
    <div className="np-header" dir="rtl">
      <div className="np-titles">
        <h1 className="np-main-title">إشعار مخالفة</h1>
        <p className="np-sub-title">مشاريع دورات المياه موسم حج 1447هـ</p>
      </div>
      <div className="np-logo">
        <BrandLogo priority framed={false} className="np-logo-img" />
      </div>
    </div>
  );
}

export function NoticeOfficialNotesBlock() {
  return (
    <div className="np-legal-notes">
      <p className="np-legal-title">ملاحظات إضافية:</p>
      <p>1- وفقاً لجدول الغرامات المرفق بالعقد سيتم توقيع الغرامات الواردة بالعقد.</p>
      <p>2- الإشعار من أصل يرسل للحسابات والصورة لمندوب المقاول ويوقع بالاستلام.</p>
      <p>3- في حال عدم حضور أو رفض مندوب المقاول التوقيع يتم إثبات الرفض على الإشعار.</p>
      <p>4- يتم إرسال صورة الإشعار على الجروب المخصص للأعمال.</p>
    </div>
  );
}

export function NoticeOfficialSignatures() {
  return (
    <div className="np-sign-grid">
      <div className="np-sign-col">
        <p className="np-sign-h">المشرف:</p>
        <p className="np-sign-line">الاسم: ..............................................</p>
        <p className="np-sign-line">التوقيع: ............................................</p>
      </div>
      <div className="np-sign-col">
        <p className="np-sign-h">المندوب:</p>
        <p className="np-sign-line">الاسم: ..............................................</p>
        <p className="np-sign-line">التوقيع: ............................................</p>
      </div>
    </div>
  );
}
