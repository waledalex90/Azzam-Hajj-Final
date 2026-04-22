import { ReportsHubLazy } from "@/components/reports/reports-hub-lazy";
import { hasPermission } from "@/lib/auth/permissions";
import { requireScreen } from "@/lib/auth/require-screen";
import { getSessionContext } from "@/lib/auth/session";
import { PERM } from "@/lib/permissions/keys";

export default async function ReportsPage() {
  await requireScreen(PERM.VIEW_REPORTS);
  const { appUser } = await getSessionContext();
  const canExportReports = Boolean(appUser && hasPermission(appUser, PERM.EXPORT_REPORTS));
  return (
    <section className="space-y-4">
      <ReportsHubLazy canExportReports={canExportReports} />
    </section>
  );
}
