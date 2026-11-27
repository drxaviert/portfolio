import type { ReactNode } from "react";
import { SharedHorizon } from "@/components/horizon/shared-horizon";

/**
 * The shipped site shell.
 *
 * `(site)` wraps `/` and `/work*` only, so the one horizon instance can sit
 * above both routes and survive a navigation between them: one canvas, one
 * WebGL context and one CSS-to-WebGL handoff per document. Dev prototypes,
 * messages and the live scene stay outside the group and keep their own
 * backgrounds.
 *
 * The horizon lives here, not in the root layout, so the route gate is the
 * route tree itself rather than a client `usePathname()` read. That read made
 * the horizon a postponed client hole in the prerender: a cached shell could
 * be served without it, the client then rendered it, and React reported a
 * hydration mismatch (#418). A static layout keeps it in every shell.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SharedHorizon />
      {children}
    </>
  );
}
