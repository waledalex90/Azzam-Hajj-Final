"use client";

import { useState } from "react";

import { NoticeWorkerCombobox } from "@/components/violations/notice-worker-combobox";
import type { ContractorOption, WorkerRow } from "@/lib/types/db";

type Props = {
  workers: WorkerRow[];
  contractors: ContractorOption[];
  siteMapping: {
    minaSiteId: number | null;
    arafatSiteId: number | null;
    muzdalifahSiteId: number | null;
  };
  mode?: "edit" | "view";
  initial?: {
    workerId: string;
    contractorId: string;
    siteKey: SiteKey;
  };
  viewLabels?: {
    contractorName: string;
    workerLabel: string;
    siteLabel: string;
  };
};

type SiteKey = "mina" | "arafat" | "muzdalifah";

function mapSiteIdToKey(
  siteId: number | null | undefined,
  mapping: Props["siteMapping"],
): SiteKey | null {
  if (!siteId) return null;
  if (siteId === mapping.minaSiteId) return "mina";
  if (siteId === mapping.arafatSiteId) return "arafat";
  if (siteId === mapping.muzdalifahSiteId) return "muzdalifah";
  return null;
}

export function NoticeLinkedSelects({
  workers,
  contractors,
  siteMapping,
  mode = "edit",
  initial,
  viewLabels,
}: Props) {
  const [contractorId, setContractorId] = useState<string>(initial?.contractorId ?? "");
  const [siteKey, setSiteKey] = useState<SiteKey>(initial?.siteKey ?? "mina");
  const isView = mode === "view";

  if (isView && viewLabels) {
    return (
      <div className="paper-grid three notice-view-fields">
        <div className="notice-view-field">
          <span className="notice-view-label">بيانات المقاول:</span>
          <p className="notice-view-value">{viewLabels.contractorName}</p>
        </div>
        <div className="notice-view-field">
          <span className="notice-view-label">العامل:</span>
          <p className="notice-view-value">{viewLabels.workerLabel}</p>
        </div>
        <div className="notice-view-field">
          <span className="notice-view-label">الموقع (المشعر):</span>
          <p className="notice-view-value">{viewLabels.siteLabel}</p>
        </div>
      </div>
    );
  }

  function syncFromWorker(worker: WorkerRow) {
    if (worker.contractor_id) {
      setContractorId(String(worker.contractor_id));
    }
    const key = mapSiteIdToKey(worker.current_site_id, siteMapping);
    if (key) setSiteKey(key);
  }

  return (
    <div className="paper-grid three">
      <label>
        بيانات المقاول:
        <select
          name="contractorId"
          required={!isView}
          disabled={isView}
          value={contractorId}
          onChange={(e) => setContractorId(e.target.value)}
        >
          <option value="" disabled>
            اختر المقاول
          </option>
          {contractors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        العامل:
        <NoticeWorkerCombobox
          workers={workers}
          initialWorkerId={initial?.workerId}
          onPickWorker={(w) => syncFromWorker(w)}
          required
        />
      </label>
      <label>
        الموقع (المشعر):
        <select
          name="siteKey"
          required={!isView}
          disabled={isView}
          value={siteKey}
          onChange={(e) => setSiteKey(e.target.value as SiteKey)}
        >
          <option value="mina">منى</option>
          <option value="arafat">عرفات</option>
          <option value="muzdalifah">مزدلفة</option>
        </select>
      </label>
    </div>
  );
}
