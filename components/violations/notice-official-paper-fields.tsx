"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { NoticeWorkerCombobox } from "@/components/violations/notice-worker-combobox";
import type { NoticeSiteKey } from "@/lib/data/violations";
import type { ContractorOption, WorkerRow } from "@/lib/types/db";

type SiteMapping = {
  minaSiteId: number | null;
  arafatSiteId: number | null;
  muzdalifahSiteId: number | null;
};

function mapSiteIdToKey(
  siteId: number | null | undefined,
  mapping: SiteMapping,
): NoticeSiteKey | null {
  if (!siteId) return null;
  if (siteId === mapping.minaSiteId) return "mina";
  if (siteId === mapping.arafatSiteId) return "arafat";
  if (siteId === mapping.muzdalifahSiteId) return "muzdalifah";
  return null;
}

type Props = {
  workers: WorkerRow[];
  contractors: ContractorOption[];
  siteMapping: SiteMapping;
  defaultSiteKey: NoticeSiteKey;
};

/** الموقع + مجمع + مقاول + مشرف + عامل — مزامنة من العامل */
export function NoticeOfficialPaperFields({ workers, contractors, siteMapping, defaultSiteKey }: Props) {
  const [siteKey, setSiteKey] = useState<NoticeSiteKey>(defaultSiteKey);
  const [contractorId, setContractorId] = useState("");

  const sites: { key: NoticeSiteKey; label: string }[] = [
    { key: "mina", label: "منى" },
    { key: "arafat", label: "عرفات" },
    { key: "muzdalifah", label: "مزدلفة" },
  ];

  function onPickWorker(w: WorkerRow) {
    if (w.contractor_id) {
      setContractorId(String(w.contractor_id));
    }
    const k = mapSiteIdToKey(w.current_site_id, siteMapping);
    if (k) setSiteKey(k);
  }

  return (
    <>
      <input type="hidden" name="siteKey" value={siteKey} />

      <table className="np-table np-site">
        <tbody>
          <tr>
            <td className="np-td np-site-cell" colSpan={4}>
              <span className="np-inline-label np-site-heading">الموقع (المشعر):</span>
              <div className="np-site-radios">
                {sites.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`np-site-pill ${siteKey === s.key ? "np-site-pill-on" : ""}`}
                    onClick={() => setSiteKey(s.key)}
                  >
                    <span className="np-paper-sq">{siteKey === s.key ? "✓" : ""}</span>
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="np-inline-label np-complex-wrap">
                مجمع رقم:
                <Input name="complexNo" className="np-field np-complex-input" />
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
              <select
                name="contractorId"
                className="np-field np-select"
                required
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
              >
                <option value="" disabled>
                  اختر المقاول
                </option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </td>
            <td className="np-td np-person-half">
              <div className="np-block-label">اسم مشرف المقاول:</div>
              <Input name="supervisorName" className="np-field" />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="np-table">
        <tbody>
          <tr>
            <td className="np-td">
              <div className="np-block-label">العامل:</div>
              <NoticeWorkerCombobox workers={workers} onPickWorker={onPickWorker} required />
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
