"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The direct-load page renders the homepage plus its own reader. A study-to-study
 * navigation leaves this page behind in `children` while the modal slot takes
 * over the new reader, so this copy steps out once the URL is another study —
 * otherwise two readers stack. Back to this study brings it back.
 */
export function RouteStudy({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return pathname === `/work/${slug}` ? <>{children}</> : null;
}
