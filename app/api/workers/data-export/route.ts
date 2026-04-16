import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { loadAppUserWithRole } from "@/lib/auth/resolve-app-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const CHUNK = 1000;

function shiftLabel(shift: number | null) {
  if (shift === 1) return "صباحي";
  if (shift === 2) return "مسائي";
  return "";
}

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUser = await loadAppUserWithRole(user.id);
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const out: Array<Record<string, string | number>> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("workers")
      .select("name, id_number, job_title, payment_type, basic_salary, iqama_expiry, shift_round, is_active, is_deleted, sites(name), contractors(name)")
      .order("id", { ascending: true })
      .range(from, from + CHUNK - 1);
    if (error) {
      return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
    }
    const chunk = (data ?? []) as Array<{
      name: string;
      id_number: string;
      job_title: string | null;
      payment_type: string;
      basic_salary: number | null;
      iqama_expiry: string | null;
      shift_round: number | null;
      is_active: boolean;
      is_deleted: boolean;
      sites?: { name: string } | { name: string }[] | null;
      contractors?: { name: string } | { name: string }[] | null;
    }>;
    for (const w of chunk) {
      const site = Array.isArray(w.sites) ? w.sites[0] : w.sites;
      const con = Array.isArray(w.contractors) ? w.contractors[0] : w.contractors;
      const status = w.is_deleted || !w.is_active ? "غير نشط" : "نشط";
      out.push({
        الاسم: w.name,
        "رقم الهوية/الإقامة/الجواز": w.id_number,
        "المسمى الوظيفي": w.job_title ?? "",
        المقاول: con?.name ?? "",
        الموقع: site?.name ?? "",
        الوردية: shiftLabel(w.shift_round),
        "نظام الدفع": w.payment_type === "daily" ? "راتب يومي" : "راتب شهري",
        الراتب: w.basic_salary != null ? w.basic_salary : "",
        "تاريخ انتهاء الإقامة": w.iqama_expiry ?? "",
        الحالة: status,
      });
    }
    if (chunk.length < CHUNK) break;
    from += CHUNK;
  }

  const headers = [
    "الاسم",
    "رقم الهوية/الإقامة/الجواز",
    "المسمى الوظيفي",
    "المقاول",
    "الموقع",
    "الوردية",
    "نظام الدفع",
    "الراتب",
    "تاريخ انتهاء الإقامة",
    "الحالة",
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(out, { header: headers });
  XLSX.utils.book_append_sheet(workbook, sheet, "العمال");
  const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="workers-data-export.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
