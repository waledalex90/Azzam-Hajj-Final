import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="container-mobile flex min-h-screen items-center justify-center py-8">
      <Card className="w-full max-w-lg space-y-4 text-center">
        <h1 className="text-xl font-extrabold text-slate-900">أنت حالياً بدون اتصال</h1>
        <p className="text-sm text-slate-600">
          يمكنك العودة بعد توفر الإنترنت. التطبيق مُعد كـ PWA ليعمل بشكل أفضل على الموبايل.
        </p>
        <div className="flex justify-center">
          <Link href="/dashboard">
            <Button className="min-w-36">إعادة المحاولة</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
