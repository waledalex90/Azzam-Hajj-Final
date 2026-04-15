import type { PaginationMeta } from "@/lib/types/db";

export function buildPaginationMeta(
  totalRows: number,
  page: number,
  pageSize: number,
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  return {
    page,
    pageSize,
    totalRows,
    totalPages,
  };
}

export function parsePage(value: string | undefined, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}
