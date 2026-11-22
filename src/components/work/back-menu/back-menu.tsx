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

/** Hover intent: a quick pass over the link does not flash a menu open. */
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

/**
 * The reader's "← Work" with the prototype hover menu behind `?bm=`.
 *
 * One wrapper owns the intent delays, the grace period, the keyboard and the
 * Escape hand-off; each variant only draws its own body. The link itself is
 * still the BackLink anchor: a click, Enter or a modified click behaves exactly
 * as it did before the menu.
 */
export function ReaderBackMenu({ title }: ReaderBackMenuProps) {
  const actions = useDrawerActions();
  const variant = useBackMenuVariant();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const menuId = useId();

  const [open, setOpen] = useState(false);
  const [openFor, setOpenFor] = useState(variant);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [inlineIndex, setInlineIndex] = useState(0);

  // A variant switch retires the open menu in the same render: no effect, no
  // stale body left holding focus while the next variant paints.
  const menuOpen = open && openFor === variant;

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
    const items = menuRef.current?.querySelectorAll<HTMLElement>(
      '[data-bm-item], [role="radio"]',
    );

    items?.[index]?.focus();
  }, []);

  const openMenu = useCallback(
    (focusFirst: boolean) => {
      clearTimers();
      setOpenFor(variant);
      setFocusIndex(0);
      if (variant === "inline") setInlineIndex(0);
      setOpen(true);

      if (focusFirst) {
        requestAnimationFrame(() => focusItem(0));
      }
    },
    [clearTimers, focusItem, variant],
  );

  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      clearTimers();
      setOpen(false);
      setActiveIndex(null);

      if (restoreFocus) triggerRef.current?.focus();
    },
    [clearTimers],
  );

  useEffect(() => {
    return () => {
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  // The menu owns Escape while it is open. `preventDefault` is the drawer's
  // contract (useEscToClose ignores a handled Escape), so one press dismisses
  // the menu and the next one steps the reader back.
  useEffect(() => {
    if (!menuOpen) return;

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
  }, [menuOpen, closeMenu]);

  // The side card is vertically centred on the button, unless that would put
  // it under the fixed nav: then its top is clamped below the nav row.
  useLayoutEffect(() => {
    if (variant !== "side" || !menuOpen) return;

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
  }, [variant, menuOpen]);

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

    if (menuOpen || openTimer.current !== null) return;

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

    if (!menuOpen) return;

    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);

    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      closeMenu(false);
    }, BACK_MENU_CLOSE_GRACE_MS);
  }

  function onRootBlur(event: ReactFocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;

    if (next && rootRef.current?.contains(next)) return;

    if (menuOpen) closeMenu(false);
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLAnchorElement>) {
    if (event.key !== "ArrowDown" && event.key !== " ") return;

    event.preventDefault();
    openMenu(true);
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const nodes = menuRef.current?.querySelectorAll<HTMLElement>(
      '[data-bm-item], [role="radio"]',
    );
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

  function onCrumbClick(
    event: ReactMouseEvent<HTMLAnchorElement>,
    action: () => void,
  ) {
    if (!isPlainLeftClick(event)) return;

    event.preventDefault();
    run(action);
  }

  function itemFocus(index: number) {
    setFocusIndex(index);
    setActiveIndex(index);

    if (variant === "inline") setInlineIndex(index);
  }

  const panelOpen = { "data-open": menuOpen };

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
      <BackLinkAnchor
        label="Work"
        ariaLabel="Back to work"
        href="/work"
        onBack={actions?.stepBack}
        linkRef={triggerRef}
        ariaControls={menuId}
        ariaExpanded={menuOpen}
        ariaHasPopup={
          variant === "dropdown" || variant === "side" ? "menu" : undefined
        }
        onKeyDown={onTriggerKeyDown}
      />

      <div className="wd-back-menu" data-back-menu-slot="">
        {variant === "inline" ? (
          <div
            id={menuId}
            ref={menuRef}
            role="group"
            aria-label="Work navigation"
            className="bm-panel bm-inline"
            inert={!menuOpen}
            aria-hidden={!menuOpen}
            onKeyDown={onMenuKeyDown}
            {...panelOpen}
          >
            <SegmentTrack
              label="Work navigation"
              segments={2}
              selectedIndex={inlineIndex}
              segmentWidth={INLINE_SEGMENT_WIDTH}
              active={menuOpen}
              className="bm-inline-track"
            >
              <Segment
                selected={inlineIndex === 0}
                label="Work"
                onClick={() => run(goWork)}
                onKeyDown={() => undefined}
                onFocus={() => itemFocus(0)}
              >
                Work
              </Segment>
              <Segment
                selected={inlineIndex === 1}
                label="Home"
                onClick={() => run(goHome)}
                onKeyDown={() => undefined}
                onFocus={() => itemFocus(1)}
              >
                Home
              </Segment>
            </SegmentTrack>
          </div>
        ) : variant === "crumb" ? (
          <div
            id={menuId}
            ref={menuRef}
            role="group"
            aria-label="Breadcrumb"
            className="bm-panel bm-crumb"
            inert={!menuOpen}
            aria-hidden={!menuOpen}
            onKeyDown={onMenuKeyDown}
            {...panelOpen}
          >
            <Link
              href="/"
              className="bm-crumb-item"
              data-bm-item="home"
              tabIndex={menuOpen && focusIndex === 0 ? 0 : -1}
              onClick={(event) => onCrumbClick(event, goHome)}
              onFocus={() => itemFocus(0)}
            >
              Home
            </Link>
            <span className="bm-crumb-sep" aria-hidden="true">
              /
            </span>
            <Link
              href="/work"
              className="bm-crumb-item"
              data-bm-item="work"
              tabIndex={menuOpen && focusIndex === 1 ? 0 : -1}
              onClick={(event) => onCrumbClick(event, goWork)}
              onFocus={() => itemFocus(1)}
            >
              Work
            </Link>
            <span className="bm-crumb-sep" aria-hidden="true">
              /
            </span>
            <span
              className="bm-crumb-current"
              aria-current="page"
              title={title}
            >
              {title}
            </span>
          </div>
        ) : (
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-label="Work navigation"
            className={`bm-panel bm-${variant}`}
            inert={!menuOpen}
            aria-hidden={!menuOpen}
            onKeyDown={onMenuKeyDown}
            onPointerLeave={() => setActiveIndex(null)}
            {...panelOpen}
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
                  tabIndex={menuOpen && focusIndex === index ? 0 : -1}
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
        )}
      </div>
    </div>
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
