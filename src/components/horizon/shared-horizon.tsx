"use client";

import { usePathname } from "next/navigation";
import { HorizonLive } from "./horizon-live";

/**
 * The one horizon for the homepage and the work drawer.
 *
 * Both `/` and `/work*` render the same home layout underneath, but they mount
 * it as two separate route trees: the drawer route's HomeScreen would otherwise
 * create a second HorizonShader and replay the CSS-to-WebGL handoff on the
 * first navigation. The horizon lives here, above both routes in the root
 * layout, so one canvas and one WebGL context serve the whole session, and the
 * fallback only hands over once per document.
 *
 * The dev prototypes draw their own horizon (HomeLayout's default), so this
 * only mounts on the two shipped routes.
 */
export function SharedHorizon() {
  const pathname = usePathname();
  const shipped = pathname === "/" || pathname.startsWith("/work");

  if (!shipped) return null;

  return (
    <div data-horizon-shared="">
      <HorizonLive />
    </div>
  );
}
