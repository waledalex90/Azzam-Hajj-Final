import type { NoticeSiteKey } from "@/lib/data/violations";

/** بيانات جاهزة لملف PDF / المعاينة — منفصلة عن واجهة الويب */
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
