"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import * as XLSX from "xlsx";

import { Input } from "@/components/ui/input";

const CHUNK_SIZE = 200;

type SkippedRow = {
  rowIndex: number;
  reason: string;
  id_number?: string;
};

type ImportSuccessPayload = {
  ok: true;
  inserted: number;
  updated: number;
  skipped: number;
  skippedRows: SkippedRow[];
  processed?: number;
  message?: string;
};

type ImportErrorPayload = {
  error: string;
  detail?: string;
};

function adjustSkippedToOriginalSheet(
  rows: SkippedRow[],
  chunkIndex: number,
  chunkSize: number,
): SkippedRow[] {
  const offset = chunkIndex * chunkSize;
  return rows.map((row) => ({
    ...row,
    rowIndex: offset + row.rowIndex,
  }));
}

export function WorkersUploadForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [chunkLabel, setChunkLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSuccessPayload | null>(null);

  function applyErrorFromResponse(response: Response, data: ImportErrorPayload | Record<string, unknown>) {
    const err = "error" in data && typeof data.error === "string" ? data.error : "فشل الرفع";
    const detail = "detail" in data && typeof data.detail === "string" ? data.detail : "";
    if (response.status === 401) {
      setErrorMessage("يجب تسجيل الدخول أولاً.");
    } else if (response.status === 403) {
      setErrorMessage(err === "demo_mode" ? "وضع التجربة مفعل ولا يُسمح بالرفع." : "ليس لديك صلاحية لاستيراد الموظفين.");
    } else if (response.status === 400) {
      const map: Record<string, string> = {
        file_required: "الملف مفقود أو فارغ. تأكد من اختيار ملف صالح.",
        "Invalid form data": "تعذر قراءة النموذج (multipart). جرّب ملفًا أصغر أو تحقق من الشبكة.",
        sheet_missing: "لا يوجد ورقة عمل داخل الملف.",
        sheet_empty: "الورقة الأولى لا تحتوي بيانات.",
      };
      const base = map[err] ?? err;
      setErrorMessage(detail ? `${base} (${detail})` : base);
    } else {
      setErrorMessage(
        detail ? `${err}: ${detail}` : err,
      );
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setResult(null);
    setProgressPercent(0);
    setChunkLabel(null);

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file || file.size === 0) {
      setErrorMessage("اختر ملف Excel قبل الرفع.");
      return;
    }

    setPending(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setErrorMessage("لا يوجد Sheet داخل الملف.");
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!records.length) {
        setErrorMessage("الملف لا يحتوي صفوف بيانات.");
        return;
      }

      const totalChunks = Math.ceil(records.length / CHUNK_SIZE);
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      const allSkippedRows: SkippedRow[] = [];
      let totalProcessed = 0;

      for (let c = 0; c < totalChunks; c += 1) {
        const start = c * CHUNK_SIZE;
        const chunkRecords = records.slice(start, start + CHUNK_SIZE);
        if (chunkRecords.length === 0) continue;

        setChunkLabel(`الدفعة ${c + 1} من ${totalChunks} (حتى ${Math.min(start + chunkRecords.length, records.length)} / ${records.length} صف)`);
        setProgressPercent(Math.round((c / totalChunks) * 100));

        const outBook = XLSX.utils.book_new();
        const outSheet = XLSX.utils.json_to_sheet(chunkRecords);
        XLSX.utils.book_append_sheet(outBook, outSheet, "Sheet1");
        const outBuf = XLSX.write(outBook, { type: "array", bookType: "xlsx" });
        const blob = new Blob([outBuf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const body = new FormData();
        body.set("file", blob, `workers-import-part-${c + 1}-of-${totalChunks}.xlsx`);

        const response = await fetch("/api/workers/import", {
          method: "POST",
          body,
          credentials: "same-origin",
        });

        const data = (await response.json().catch(() => ({}))) as ImportSuccessPayload | ImportErrorPayload;

        if (!response.ok) {
          applyErrorFromResponse(response, data);
          setProgressPercent(0);
          setChunkLabel(null);
          return;
        }

        if (!("ok" in data) || !data.ok) {
          setErrorMessage("استجابة غير متوقعة من السيرفر في إحدى الدفعات.");
          setProgressPercent(0);
          setChunkLabel(null);
          return;
        }

        totalInserted += data.inserted ?? 0;
        totalUpdated += data.updated ?? 0;
        totalSkipped += data.skipped ?? 0;
        totalProcessed += data.processed ?? 0;
        const chunkSkipped = Array.isArray(data.skippedRows) ? data.skippedRows : [];
        allSkippedRows.push(...adjustSkippedToOriginalSheet(chunkSkipped, c, CHUNK_SIZE));

        setProgressPercent(Math.round(((c + 1) / totalChunks) * 100));
      }

      setChunkLabel(null);
      setResult({
        ok: true,
        inserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        skippedRows: allSkippedRows,
        processed: totalProcessed,
        message: `تمت معالجة ${totalChunks} دفعة (${records.length} صف في الملف).`,
      });
      router.refresh();
      if (fileInput) fileInput.value = "";
    } catch {
      setErrorMessage("تعذر قراءة الملف أو الاتصال بالسيرفر. تحقق من الشبكة وحاول مجددًا.");
      setProgressPercent(0);
      setChunkLabel(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-[11px] leading-relaxed text-slate-600">
        الصف الأول في الملف = عناوين الأعمدة. يُفضّل استخدام زر «تحميل ملف Excel عربي». عند تطابق رقم الهوية مع سجل موجود يُحدَّث
        الموقع والمقاول و<strong className="text-slate-800">الوردية</strong> (Upsert).
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-2 py-2 text-right font-extrabold text-slate-800">عمود في Excel</th>
              <th className="px-2 py-2 text-right font-extrabold text-slate-800">مطلوب / ملاحظات</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            <tr className="border-b border-slate-100">
              <td className="px-2 py-1.5 font-mono font-bold">الاسم</td>
              <td className="px-2 py-1.5">الاسم الرباعي أو كما يظهر في الهوية.</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-2 py-1.5 font-mono font-bold">رقم الهوية/الإقامة/الجواز</td>
              <td className="px-2 py-1.5">المفتاح للإضافة أو التحديث؛ يجب ألا يتكرر داخل نفس الملف.</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-2 py-1.5 font-mono font-bold">المسمى الوظيفي</td>
              <td className="px-2 py-1.5">اختياري.</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-2 py-1.5 font-mono font-bold">المقاول</td>
              <td className="px-2 py-1.5">اسم مطابق للنظام (اختياري).</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-2 py-1.5 font-mono font-bold">الموقع</td>
              <td className="px-2 py-1.5">تطابق حرفي 100% مع اسم الموقع في النظام.</td>
            </tr>
            <tr className="border-b border-slate-100 bg-emerald-50/50">
              <td className="px-2 py-1.5 font-mono font-bold text-emerald-900">الوردية</td>
              <td className="px-2 py-1.5 text-emerald-950">
                <span className="font-bold">صباحي</span> أو <span className="font-mono">1</span> → وردية صباحية؛{" "}
                <span className="font-bold">مسائي</span> أو <span className="font-mono">2</span> → وردية مسائية. يمكن أيضًا
                استخدام عنوان العمود <span className="font-mono">shift</span>. فارغ = يظهر في كلا الورديتين عند التحضير.
              </td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-2 py-1.5 font-mono font-bold">نظام الدفع / الراتب / تاريخ انتهاء الإقامة</td>
              <td className="px-2 py-1.5">كما في القالب؛ التاريخ بصيغة YYYY-MM-DD.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <form
        onSubmit={onSubmit}
        className="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:w-auto sm:flex-row sm:items-center"
      >
        <Input
          type="file"
          name="file"
          accept=".xlsx,.xls,.csv"
          required
          disabled={pending}
          className="min-h-12 rounded-lg border-slate-200 bg-white"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "جاري رفع الملف..." : "رفع الملف (استيراد / تحديث)"}
        </button>
      </form>

      {pending && (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          {chunkLabel && <p className="text-[11px] font-bold text-slate-700">{chunkLabel}</p>}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-center text-[11px] font-bold text-slate-600">{progressPercent}%</p>
        </div>
      )}

      {errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{errorMessage}</p>
      )}

      {result && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-900">
          <p>
            اكتمل الاستيراد: <span className="text-emerald-800">جديد {result.inserted}</span>،{" "}
            <span className="text-emerald-800">محدّث {result.updated}</span>،{" "}
            <span className="text-amber-800">متخطى {result.skipped}</span>
            {result.processed !== undefined ? ` (معالَج ${result.processed} صفًا صالحًا في الدفعات)` : ""}
          </p>
          {result.message && <p className="font-normal text-emerald-800">{result.message}</p>}

          {result.skipped > 0 && result.skippedRows.length > 0 && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-amber-200 bg-white">
              <p className="border-b border-amber-100 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                صفوف تحتاج تعديل (مرفوضة مؤقتًا) — أرقام الصفوف حسب الملف الأصلي:
              </p>
              <table className="min-w-full text-[11px]">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-2 py-1.5 text-right font-bold"># السطر</th>
                    <th className="px-2 py-1.5 text-right font-bold">رقم الهوية</th>
                    <th className="px-2 py-1.5 text-right font-bold">السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {result.skippedRows.map((row, idx) => (
                    <tr key={`${row.rowIndex}-${idx}`} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-mono">{row.rowIndex}</td>
                      <td className="px-2 py-1.5 font-mono">{row.id_number ?? "—"}</td>
                      <td className="px-2 py-1.5 font-normal text-slate-800">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
