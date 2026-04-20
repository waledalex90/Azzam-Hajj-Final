"use client";

import type { ReactNode } from "react";

import styles from "./tab-panel-transition.module.css";

/** يلف محتوى التبويب؛ ضع `key={المفتاح}` على هذا المكوّن من الصفحة لإعادة تشغيل الحركة عند تغيير التبويب */
export function TabPanelTransition({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}
