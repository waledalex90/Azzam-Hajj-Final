"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";

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

export function WorkersUploadForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSuccessPayload | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setResult(null);

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file || file.size === 0) {
      setErrorMessage("اختر ملف Excel قبل الرفع.");
      return;
    }

    const body = new FormData();
    body.set("file", file, file.name);

    setPending(true);
    try {
      const response = await fetch("/api/workers/import", {
        method: "POST",
        body,
        credentials: "same-origin",
      });

      const data = (await response.json().catch(() => ({}))) as ImportSuccessPayload | ImportErrorPayload;

      if (!response.ok) {
        const err = "error" in data ? data.error : "فشل الرفع";
        const detail = "detail" in data && typeof data.detail === "string" ? data.detail : "";
        if (response.status === 401) {
          setErrorMessage("يجب تسجيل الدخول أولاً.");
        } else if (response.status === 403) {
          setErrorMessage(err === "demo_mode" ? "وضع التجربة مفعل ولا يُسمح بالرفع." : "ليس لديك صلاحية لاستيراد الموظفين.");
        } else if (response.status === 400) {
          const code = typeof err === "string" ? err : "";
          const map: Record<string, string> = {
            file_required: "الملف مفقود أو فارغ. تأكد من اختيار ملف صالح.",
            "Invalid form data": "تعذر قراءة النموذج (multipart). جرّب ملفًا أصغر أو تحقق من الشبكة.",
            sheet_missing: "لا يوجد ورقة عمل داخل الملف.",
            sheet_empty: "الورقة الأولى لا تحتوي بيانات.",
          };
          const base = map[code] ?? (typeof err === "string" ? err : "طلب غير صالح (400).");
          setErrorMessage(detail ? `${base} (${detail})` : base);
        } else {
          setErrorMessage(
            detail ? `${typeof err === "string" ? err : "خطأ"}: ${detail}` : typeof err === "string" ? err : "حدث خطأ أثناء معالجة الملف.",
          );
        }
        return;
      }

      if ("ok" in data && data.ok) {
        setResult({
          ok: true,
          inserted: data.inserted ?? 0,
          updated: data.updated ?? 0,
          skipped: data.skipped ?? 0,
          skippedRows: Array.isArray(data.skippedRows) ? data.skippedRows : [],
          processed: data.processed,
          message: data.message,
        });
        router.refresh();
        if (fileInput) fileInput.value = "";
      } else {
        setErrorMessage("استجابة غير متوقعة من السيرفر.");
      }
    } catch {
      setErrorMessage("تعذر الاتصال بالسيرفر. تحقق من الشبكة وحاول مجددًا.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
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

      {errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{errorMessage}</p>
      )}

      {result && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-900">
          <p>
            اكتمل الاستيراد: <span className="text-emerald-800">جديد {result.inserted}</span>،{" "}
            <span className="text-emerald-800">محدّث {result.updated}</span>،{" "}
            <span className="text-amber-800">متخطى {result.skipped}</span>
            {result.processed !== undefined ? ` (معالَج ${result.processed} صفًا صالحًا)` : ""}
          </p>
          {result.message && <p className="font-normal text-emerald-800">{result.message}</p>}

          {result.skipped > 0 && result.skippedRows.length > 0 && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-amber-200 bg-white">
              <p className="border-b border-amber-100 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                صفوف تحتاج تعديل (مرفوضة مؤقتًا):
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
