"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { ContractorOption, WorkerRow } from "@/lib/types/db";

type Props = {
  workers: WorkerRow[];
  contractors: ContractorOption[];
  siteMapping: {
    minaSiteId: number | null;
    arafatSiteId: number | null;
    muzdalifahSiteId: number | null;
  };
  /** عرض إشعار محفوظ للطباعة فقط */
  mode?: "edit" | "view";
  initial?: {
    workerId: string;
    contractorId: string;
    siteKey: SiteKey;
  };
  /** عند mode=view يُفضَّل تمرير النصوص الجاهزة بدل القوائم */
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
  const [workerId, setWorkerId] = useState<string>(initial?.workerId ?? "");
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

  const workerMap = useMemo(() => {
    const map = new Map<number, WorkerRow>();
    workers.forEach((worker) => map.set(worker.id, worker));
    return map;
  }, [workers]);

  const [workerFilter, setWorkerFilter] = useState("");

  const filteredWorkers = useMemo(() => {
    const s = workerFilter.trim().toLowerCase();
    if (!s) return workers;
    return workers.filter(
      (w) => w.name.toLowerCase().includes(s) || (w.id_number && w.id_number.includes(s)),
    );
  }, [workers, workerFilter]);

  const displayWorkers = useMemo(() => {
    const list = filteredWorkers;
    if (!workerId) return list;
    const wid = Number(workerId);
    const chosen = workerMap.get(wid);
    if (chosen && !list.some((w) => w.id === chosen.id)) {
      return [chosen, ...list];
    }
    return list;
  }, [filteredWorkers, workerId, workerMap]);

  function handleWorkerChange(nextWorkerId: string) {
    setWorkerId(nextWorkerId);
    const numericWorkerId = Number(nextWorkerId);
    if (!numericWorkerId) return;
    const worker = workerMap.get(numericWorkerId);
    if (!worker) return;
    if (worker.contractor_id) {
      setContractorId(String(worker.contractor_id));
    }
    const key = mapSiteIdToKey(worker.current_site_id, siteMapping);
    if (key) setSiteKey(key);
  }

  return (
    <div className="notice-linked-block space-y-2">
      <div className="no-print">
        <label className="block text-xs font-bold text-slate-800">بحث فوري عن العامل</label>
        <Input
          type="search"
          value={workerFilter}
          onChange={(e) => setWorkerFilter(e.target.value)}
          placeholder="اسم أو رقم هوية…"
          className="mt-1 max-w-md border border-black"
          autoComplete="off"
        />
        <p className="mt-0.5 text-xs text-slate-600">
          يظهر {displayWorkers.length} من أصل {workers.length} — استخدم «تطبيق البحث» أعلى الصفحة لتحميل المزيد من الخادم
        </p>
      </div>
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
        <select
          name="workerId"
          required={!isView}
          disabled={isView}
          value={workerId}
          onChange={(e) => handleWorkerChange(e.target.value)}
        >
          <option value="" disabled>
            اختر العامل
          </option>
          {displayWorkers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name} - {worker.id_number}
            </option>
          ))}
        </select>
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
    </div>
  );
}
