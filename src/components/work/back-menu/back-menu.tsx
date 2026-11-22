"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { Segment, SegmentTrack } from "@/components/theme/theme-toggle";
import { BackLinkAnchor, LeftArrowIcon } from "../back-link";
import { useDrawerActions } from "../drawer-actions";
import { useBackMenuVariant } from "./use-back-menu-variant";
import "./back-menu.css";

/** Hover intent: a quick pass over the split control does not flash a card. */
export const BACK_MENU_OPEN_DELAY_MS = 150;

/** Long enough for the pointer to cross the 6-8px gap into the menu. */
export const BACK_MENU_CLOSE_GRACE_MS = 200;

/** The inline pair's segment width; "Work" and "Home" fit at 14px/500. */
const INLINE_SEGMENT_WIDTH = 54;

export type ReaderBackMenuProps = {
  /** The study's title, for the crumb variant. */
  title: string;
};

type MenuItem = {
  id: "work" | "home";
  label: string;
  hint: string;
  icon: ReactNode;
  action: () => void;
};

function canHover(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover)").matches
  );
}

function isPlainLeftClick(event: ReactMouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** The drawer's own two destinations, shared by every resting layout. */
function useBackMenuActions() {
  const actions = useDrawerActions();
  const router = useRouter();

  const goWork = useCallback(() => {
    if (actions) {
      actions.stepBack();
      return;
    }

    router.push("/work");
  }, [actions, router]);

  // The orb and Esc-to-home both run the drawer's own close; this is that
  // action, not a route push, so its generation owns the exit and `/` is the
  // homepage the drawer was above.
  const goHome = useCallback(() => {
    if (actions) {
      void actions.close();
      return;
    }

    router.replace("/");
  }, [actions, router]);

  return { goWork, goHome };
}

/**
 * The reader's way back. The variant now determines the resting control, not
 * a hover menu: inline and crumb are always extended, while dropdown and side
 * keep the shared "← Work" label and add a split chevron.
 */
export function ReaderBackMenu({ title }: ReaderBackMenuProps) {
  const variant = useBackMenuVariant();

  if (variant === "inline") return <InlineBackMenu />;
  if (variant === "crumb") return <CrumbBackMenu title={title} />;

  return <SplitBackMenu key={variant} variant={variant} />;
}

/** Inline: the segmented Work | Home pair, always on screen. */
function InlineBackMenu() {
  const { goWork, goHome } = useBackMenuActions();

  return (
    <div
      className="wd-back bm-root"
      data-back-menu-anchor=""
      data-bm-variant="inline"
    >
      <SegmentTrack
        label="Work navigation"
        groupRole="group"
        segments={2}
        selectedIndex={0}
        segmentWidth={INLINE_SEGMENT_WIDTH}
        followFocus
        className="bm-inline-track"
      >
        <Segment
          selected
          role="button"
          tabIndex={0}
          label="Work"
          onClick={goWork}
          onKeyDown={() => undefined}
        >
          Work
        </Segment>
        <Segment
          selected={false}
          role="button"
          tabIndex={0}
          label="Home"
          onClick={goHome}
          onKeyDown={() => undefined}
        >
          Home
        </Segment>
      </SegmentTrack>
    </div>
  );
}

/** Crumb: Home / Work / title, always on screen. */
function CrumbBackMenu({ title }: { title: string }) {
  const { goWork, goHome } = useBackMenuActions();

  function onCrumbClick(
    event: ReactMouseEvent<HTMLAnchorElement>,
    action: () => void,
  ) {
    if (!isPlainLeftClick(event)) return;

    event.preventDefault();
    action();
  }

  return (
    <div
      className="wd-back bm-root"
      data-back-menu-anchor=""
      data-bm-variant="crumb"
    >
      <nav className="bm-crumb" aria-label="Breadcrumb">
        <Link
          href="/"
          className="bm-crumb-item"
          onClick={(event) => onCrumbClick(event, goHome)}
        >
          Home
        </Link>
        <span className="bm-crumb-sep" aria-hidden="true">
          /
        </span>
        <Link
          href="/work"
          className="bm-crumb-item"
          onClick={(event) => onCrumbClick(event, goWork)}
        >
          Work
        </Link>
        <span className="bm-crumb-sep" aria-hidden="true">
          /
        </span>
        <span className="bm-crumb-current" aria-current="page" title={title}>
          {title}
        </span>
      </nav>
    </div>
  );
}

/** Dropdown and side: the split "← Work" control with a chevron. */
function SplitBackMenu({ variant }: { variant: "dropdown" | "side" }) {
  const { goWork, goHome } = useBackMenuActions();
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLAnchorElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const menuId = useId();

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }

    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const focusItem = useCallback((index: number) => {
    const items =
      menuRef.current?.querySelectorAll<HTMLElement>("[data-bm-item]");

    items?.[index]?.focus();
  }, []);

  const openMenu = useCallback(
    (focusFirst: boolean) => {
      clearTimers();
      setFocusIndex(0);
      setOpen(true);

      const active = document.activeElement;

      openerRef.current =
        active instanceof HTMLElement && rootRef.current?.contains(active)
          ? active
          : chevronRef.current;

      if (focusFirst) {
        requestAnimationFrame(() => focusItem(0));
      }
    },
    [clearTimers, focusItem],
  );

  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      clearTimers();
      setOpen(false);
      setActiveIndex(null);

      if (restoreFocus) {
        const opener = openerRef.current;
        const target =
          opener && opener.isConnected ? opener : chevronRef.current;

        target?.focus();
      }
    },
    [clearTimers],
  );

  useEffect(() => {
    return () => {
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  // The open card owns Escape. `preventDefault` is the drawer's contract
  // (useEscToClose ignores a handled Escape), so one press dismisses the card
  // and the next one steps the reader back.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();

      const focusInside =
        menuRef.current?.contains(document.activeElement) ?? false;

      closeMenu(focusInside);
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && !rootRef.current?.contains(target)) {
        closeMenu(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, closeMenu]);

  // The side card is vertically centred on the control, unless that would put
  // it under the fixed nav: then its top is clamped below the nav row.
  useLayoutEffect(() => {
    if (variant !== "side" || !open) return;

    const root = rootRef.current;
    const panel = menuRef.current;

    if (!root || !panel) return;

    const rootRect = root.getBoundingClientRect();
    const nav = document.querySelector<HTMLElement>("[data-nav-dock]");
    const navBottom = nav?.getBoundingClientRect().bottom ?? 0;
    const centered =
      rootRect.top + rootRect.height / 2 - panel.offsetHeight / 2;
    const top = Math.max(centered, navBottom + 8);

    root.style.setProperty(
      "--bm-side-top",
      `${Math.max(0, top - rootRect.top)}px`,
    );
  }, [variant, open]);

  const items: MenuItem[] = [
    {
      id: "work",
      label: "Work",
      hint: "All projects",
      icon: <LeftArrowIcon />,
      action: goWork,
    },
    {
      id: "home",
      label: "Home",
      hint: "Back to start",
      icon: <HomeIcon />,
      action: goHome,
    },
  ];

  function run(action: () => void) {
    setOpen(false);
    setActiveIndex(null);
    action();
  }

  function onRootPointerEnter(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || !canHover()) return;

    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    if (open || openTimer.current !== null) return;

    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      openMenu(false);
    }, BACK_MENU_OPEN_DELAY_MS);
  }

  function onRootPointerLeave() {
    if (!canHover()) return;

    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }

    if (!open) return;

    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);

    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      closeMenu(false);
    }, BACK_MENU_CLOSE_GRACE_MS);
  }

  function onRootBlur(event: ReactFocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;

    if (next && rootRef.current?.contains(next)) return;

    if (open) closeMenu(false);
  }

  function onLabelKeyDown(event: ReactKeyboardEvent<HTMLAnchorElement>) {
    if (event.key !== "ArrowDown" && event.key !== " ") return;

    event.preventDefault();
    openMenu(true);
  }

  function onChevronKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown") return;

    event.preventDefault();
    openMenu(true);
  }

  function onChevronClick() {
    if (open) {
      closeMenu(false);
      return;
    }

    openMenu(true);
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const nodes =
      menuRef.current?.querySelectorAll<HTMLElement>("[data-bm-item]");
    const items = nodes ? Array.from(nodes) : [];
    const current = items.indexOf(document.activeElement as HTMLElement);

    let next: number;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = current === -1 ? 0 : (current + 1) % items.length;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = current <= 0 ? items.length - 1 : current - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    focusItem(next);
  }

  function itemFocus(index: number) {
    setFocusIndex(index);
    setActiveIndex(index);
  }

  return (
    <div
      ref={rootRef}
      className="wd-back bm-root"
      data-back-menu-anchor=""
      data-bm-variant={variant}
      onPointerEnter={onRootPointerEnter}
      onPointerLeave={onRootPointerLeave}
      onBlur={onRootBlur}
    >
      <div className="bm-split">
        <BackLinkAnchor
          label="Work"
          ariaLabel="Back to work"
          href="/work"
          onBack={goWork}
          linkRef={labelRef}
          onKeyDown={onLabelKeyDown}
        />
        <button
          ref={chevronRef}
          type="button"
          className="bm-chevron"
          aria-label={open ? "Close work menu" : "Open work menu"}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={onChevronClick}
          onKeyDown={onChevronKeyDown}
        >
          <ChevronIcon direction={variant === "side" ? "right" : "down"} />
        </button>
      </div>

      <div id={menuId} className="wd-back-menu" data-back-menu-slot="">
        <div
          ref={menuRef}
          role="menu"
          aria-label="Work navigation"
          className={`bm-panel bm-${variant}`}
          inert={!open}
          aria-hidden={!open}
          data-open={open}
          onKeyDown={onMenuKeyDown}
          onPointerLeave={() => setActiveIndex(null)}
        >
          <span
            className="bm-capsule"
            aria-hidden="true"
            data-visible={activeIndex !== null}
            style={{ "--bm-index": activeIndex ?? 0 } as CSSProperties}
          />
          <div className="bm-rows">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                data-bm-item={item.id}
                tabIndex={open && focusIndex === index ? 0 : -1}
                aria-label={`${item.label}, ${item.hint}`}
                className="bm-row"
                onPointerEnter={() => setActiveIndex(index)}
                onFocus={() => itemFocus(index)}
                onClick={() => run(item.action)}
              >
                <span className="bm-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="bm-label">{item.label}</span>
                <span className="bm-hint">{item.hint}</span>
              </button>
            ))}
          </div>
          <div className="bm-footer">
            <kbd className="bm-kbd">Esc</kbd>
            <span className="bm-footer-hint">to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A 14px chevron in the back link's 1.5px stroke set. */
function ChevronIcon({ direction }: { direction: "down" | "right" }) {
  return (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {direction === "down" ? (
        <path d="M3 5.25 7 9.25 11 5.25" />
      ) : (
        <path d="M5.25 3 9.25 7 5.25 11" />
      )}
    </svg>
  );
}

/** A 20px / 1.5px home, in the same stroke set as the arrow. */
function HomeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 8.5 10 3l6.5 5.5V16a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z" />
      <path d="M8 17v-4.5h4V17" />
    </svg>
  );
}
