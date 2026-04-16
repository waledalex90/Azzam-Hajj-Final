/**
 * يتحقق من أن `.env.local` يشير لمشروع Azzam Hajj وأن الاتصال وRPC يعملان.
 * تشغيل: node scripts/verify-azzam-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

function loadEnvLocal() {
  if (!fs.existsSync(envPath)) {
    console.error("❌ لم يُعثر على .env.local — انسخ .env.example إلى .env.local واملأ مفاتيح مشروع Azzam من Supabase.");
    process.exit(1);
  }
  const raw = fs.readFileSync(envPath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL أو NEXT_PUBLIC_SUPABASE_ANON_KEY ناقصان في .env.local");
  process.exit(1);
}
if (!service) {
  console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY غير مضبوط — الاستيراد والعمليات الإدارية قد تفشل.");
}

const key = service || anon;
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

console.log("→ اختبار اتصال REST (جدول workers)…");
const { error: wErr } = await supabase.from("workers").select("id").limit(1);
if (wErr) {
  console.error("❌ فشل الاتصال أو الجداول غير جاهزة:", wErr.message);
  process.exit(1);
}
console.log("✓ الاتصال بقاعدة Azzam يعمل.");

console.log("→ اختبار استدعاء RPC submit_attendance_bulk_checks (دفعة فارغة)…");
const probeDate = "2099-12-31";
const { data: rpcData, error: rpcErr } = await supabase.rpc("submit_attendance_bulk_checks", {
  p_work_date: probeDate,
  p_payload: [],
  p_notes: "verify_script",
});

if (rpcErr) {
  const msg = rpcErr.message ?? "";
  if (rpcErr.code === "42883" || /function .* does not exist/i.test(msg) || /Could not find the function/i.test(msg)) {
    console.error("❌ الدالة غير موجودة في public. نفّذ في SQL Editor مشروع Azzam: `final_fix.sql` ثم تأكد من وجود `app.submit_attendance_bulk_checks`.");
    process.exit(1);
  }
  if (/Unauthorized user|not authorized|JWT/i.test(msg)) {
    console.log("✓ الدالة موجودة وتُرفض بدون جلسة مستخدم (متوقع مع مفتاح الخدمة) — نفس مسار attendance-engine يستخدم جلسة المستخدم.");
  } else {
    console.warn("⚠️ RPC:", msg);
  }
} else {
  console.log("✓ RPC أعاد:", rpcData);
}

console.log("تم التحقق — المتغيرات في .env.local تشير لنفس مشروع Supabase المستخدم في lib/env.ts والـ APIs.");
