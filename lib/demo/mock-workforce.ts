/** بيانات افتراضية للعرض فقط — لا تُستورد من الإنتاج ولا تُكتب إليه. */

export type DemoWorker = {
  id: number;
  name: string;
  employee_code: string;
  id_number: string;
  job_title: string;
  site: string;
  contractor: string;
  shift: "صباحي" | "مسائي";
  status: "pending" | "present" | "absent";
  review: "none" | "pending" | "confirmed" | "rejected";
};

export const DEMO_SITES = ["موقع الشمال", "موقع الوسط", "موقع الجنوب"] as const;
export const DEMO_CONTRACTORS = ["مقاول الأفق", "مقاول النور"] as const;

export function createDemoWorkers(): DemoWorker[] {
  const names = [
    "خالد التجريبي",
    "سامي النموذجي",
    "ماجد العرض",
    "فهد الاستعراض",
    "يوسف المثال",
    "نادر العينة",
    "باسم الافتراضي",
    "رامي التجربة",
    "وليد النموذج",
    "حسن العرضي",
    "طارق التشغيلي",
    "عماد الميداني",
  ];
  return names.map((name, i) => ({
    id: 9000 + i + 1,
    name,
    employee_code: `EMP-D${String(i + 1).padStart(3, "0")}`,
    id_number: `DEMO${100001 + i}`,
    job_title: i % 3 === 0 ? "مشغل" : i % 3 === 1 ? "فني" : "حارس",
    site: DEMO_SITES[i % DEMO_SITES.length],
    contractor: DEMO_CONTRACTORS[i % DEMO_CONTRACTORS.length],
    shift: i % 2 === 0 ? "صباحي" : "مسائي",
    status: i < 4 ? "pending" : i < 9 ? "present" : "absent",
    review: i < 4 ? "none" : i < 7 ? "pending" : i < 10 ? "confirmed" : "rejected",
  }));
}

export const DEMO_STATS = {
  sites: 3,
  contractors: 2,
  activeWorkers: 12,
  present: 5,
  absent: 3,
  pending: 4,
};
