"use client";

import { RouteErrorDisplay } from "@/components/errors/route-error-display";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function UsersSegmentError({ error, reset }: Props) {
  return <RouteErrorDisplay error={error} reset={reset} boundaryLabel="users" />;
}
