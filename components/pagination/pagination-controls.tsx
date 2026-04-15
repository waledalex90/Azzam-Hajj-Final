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
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
      {page <= 1 ? (
        <Button variant="secondary" disabled>
          السابق
        </Button>
      ) : (
        <Link href={`${basePath}?${createQueryString(query, prevPage)}`}>
          <Button variant="secondary">السابق</Button>
        </Link>
      )}
      <p className="text-sm text-slate-600">
        صفحة {page} من {totalPages}
      </p>
      {page >= totalPages ? (
        <Button variant="secondary" disabled>
          التالي
        </Button>
      ) : (
        <Link href={`${basePath}?${createQueryString(query, nextPage)}`}>
          <Button variant="secondary">التالي</Button>
        </Link>
      )}
    </div>
  );
}
