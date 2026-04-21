import { ReportsHubLazy } from "@/components/reports/reports-hub-lazy";
import { requireScreen } from "@/lib/auth/require-screen";
import { PERM } from "@/lib/permissions/keys";

export default async function ReportsPage() {
  await requireScreen(PERM.REPORTS);
  return (
    <section className="space-y-4">
      <ReportsHubLazy />
    </section>
  );
}
