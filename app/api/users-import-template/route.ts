import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_ROWS = 500;

export async function GET() {
  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.MANAGE_USERS)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: roleRows } = await supabase.from("user_roles").select("slug").order("slug");
  const { data: siteRows } = await supabase.from("sites").select("id, name").order("name");

  const slugs =
    roleRows && roleRows.length > 0
      ? roleRows.map((r) => String(r.slug ?? "").trim()).filter(Boolean)
      : [];
  const sites = siteRows ?? [];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Azzam Hajj System";

  const usersSheet = wb.addWorksheet("Users", {
    views: [{ rightToLeft: true }],
  });

  const listRoles = wb.addWorksheet("ListRoles", { state: "veryHidden" });
  listRoles.getCell(1, 1).value = "slug";
  listRoles.getCell(1, 1).font = { bold: true };
  slugs.forEach((slug, i) => {
    listRoles.getCell(i + 2, 1).value = slug;
  });
  const roleLastRow = Math.max(2 + slugs.length - 1, 2);
  const roleRange = `ListRoles!$A$2:$A$${roleLastRow}`;

  const listSites = wb.addWorksheet("ListSites", { state: "veryHidden" });
  listSites.getCell(1, 1).value = "id";
  listSites.getCell(1, 2).value = "name";
  listSites.getRow(1).font = { bold: true };
  sites.forEach((s, i) => {
    const row = i + 2;
    listSites.getCell(row, 1).value = s.id as number;
    listSites.getCell(row, 2).value = s.name as string;
  });
  const siteLastRow = Math.max(2 + sites.length - 1, 2);
  const siteRange = `ListSites!$A$2:$A$${siteLastRow}`;

  const headers = [
    "full_name",
    "username",
    "password",
    "role",
    "login_email",
    "site_id_1",
    "site_id_2",
    "site_id_3",
    "site_ids",
  ];

  headers.forEach((h, i) => {
    const c = usersSheet.getCell(1, i + 1);
    c.value = h;
    c.font = { bold: true };
  });

  usersSheet.getCell(2, 1).value = "مثال: أحمد محمد";
  usersSheet.getCell(2, 2).value = "ahmed_m";
  usersSheet.getCell(2, 3).value = "TempPass1";
  usersSheet.getCell(2, 4).value = slugs[0] ?? "hr";
  usersSheet.getCell(2, 5).value = "";

  for (let r = 2; r <= DATA_ROWS; r++) {
    usersSheet.getCell(r, 4).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`=${roleRange}`],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "دور غير مسموح",
      error: "اختر قيمة من القائمة (معرّف الدور بالإنجليزية).",
    };

    if (sites.length > 0) {
      for (const col of [6, 7, 8] as const) {
        usersSheet.getCell(r, col).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`=${siteRange}`],
          showErrorMessage: true,
          errorStyle: "warning",
          errorTitle: "معرّف موقع",
          error: "اختر رقم الموقع من القائمة أو اترك الخلية فارغة.",
        };
      }
    }
  }

  usersSheet.getColumn(1).width = 22;
  usersSheet.getColumn(2).width = 16;
  usersSheet.getColumn(3).width = 18;
  usersSheet.getColumn(4).width = 22;
  usersSheet.getColumn(5).width = 28;
  usersSheet.getColumn(6).width = 12;
  usersSheet.getColumn(7).width = 12;
  usersSheet.getColumn(8).width = 12;
  usersSheet.getColumn(9).width = 28;

  const help = wb.addWorksheet("تعليمات", { views: [{ rightToLeft: true }] });
  const lines = [
    ["تعليمات استيراد المستخدمين"],
    [""],
    ["1) ورقة العمل الأولى يجب أن تسمى Users وتبقى أول ملف (لا تنقلها)."],
    ["2) اترك صف العناوين في الصف 1 كما هو."],
    ["3) عمود role: قائمة منسدلة بمعرّفات الأدوار (مثل hr، admin)."],
    ["4) أعمدة site_id_1 و site_id_2 و site_id_3: قوائم منسدلة لمعرّف الموقع (رقم)."],
    ["5) عمود site_ids (اختياري): عدة أرقام في خلية واحدة مفصولة بفاصلة أو مسافة."],
    ["6) عمود login_email اختياري؛ إن تُرك يُبنى من اسم الدخول والنطاق الافتراضي."],
    ["7) احذف صف المثال قبل الإنتاج أو غيّر بياناته."],
    ["8) بعد التعبئة استخدم «رفع واستيراد» في صفحة المستخدمين."],
  ];
  lines.forEach((row, i) => {
    help.getCell(i + 1, 1).value = row[0];
  });
  help.getColumn(1).width = 92;

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="users-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
