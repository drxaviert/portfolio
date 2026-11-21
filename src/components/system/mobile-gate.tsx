"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HorizonLive } from "@/components/horizon/horizon-live";
import { MESSAGE_LINK, MessageColumn } from "./message-screen";
import "./mobile-gate.css";

const DESKTOP_VIEW_KEY = "mobile-gate:desktop";
const DESKTOP_VIEWPORT = "width=1280";
const SMALL_VIEWPORT = "(max-width: 767.98px)";

function applyDesktopViewport() {
  document.documentElement.dataset.desktopView = "";

  document
    .querySelector<HTMLMetaElement>('meta[name="viewport"]')
    ?.setAttribute("content", DESKTOP_VIEWPORT);
}

/**
 * Desktop browsers ignore the viewport meta, so a narrow window keeps the
 * narrow layout after the bypass. Leave neither the marker nor the session flag
 * behind; the gate's own CSS follows the viewport, so it stays up.
 */
function clearBypass() {
  document.documentElement.removeAttribute("data-desktop-view");

  try {
    window.sessionStorage.removeItem(DESKTOP_VIEW_KEY);
  } catch {}
}

/**
 * The under-768 screen: the one message the site shows instead of the pages
 * while the mobile layouts are still being built. It copies the boundary
 * screens' column, sits above the dock and drawer, and only asks the horizon
 * to boot once the browser has confirmed the viewport is narrow — desktop
 * loads never create its extra canvas.
 *
 * "View the desktop version anyway" writes a session flag, so a reload stays in
 * desktop layout, and widens the layout viewport to 1280px, which is the same
 * render a phone's "Request desktop site" gets. A desktop browser ignores that
 * meta, so the click is only kept if the next frame really is wider than 768.
 */
export function MobileGate() {
  const pathname = usePathname();
  const [narrow, setNarrow] = useState(false);
  const [tooNarrow, setTooNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(SMALL_VIEWPORT);
    const sync = () => setNarrow(query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let bypassed = false;

    try {
      bypassed = window.sessionStorage.getItem(DESKTOP_VIEW_KEY) === "1";
    } catch {}

    if (!bypassed) return;

    applyDesktopViewport();

    const frame = requestAnimationFrame(() => {
      if (window.matchMedia(SMALL_VIEWPORT).matches) {
        clearBypass();
        setTooNarrow(true);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  if (pathname.startsWith("/dev")) return null;

  function viewDesktop() {
    try {
      window.sessionStorage.setItem(DESKTOP_VIEW_KEY, "1");
    } catch {}

    applyDesktopViewport();

    requestAnimationFrame(() => {
      if (window.matchMedia(SMALL_VIEWPORT).matches) {
        clearBypass();
        setTooNarrow(true);
      }
    });
  }

  return (
    <div
      data-mobile-gate=""
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-gate-title"
      className="flex-col overflow-y-auto bg-surface text-on-surface"
    >
      {narrow ? <HorizonLive /> : null}

      <MessageColumn
        kicker="Mobile · WIP"
        title="Best viewed on a computer."
        titleId="mobile-gate-title"
        centered
      >
        <p>
          The mobile version is still being built. For the full experience, open
          this site on a laptop or desktop.
        </p>

        {tooNarrow ? (
          <p role="status">
            This window is too narrow for the desktop version. Widen it, or open
            the site on a computer.
          </p>
        ) : (
          <p>
            <button
              type="button"
              onClick={viewDesktop}
              className={`${MESSAGE_LINK} inline-flex min-h-11 items-center text-left`}
            >
              View the desktop version anyway
            </button>
          </p>
        )}
      </MessageColumn>
    </div>
  );
}
