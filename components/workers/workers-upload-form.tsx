"use client";

import { useFormStatus } from "react-dom";

import { Input } from "@/components/ui/input";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

function SubmitUploadButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="operation"
      value="insert"
      disabled={pending}
      className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "جاري الرفع..." : "إضافة من الملف"}
    </button>
  );
}

function SubmitUpdateButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="operation"
      value="update"
      disabled={pending}
      className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "جاري التحديث..." : "تحديث من الملف"}
    </button>
  );
}

export function WorkersUploadForm({ action }: Props) {
  return (
    <form
      action={action}
      className="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:w-auto sm:flex-row sm:items-center"
    >
      <Input
        type="file"
        name="file"
        accept=".xlsx,.xls,.csv"
        required
        className="min-h-12 rounded-lg border-slate-200 bg-white"
      />
      <SubmitUploadButton />
      <SubmitUpdateButton />
    </form>
  );
}
