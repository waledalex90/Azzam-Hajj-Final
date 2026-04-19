type RequestErrorContext = {
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "proxy";
  renderSource?: string;
  revalidateReason: "on-demand" | "stale" | undefined;
};

/**
 * يُستدعى على السيرفر عند فشل الطلب (بما فيها أخطاء RSC).
 * يربط digest الظاهر في المتصفح برسالة كاملة في سجلات Vercel / Node.
 */
export async function onRequestError(
  error: unknown,
  request: Readonly<{ path: string; method: string; headers: NodeJS.Dict<string | string[]> }>,
  context: Readonly<RequestErrorContext>,
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = (err as Error & { digest?: string }).digest;

  console.error("[onRequestError]", {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    routerKind: context.routerKind,
    message: err.message,
    name: err.name,
    stack: err.stack,
    digest,
  });
  console.error("[onRequestError] raw error object:", error);
}
