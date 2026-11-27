import { ViewportEdgeBlur } from "@/components/edge-blur/viewport-edge-blur";

/**
 * `/`: the homepage is the shared site layout's HomeScreen, so the page itself
 * adds only what belongs to `/` alone.
 *
 * The viewport edge blur is mounted here rather than in the layout, so it
 * exists on `/` alone: `/work*` shows the same HomeScreen but no bands. Opening
 * a study from here still covers both bands with the drawer panel, which is
 * what the bands' own comment promises.
 */
export default function Home() {
  return <ViewportEdgeBlur />;
}
