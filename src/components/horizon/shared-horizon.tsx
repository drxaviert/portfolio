import { HorizonLive } from "./horizon-live";

/**
 * The one horizon for the homepage and the work drawer.
 *
 * Both `/` and `/work*` render the same home layout underneath, but they mount
 * it as two separate route trees: the drawer route's HomeScreen would otherwise
 * create a second HorizonShader and replay the CSS-to-WebGL handoff on the
 * first navigation. The `(site)` layout mounts this above both routes, so one
 * canvas and one WebGL context serve the whole session, and the fallback only
 * hands over once per document.
 *
 * It is deliberately a plain server wrapper: it used to read `usePathname()` in
 * the root layout to decide whether to mount, which made it a postponed client
 * hole. A cached shell could then be served without the horizon while the
 * client rendered it, which React reported as a hydration mismatch (#418).
 * The `(site)` route group is the route gate now, so the wrapper is static and
 * every shell carries it.
 */
export function SharedHorizon() {
  return (
    <div data-horizon-shared="">
      <HorizonLive />
    </div>
  );
}
