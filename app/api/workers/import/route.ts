import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAppUserWithRole } from "@/lib/auth/resolve-app-user";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export const runtime = "nodejs";
/** Allow long-running imports on Vercel (adjust per plan). */
export const maxDuration = 300;

/** Node/Vercel may return a Blob-like upload that is not `instanceof File` — accept any Blob with arrayBuffer(). */
function getFileBlobFromFormData(formData: FormData, fieldName: string): Blob | null {
  const entry = formData.get(fieldName);
  if (!entry || typeof entry !== "object") {
    return null;
  }
  if (typeof (entry as Blob).arrayBuffer !== "function") {
    return null;
  }
  const blob = entry as Blob;
  if (blob.size === 0) {
    return null;
  }
  return blob;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

type ParsedRow = {
  rowIndex: number;
  name: string;
  id_number: string;
  job_title: string | null;
  payment_type: "salary" | "daily";
  basic_salary: number | null;
  iqama_expiry: string | null;
  siteName: string;
  contractorName: string;
};

type SkipEntry = {
  rowIndex: number;
  reason: string;
  id_number?: string;
};

function parseSheetRow(record: Record<string, unknown>, rowIndex: number): ParsedRow | null {
  const name =
    normalizeText(record["name"]) || normalizeText(record["الاسم"]) || normalizeText(record["اسم العامل"]);
  const id_number =
    normalizeText(record["id_number"]) ||
    normalizeText(record["رقم الهوية/الإقامة/الجواز"]) ||
    normalizeText(record["رقم الهوية"]) ||
    normalizeText(record["رقم الإقامة"]) ||
    normalizeText(record["رقم الجواز"]);
  if (!name || !id_number) return null;

  const paymentRaw = normalizeText(record["payment_type"]) || normalizeText(record["نظام الدفع"]);
  const payment_type =
    paymentRaw === "daily" || paymentRaw === "يومي" || paymentRaw === "راتب يومي" ? "daily" : "salary";
  const siteName = normalizeText(record["site"]) || normalizeText(record["الموقع"]);
  const contractorName = normalizeText(record["contractor"]) || normalizeText(record["المقاول"]);
  const iqama = normalizeText(record["iqama_expiry"]) || normalizeText(record["تاريخ انتهاء الإقامة"]);
  const salaryRaw = Number(record["basic_salary"] ?? record["الراتب"] ?? 0);

  return {
    rowIndex,
    name,
    id_number,
    job_title: normalizeText(record["job_title"]) || normalizeText(record["المسمى الوظيفي"]) || null,
    payment_type,
    basic_salary: Number.isFinite(salaryRaw) && salaryRaw > 0 ? salaryRaw : null,
    iqama_expiry: /^\d{4}-\d{2}-\d{2}$/.test(iqama) ? iqama : null,
    siteName,
    contractorName,
  };
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = request.headers.get("content-length") ?? "unknown";
  console.log("[workers/import] POST", { contentType: contentType.slice(0, 80), contentLength });

  if (isDemoModeEnabled()) {
    return NextResponse.json({ error: "demo_mode" }, { status: 403 });
  }

  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const appUser = await loadAppUserWithRole(user.id);

  if (!appUser || !hasPermission(appUser, PERM.WORKERS_IMPORT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (parseError) {
    console.error("[workers/import] formData parse failed", parseError);
    return NextResponse.json(
      {
        error: "Invalid form data",
        detail: parseError instanceof Error ? parseError.message : String(parseError),
      },
      { status: 400 },
    );
  }

  const formKeys = [...formData.keys()];
  console.log("[workers/import] form keys:", formKeys);

  const fileBlob = getFileBlobFromFormData(formData, "file");
  if (!fileBlob) {
    console.warn("[workers/import] missing or empty file field", {
      hasFileKey: formData.has("file"),
      firstKeySample: formKeys[0],
    });
    return NextResponse.json(
      {
        error: "file_required",
        detail: "Expected multipart field \"file\" with a non-empty file. Use FormData and do not set Content-Type manually.",
      },
      { status: 400 },
    );
  }

  const buffer = await fileBlob.arrayBuffer();
  console.log("[workers/import] file bytes:", buffer.byteLength);

  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    console.warn("[workers/import] workbook has no sheets");
    return NextResponse.json({ error: "sheet_missing", detail: "No worksheet found in the file." }, { status: 400 });
  }

  const sheet = workbook.Sheets[firstSheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!records.length) {
    console.warn("[workers/import] first sheet has no data rows");
    return NextResponse.json({ error: "sheet_empty", detail: "The first sheet contains no data rows." }, { status: 400 });
  }

  const [sitesRes, contractorsRes] = await Promise.all([
    supabase.from("sites").select("id, name"),
    supabase.from("contractors").select("id, name"),
  ]);

  const sitesByName = new Map(
    ((sitesRes.data ?? []) as { id: number; name: string }[]).map((item) => [item.name.trim(), item.id]),
  );
  const contractorsByName = new Map(
    ((contractorsRes.data ?? []) as { id: number; name: string }[]).map((item) => [item.name.trim(), item.id]),
  );

  const skipped: SkipEntry[] = [];
  const seenInFile = new Set<string>();
  const toUpsert: Array<{
    name: string;
    id_number: string;
    job_title: string | null;
    payment_type: "salary" | "daily";
    basic_salary: number | null;
    iqama_expiry: string | null;
    current_site_id: number;
    contractor_id: number | null;
    is_active: boolean;
    is_deleted: boolean;
  }> = [];

  for (let i = 0; i < records.length; i += 1) {
    const rowIndex = i + 2;
    const parsed = parseSheetRow(records[i] ?? {}, rowIndex);
    if (!parsed) {
      skipped.push({ rowIndex, reason: "الاسم أو رقم الهوية ناقص" });
      continue;
    }

    if (seenInFile.has(parsed.id_number)) {
      skipped.push({ rowIndex, reason: "رقم الهوية مكرر داخل الملف", id_number: parsed.id_number });
      continue;
    }
    seenInFile.add(parsed.id_number);

    if (!parsed.siteName) {
      skipped.push({ rowIndex, reason: "الموقع ناقص", id_number: parsed.id_number });
      continue;
    }

    const siteId = sitesByName.get(parsed.siteName);
    if (siteId === undefined) {
      skipped.push({
        rowIndex,
        reason: "الموقع غير مطابق (مطلوب تطابق حرفي 100% مع اسم الموقع في النظام)",
        id_number: parsed.id_number,
      });
      continue;
    }

    const contractorId = parsed.contractorName
      ? (contractorsByName.get(parsed.contractorName) ?? null)
      : null;

    toUpsert.push({
      name: parsed.name,
      id_number: parsed.id_number,
      job_title: parsed.job_title,
      payment_type: parsed.payment_type,
      basic_salary: parsed.basic_salary,
      iqama_expiry: parsed.iqama_expiry,
      current_site_id: siteId,
      contractor_id: contractorId,
      is_active: true,
      is_deleted: false,
    });
  }

  if (toUpsert.length === 0) {
    return NextResponse.json({
      ok: true,
      inserted: 0,
      updated: 0,
      skipped: skipped.length,
      skippedRows: skipped,
      message: "لا توجد صفوف صالحة للمعالجة",
    });
  }

  const idNumbers = toUpsert.map((r) => r.id_number);
  const { data: existingRows, error: existingError } = await supabase
    .from("workers")
    .select("id_number")
    .in("id_number", idNumbers);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingSet = new Set(
    ((existingRows ?? []) as { id_number: string }[]).map((r) => String(r.id_number).trim()),
  );

  const { error: upsertError } = await supabase.from("workers").upsert(toUpsert, {
    onConflict: "id_number",
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  let inserted = 0;
  let updated = 0;
  for (const row of toUpsert) {
    if (existingSet.has(row.id_number)) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    inserted,
    updated,
    skipped: skipped.length,
    skippedRows: skipped,
    processed: toUpsert.length,
  });
}
