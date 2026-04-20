"use client";

import { useRouter } from "next/navigation";

import { DatePickerField } from "@/components/ui/date-picker-field";

export function DashboardDateFilter({ currentDate }: { currentDate: string }) {
  const router = useRouter();
  return (
    <DatePickerField
      key={currentDate || "none"}
      name="date"
      defaultValue={currentDate}
      onCommitted={(d) => {
        router.push(`/dashboard?date=${encodeURIComponent(d)}`);
        router.refresh();
      }}
    />
  );
}
