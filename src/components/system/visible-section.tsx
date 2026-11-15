"use client";

import type { JSX, ReactNode } from "react";
import { useContentVisibility } from "./use-content-visibility";

/**
 * A section that is only rendered while it is near the viewport. The wrapper
 * keeps the server-rendered heading/id/anchor structure; see
 * use-content-visibility for the scroll-height bookkeeping.
 */
export function VisibleSection({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  const ref = useContentVisibility<HTMLElement>("section");

  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={`${id}-title`}
      className={className}
    >
      {children}
    </section>
  );
}
