"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The tooltip's own open delay: the first label waits exactly this long. */
export const TOOLTIP_WARM_MS = 300;

/**
 * Emil's warm tooltip group. The first label in a group waits the open delay;
 * once one has appeared, every other label in the same group opens on the frame
 * the pointer reaches it, with no fade. The group goes cold 300ms after the
 * pointer leaves it, so a pass along the bar stays fast and a later, unrelated
 * hover still waits.
 *
 * The delay lives in CSS; this only decides when the group is warm, and the
 * stylesheet drops the transition while the attribute is set.
 */
export function useTooltipWarm() {
  const [warm, setWarm] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const onPointerEnter = useCallback(() => {
    clear();
    // The first label opens after TOOLTIP_WARM_MS; anything entered after that
    // is already in a warm group.
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setWarm(true);
    }, TOOLTIP_WARM_MS);
  }, [clear]);

  const onPointerLeave = useCallback(() => {
    clear();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setWarm(false);
    }, TOOLTIP_WARM_MS);
  }, [clear]);

  return { warm, onPointerEnter, onPointerLeave };
}
