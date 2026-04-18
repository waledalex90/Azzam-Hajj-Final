import Link from "next/link";

import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  totalPages: number;
  basePath: string;
  query: Record<string, string | undefined>;
};

function createQueryString(
  query: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set("page", String(page));
  return params.toString();
}

export function PaginationControls({ page, totalPages, basePath, query }: Props) {
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      {page <= 1 ? (
        <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
          السابق
        </span>
      ) : (
        <Link href={`${basePath}?${createQueryString(query, prevPage)}`}>
          <Button variant="secondary" className="min-h-10 rounded-lg px-4 py-2 text-sm">
            السابق
          </Button>
        </Link>
      )}
      <p className="rounded-lg bg-slate-50 px-3 py-1 text-sm text-slate-600">
        صفحة {page} من {totalPages}
      </p>
      {page >= totalPages ? (
        <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
          التالي
        </span>
      ) : (
        <Link href={`${basePath}?${createQueryString(query, nextPage)}`}>
          <Button variant="secondary" className="min-h-10 rounded-lg px-4 py-2 text-sm">
            التالي
          </Button>
        </Link>
      )}
    </div>
  );
}
