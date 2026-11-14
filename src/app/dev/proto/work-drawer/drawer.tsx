"use client";

import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { CaseStudy } from "./case-study";
import { nextProject, projectIndex, PROJECTS } from "./works";
import type { Project } from "./works";
import type { Origin, Rect, Setup, Variant } from "./types";

/**
 * Throwaway drawer prototype. Three opening treatments share one reader:
 *
 * - sheet: rises from the bottom, drag the header to dismiss
 * - expand: the clicked card grows into the reader, content fades in after
 * - side: panel slides in from the right
 *
 * `closing` is owned by the prototype page so every way out (Escape, close,
 * backdrop, browser Back, drag) runs the same exit and only unmounts after
 * `onClosed`. That is what makes an interrupted open reverse from where it is.
 */

export type DrawerProps = {
  project: Project;
  setup: Setup;
  variant: Variant;
  origin: Origin | null;
  closing: boolean;
  onNext: () => void;
  onRequestClose: () => void;
  onClosed: () => void;
};

const EASE_ENTER = [0.32, 0.72, 0, 1] as const;

function useReduceMotion(): boolean {
  return Boolean(useReducedMotion());
}

export function WorkDrawer(props: DrawerProps) {
  const reduce = useReduceMotion();

  return (
    <>
      <Backdrop
        closing={props.closing}
        reduce={reduce}
        onRequestClose={props.onRequestClose}
      />
      {props.variant === "sheet" ? (
        <SheetDrawer {...props} reduce={reduce} />
      ) : null}
      {props.variant === "side" ? (
        <SideDrawer {...props} reduce={reduce} />
      ) : null}
      {props.variant === "expand" ? (
        <ExpandDrawer {...props} reduce={reduce} />
      ) : null}
    </>
  );
}

function Backdrop({
  closing,
  reduce,
  onRequestClose,
}: {
  closing: boolean;
  reduce: boolean;
  onRequestClose: () => void;
}) {
  return (
    <motion.div
      className="wd-backdrop"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{
        duration: reduce ? 0.12 : closing ? 0.24 : 0.32,
        ease: "easeOut",
      }}
      onClick={onRequestClose}
    />
  );
}

/**
 * Focus lands on the close button when the surface is ready and is trapped in
 * the dialog until it unmounts; the page restores the card's focus afterwards.
 */
function useDrawerFocus(
  rootRef: RefObject<HTMLDivElement | null>,
  ready: boolean,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready) return;

    root.querySelector<HTMLElement>("[data-wd-close]")?.focus({
      preventScroll: true,
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !root) return;

      const nodes = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !root.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [rootRef, ready]);
}

function CloseButton({
  onRequestClose,
  className = "",
}: {
  onRequestClose: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-wd-close
      aria-label="Close case study"
      className={`wd-close ${className}`}
      onClick={onRequestClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <svg
        viewBox="0 0 20 20"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </button>
  );
}

/** One reader, mounted by every variant. */
function DrawerContent({
  project,
  setup,
  reduce,
  onNext,
  scrollRef,
}: {
  project: Project;
  setup: Setup;
  reduce: boolean;
  onNext: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const index = Math.max(0, projectIndex(project.slug));

  function onExitComplete() {
    scrollRef.current?.scrollTo({ top: 0 });

    // The Next button unmounts with the old content; keep keyboard focus in
    // the dialog instead of dropping it to the page behind.
    if (document.activeElement === document.body) {
      document
        .querySelector<HTMLElement>("[data-wd-close]")
        ?.focus({ preventScroll: true });
    }
  }

  return (
    <div ref={scrollRef} className="wd-scroll">
      <div className="wd-column">
        <AnimatePresence
          mode="wait"
          initial={false}
          onExitComplete={onExitComplete}
        >
          <motion.div
            key={project.slug}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{
              duration: reduce ? 0.12 : 0.18,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            <CaseStudy
              project={project}
              next={nextProject(project.slug)}
              index={index}
              total={PROJECTS.length}
              setup={setup}
              onNext={onNext}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SheetDrawer({
  project,
  setup,
  closing,
  reduce,
  onNext,
  onRequestClose,
  onClosed,
}: DrawerProps & { reduce: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useDrawerFocus(rootRef, true);

  const openPose = reduce ? { opacity: 1 } : { y: 0 };
  const closedPose = reduce ? { opacity: 0 } : { y: "100%" };

  return (
    <motion.div
      ref={rootRef}
      className="wd-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wd-study-title"
      drag={reduce ? false : "y"}
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.55 }}
      dragTransition={{ bounceStiffness: 520, bounceDamping: 44 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 650) onRequestClose();
      }}
      initial={reduce ? { opacity: 0 } : { y: "100%" }}
      animate={closing ? closedPose : openPose}
      transition={
        closing
          ? { duration: reduce ? 0.12 : 0.24, ease: "easeIn" }
          : {
              duration: reduce ? 0.12 : 0.5,
              ease: reduce ? "easeOut" : EASE_ENTER,
            }
      }
      onAnimationComplete={() => {
        if (closing) onClosed();
      }}
    >
      <header
        className="wd-head wd-head-sheet"
        onPointerDown={(event) => {
          if (reduce) return;
          dragControls.start(event);
        }}
      >
        <span className="wd-handle" aria-hidden="true" />
        <CloseButton onRequestClose={onRequestClose} />
      </header>

      <DrawerContent
        project={project}
        setup={setup}
        reduce={reduce}
        onNext={onNext}
        scrollRef={scrollRef}
      />
    </motion.div>
  );
}

function SideDrawer({
  project,
  setup,
  closing,
  reduce,
  onNext,
  onRequestClose,
  onClosed,
}: DrawerProps & { reduce: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useDrawerFocus(rootRef, true);

  const openPose = reduce ? { opacity: 1 } : { x: 0 };
  const closedPose = reduce ? { opacity: 0 } : { x: "100%" };

  return (
    <motion.div
      ref={rootRef}
      className="wd-side"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wd-study-title"
      initial={reduce ? { opacity: 0 } : { x: "100%" }}
      animate={closing ? closedPose : openPose}
      transition={
        closing
          ? { duration: reduce ? 0.12 : 0.24, ease: "easeIn" }
          : {
              duration: reduce ? 0.12 : 0.42,
              ease: reduce ? "easeOut" : EASE_ENTER,
            }
      }
      onAnimationComplete={() => {
        if (closing) onClosed();
      }}
    >
      <header className="wd-head wd-head-side">
        <p className="wd-head-label">Case study</p>
        <CloseButton onRequestClose={onRequestClose} />
      </header>

      <DrawerContent
        project={project}
        setup={setup}
        reduce={reduce}
        onNext={onNext}
        scrollRef={scrollRef}
      />
    </motion.div>
  );
}

function targetRect(): Rect {
  const inset = window.innerWidth >= 768 ? 16 : 0;

  return {
    left: inset,
    top: inset,
    width: window.innerWidth - inset * 2,
    height: window.innerHeight - inset * 2,
  };
}

function fallbackStart(target: Rect): Rect {
  return {
    left: target.left + target.width * 0.22,
    top: target.top + target.height * 0.2,
    width: target.width * 0.56,
    height: target.height * 0.6,
  };
}

function ExpandDrawer({
  project,
  setup,
  origin,
  closing,
  reduce,
  onNext,
  onRequestClose,
  onClosed,
}: DrawerProps & { reduce: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [target] = useState(targetRect);
  const [start] = useState<Rect>(() =>
    origin ? origin.card : fallbackStart(target),
  );
  const [morphed, setMorphed] = useState(!origin || reduce);

  useDrawerFocus(rootRef, morphed && !closing);

  const from = reduce ? { ...target, opacity: 0 } : { ...start, opacity: 1 };
  const to = { ...target, opacity: 1 };
  const narrowOrigin = start.width < 240;

  return (
    <motion.div
      ref={rootRef}
      className="wd-expand"
      role="dialog"
      aria-modal="true"
      aria-label={`Case study: ${project.title}`}
      initial={from}
      animate={closing ? from : to}
      transition={
        closing
          ? { duration: reduce ? 0.12 : 0.3, ease: "easeIn" }
          : {
              duration: reduce ? 0.12 : 0.48,
              ease: reduce ? "easeOut" : EASE_ENTER,
            }
      }
      onAnimationComplete={() => {
        if (closing) {
          onClosed();
          return;
        }
        setMorphed(true);
      }}
    >
      {morphed && !closing ? (
        <div className="wd-expand-reader">
          <CloseButton
            className="wd-float-close"
            onRequestClose={onRequestClose}
          />
          <DrawerContent
            project={project}
            setup={setup}
            reduce={reduce}
            onNext={onNext}
            scrollRef={scrollRef}
          />
        </div>
      ) : (
        <div className="wd-face" aria-hidden="true">
          {narrowOrigin ? null : (
            <>
              <p className="wd-eyebrow">Case study</p>
              <p className="wd-face-title">{project.title}</p>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
