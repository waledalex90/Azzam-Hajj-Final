"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";

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

/** الموقع + مجمع + مقاول (قراءة فقط بعد الربط) + مشرف + عامل — مزامنة من العامل + تأكيد من الخادم */
export function NoticeOfficialPaperFields({ workers, contractors, siteMapping, defaultSiteKey }: Props) {
  const [siteKey, setSiteKey] = useState<NoticeSiteKey>(defaultSiteKey);
  const [contractorId, setContractorId] = useState("");
  const [contractorLabel, setContractorLabel] = useState("");
  const [contractorLoading, setContractorLoading] = useState(false);

  const sites: { key: NoticeSiteKey; label: string }[] = [
    { key: "mina", label: "منى" },
    { key: "arafat", label: "عرفات" },
    { key: "muzdalifah", label: "مزدلفة" },
  ];

  const applyContractor = useCallback((id: number | null, name: string | null) => {
    if (id != null && Number.isFinite(id) && id > 0) {
      setContractorId(String(id));
      setContractorLabel(name?.trim() || contractors.find((c) => c.id === id)?.name || `مقاول #${id}`);
    } else {
      setContractorId("");
      setContractorLabel("");
    }
  }, [contractors]);

  const refreshContractorFromApi = useCallback(
    async (workerId: number) => {
      setContractorLoading(true);
      try {
        const res = await fetch(`/api/violations/notice/worker-contractor?workerId=${workerId}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          contractorId?: number | null;
          contractorName?: string | null;
          currentSiteId?: number | null;
        };
        if (!res.ok) {
          applyContractor(null, null);
          return;
        }
        applyContractor(data.contractorId ?? null, data.contractorName ?? null);
        const k = mapSiteIdToKey(data.currentSiteId, siteMapping);
        if (k) setSiteKey(k);
      } catch {
        applyContractor(null, null);
      } finally {
        setContractorLoading(false);
      }
    },
    [applyContractor, siteMapping],
  );

  function onPickWorker(w: WorkerRow) {
    if (w.contractor_id) {
      const nm = w.contractors?.name ?? contractors.find((c) => c.id === w.contractor_id)?.name ?? null;
      applyContractor(w.contractor_id, nm);
    } else {
      applyContractor(null, null);
    }
    const k = mapSiteIdToKey(w.current_site_id, siteMapping);
    if (k) setSiteKey(k);
    void refreshContractorFromApi(w.id);
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
            <td className="np-td np-person-half" id="notice-field-contractor">
              <div className="np-block-label flex flex-wrap items-center gap-2">
                بيانات المقاول:
                {contractorLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-600" aria-label="جاري جلب المقاول" />
                ) : null}
              </div>
              <input type="hidden" name="contractorId" value={contractorId} />
              <div
                className="np-field np-field-plain min-h-[34px] bg-slate-50 text-slate-800"
                aria-live="polite"
              >
                {contractorLabel || (contractorLoading ? "…" : "— اختر العامل أولاً —")}
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-600">
                يُحدَّد تلقائياً من بطاقة العامل؛ لا يمكن تعديله يدوياً لتفادي الخطأ.
              </p>
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
            <td className="np-td" id="notice-field-worker">
              <div className="np-block-label">العامل:</div>
              <NoticeWorkerCombobox workers={workers} onPickWorker={onPickWorker} required />
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
