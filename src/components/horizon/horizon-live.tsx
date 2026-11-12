"use client";

import { useState } from "react";
import { HorizonBackground } from "./horizon-background";
import { HorizonShader } from "./horizon-shader";
import {
  HORIZON_HOME_DITHER,
  HORIZON_HOME_DITHER_LSB,
  HORIZON_HOME_DPR_CAP,
  HORIZON_HOME_GRADIENT,
  HORIZON_HOME_MOTION,
} from "./horizon-preset";

/**
 * The live home horizon.
 *
 * The CSS background is the first paint and the permanent floor: it is plain
 * server-rendered markup with the production preset, so the page never shows a
 * bare surface while WebGL boots. The shader mounts on top with the identical
 * preset, takes its motion clock from the CSS animation, and fades in after its
 * first frame.
 *
 * If WebGL is missing or the context is lost, only the canvas goes away. The
 * CSS layer never stopped animating, so the fallback is seamless and already in
 * phase.
 */
export function HorizonLive() {
  const [webglFailed, setWebglFailed] = useState(false);

  return (
    <>
      <HorizonBackground
        position="fixed"
        motion="drift-breathe"
        tuning={HORIZON_HOME_MOTION}
        dither={HORIZON_HOME_DITHER}
        gradient={HORIZON_HOME_GRADIENT}
      />

      {webglFailed ? null : (
        <HorizonShader
          motion="drift-breathe"
          tuning={HORIZON_HOME_MOTION}
          ditherLsb={HORIZON_HOME_DITHER_LSB}
          dprCap={HORIZON_HOME_DPR_CAP}
          onFallback={() => setWebglFailed(true)}
        />
      )}
    </>
  );
}
