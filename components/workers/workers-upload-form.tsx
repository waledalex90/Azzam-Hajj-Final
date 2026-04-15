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
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center rounded bg-[#0f766e] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0b5f59] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "جاري رفع الملف..." : "رفع الملف"}
    </button>
  );
}

export function WorkersUploadForm({ action }: Props) {
  return (
    <form action={action} className="flex items-center gap-2">
      <Input type="file" name="file" accept=".xlsx,.xls,.csv" required />
      <SubmitUploadButton />
    </form>
  );
}
