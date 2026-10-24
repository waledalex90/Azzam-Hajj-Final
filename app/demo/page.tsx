import type { Metadata } from "next";

import { WorkforceDemoApp } from "@/components/demo/workforce-demo-app";
import { PRODUCT_NAME, PRODUCT_TAGLINE_AR } from "@/lib/product";

export const metadata: Metadata = {
  title: `معاينة ${PRODUCT_NAME}`,
  description: PRODUCT_TAGLINE_AR,
  robots: { index: false, follow: false },
};

/** صفحة عرض معزولة بالكامل عن بيانات التشغيل. */
export default function DemoPage() {
  return <WorkforceDemoApp />;
}
