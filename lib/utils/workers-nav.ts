export function buildWorkersHref(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value && value.length > 0) params.set(key, value);
  });
  return `/workers?${params.toString()}`;
}
