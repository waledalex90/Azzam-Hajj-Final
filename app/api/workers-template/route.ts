import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET() {
  const headers = [
    "الاسم",
    "رقم الهوية/الإقامة/الجواز",
    "المسمى الوظيفي",
    "المقاول",
    "الموقع",
    "نظام الدفع",
    "الراتب",
    "تاريخ انتهاء الإقامة",
  ];

  const sampleRows = [
    {
      الاسم: "مثال: أحمد محمد علي",
      "رقم الهوية/الإقامة/الجواز": "A123456789",
      "المسمى الوظيفي": "عامل نظافة",
      المقاول: "الزبير",
      الموقع: "الدورات الحديثة - عرفات فرقة (1)",
      "نظام الدفع": "راتب شهري",
      الراتب: 3500,
      "تاريخ انتهاء الإقامة": "2026-12-30",
    },
    {
      الاسم: "مثال: محمود خالد حسن",
      "رقم الهوية/الإقامة/الجواز": "P99887766",
      "المسمى الوظيفي": "سائق",
      المقاول: "الشركة",
      الموقع: "دورات المسار - مزدلفة رضا",
      "نظام الدفع": "راتب يومي",
      الراتب: 180,
      "تاريخ انتهاء الإقامة": "2026-10-15",
    },
  ];

  const workbook = XLSX.utils.book_new();
  const templateSheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  const helpSheet = XLSX.utils.aoa_to_sheet([
    ["تعليمات رفع الموظفين"],
    ["1) اترك الصف الأول كما هو (عناوين الأعمدة بالعربي)."],
    ["2) أدخل كل موظف في صف منفصل."],
    ["3) عمود رقم الهوية/الإقامة/الجواز يجب أن يكون فريدًا (بدون تكرار)."],
    ["4) نظام الدفع يقبل: راتب شهري أو راتب يومي."],
    ["5) تاريخ انتهاء الإقامة بصيغة: YYYY-MM-DD."],
    ["6) اسم المقاول واسم الموقع يجب أن يكونا مطابقين للأسماء الموجودة في النظام."],
  ]);

  XLSX.utils.book_append_sheet(workbook, templateSheet, "قالب الموظفين");
  XLSX.utils.book_append_sheet(workbook, helpSheet, "تعليمات");

  const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="workers-template-ar.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
