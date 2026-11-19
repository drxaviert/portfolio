"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  TYPE_SCALE_STORAGE_KEY,
  TYPE_SCALES,
  isTypeScaleId,
  type TypeScaleId,
} from "@/lib/type-scale";

function readInitialScale(): TypeScaleId {
  try {
    const fromUrl = new URL(window.location.href).searchParams.get("type");
    if (isTypeScaleId(fromUrl)) return fromUrl;
    const stored = window.localStorage.getItem(TYPE_SCALE_STORAGE_KEY);
    if (isTypeScaleId(stored)) return stored;
  } catch {
    // Private mode or blocked storage: fall through to Current.
  }
  return "current";
}

/**
 * Comparison-only control. It writes `data-type-scale` on <html>; the CSS does
 * the rest. Current is the untouched site.
 */
export function TypeScaleSwitcher() {
  const [scale, setScale] = useState<TypeScaleId>("current");
  const panelRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((next: TypeScaleId, updateUrl = true) => {
    setScale(next);
    document.documentElement.dataset.typeScale = next;

    try {
      window.localStorage.setItem(TYPE_SCALE_STORAGE_KEY, next);
    } catch {
      // The in-memory choice still applies.
    }

    if (!updateUrl) return;

    const url = new URL(window.location.href);
    if (next === "current") {
      url.searchParams.delete("type");
    } else {
      url.searchParams.set("type", next);
    }
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    apply(readInitialScale(), false);
  }, [apply]);

  // Keep the panel off the nav: at phone widths the nav sits at the bottom.
  // If the bottom-left slot would collide, sit just above the nav instead.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const nav = document.querySelector<HTMLElement>(".wd-nav-dock > nav");
    if (!nav) return;

    let frame = 0;

    const place = () => {
      frame = 0;
      panel.style.removeProperty("--type-scale-bottom");

      const panelBox = panel.getBoundingClientRect();
      const navBox = nav.getBoundingClientRect();
      const overlaps = !(
        panelBox.right < navBox.left ||
        panelBox.left > navBox.right ||
        panelBox.bottom < navBox.top ||
        panelBox.top > navBox.bottom
      );

      if (!overlaps || navBox.top <= window.innerHeight / 2) return;

      panel.style.setProperty(
        "--type-scale-bottom",
        `${Math.max(12, window.innerHeight - navBox.top + 8)}px`,
      );
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(place);
    };

    place();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(nav);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      observer.disconnect();
    };
  }, [scale]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      const picked = TYPE_SCALES.find((item) => item.key === event.key);
      if (!picked) return;

      event.preventDefault();
      apply(picked.id);
    }

    function onPopState() {
      const fromUrl = new URL(window.location.href).searchParams.get("type");
      apply(isTypeScaleId(fromUrl) ? fromUrl : "current", false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, [apply]);

  return (
    <div
      className="type-scale-switcher"
      role="group"
      aria-label="Type scale"
      ref={panelRef}
    >
      {TYPE_SCALES.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={scale === item.id}
          onClick={() => apply(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
