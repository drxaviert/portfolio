import type { ReactNode } from "react";

/**
 * Throwaway prototype (dev route only): the wrapper that carries a homepage
 * entrance animation.
 *
 * The entrance is never put on the `.ring-host` itself. Hover owns that
 * element's clip-paths, z-index and focus ring, and an entrance running on it
 * would create a stacking context around the ring exactly while the pointer is
 * trying to open it. One wrapper (this one) holds the stagger; a second
 * `.entrance-body` holds the animation group, so the ring-reveal variant can
 * draw its 1px edge independently of the fill and content inside it.
 *
 * With no `variant` the wrapper disappears entirely: the caller's markup is
 * unchanged on `/`.
 */
export type EntranceVariant =
  "scale" | "rise" | "ring" | "sky" | "clear" | "step";

export function EntranceCell({
  variant,
  item,
  row,
  className,
  children,
}: {
  variant?: EntranceVariant;
  /** Reading order, 1-7: tracker, play, project, sliver 1-3, nav. */
  item: number;
  /** Row, 1-3, for the row-level stagger in "rise". */
  row: number;
  className?: string;
  children: ReactNode;
}) {
  if (!variant) return <>{children}</>;

  return (
    <div
      className={`entrance-cell${className ? ` ${className}` : ""}`}
      data-entrance-item={item}
      data-entrance-row={row}
    >
      <div className="entrance-body">{children}</div>
    </div>
  );
}
