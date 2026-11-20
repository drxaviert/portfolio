import { EdgeBlurTuner } from "@/components/edge-blur/edge-blur-tuner";
import { ViewportEdgeBlur } from "@/components/edge-blur/viewport-edge-blur";
import { HomeScreen } from "@/components/home/home-screen";

/**
 * `/`: the homepage as the page. A study's direct load renders it too.
 *
 * The viewport edge blur is mounted here rather than in the root layout, so it
 * exists on `/` alone: `/work*` composes HomeScreen from its own layout and
 * therefore gets neither the bands nor their dev tuner. Opening a study from
 * here still covers both bands with the drawer panel, which is what the bands'
 * own comment promises.
 */
export default function Home() {
  return (
    <>
      <HomeScreen />
      <ViewportEdgeBlur />
      <EdgeBlurTuner />
    </>
  );
}
