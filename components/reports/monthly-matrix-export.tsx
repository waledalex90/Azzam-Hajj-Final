"use client";

import { Button } from "@/components/ui/button";

type Row = {
  worker_name: string;
  id_number: string;
  byDay: Record<string, string>;
  /** أيام معادلة (ح=1، ن=0.5) */
  totalEquivalent: string;
};

export function MonthlyMatrixExport(props: {
  rows: Row[];
  dayLabels: string[];
  year: number;
  month: number;
}) {
  const { rows, dayLabels, year, month } = props;

  function download() {
    const header = ["الاسم", "الهوية", ...dayLabels, "الإجمالي (أيام معادلة)"].join(",");
    const lines = rows.map((r) =>
      [
        escapeCsv(r.worker_name),
        escapeCsv(r.id_number),
        ...dayLabels.map((d) => r.byDay[d] ?? "-"),
        escapeCsv(r.totalEquivalent),
      ].join(","),
    );
    const csv = "\uFEFF" + [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-matrix-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" onClick={download} disabled={rows.length === 0}>
      تحميل CSV
    </Button>
  );
}

function escapeCsv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
