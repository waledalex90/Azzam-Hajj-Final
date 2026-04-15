import { Card } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <section className="space-y-4 animate-pulse">
      <Card className="h-24 bg-slate-100"> </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="h-24 bg-slate-100"> </Card>
        <Card className="h-24 bg-slate-100"> </Card>
        <Card className="h-24 bg-slate-100"> </Card>
        <Card className="h-24 bg-slate-100"> </Card>
      </div>
      <Card className="h-52 bg-slate-100"> </Card>
      <Card className="h-52 bg-slate-100"> </Card>
    </section>
  );
}
