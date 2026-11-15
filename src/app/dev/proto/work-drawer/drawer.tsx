"use client";

import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { CaseStudy } from "./case-study";
import { CloseButton } from "./close-button";
import { NavHeaderBar, ReaderNav } from "./nav-layer";
import { ReaderContent } from "./reader-content";
import { computeReaderLayout } from "./nav-layout";
import type { ReaderLayout } from "./nav-layout";
import { CLOSE_S, EASE_ENTER, MORPH_S } from "./motion";
import { nextProject, projectIndex, PROJECTS } from "./works";
import type { Project } from "./works";
import type {
  ContentVariant,
  NavMode,
  Origin,
  Rect,
  Setup,
  Variant,
} from "./types";

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
 *
 * For the expanded reader the real HomeNav is rendered inside the dialog
 * (above the reader and backdrop), in one of three placements, so the visitor
 * keeps the nav and its live ThemeToggle the whole time.
 */

export type DrawerProps = {
  project: Project;
  setup: Setup;
  variant: Variant;
  nav: NavMode;
  content: ContentVariant;
  /** The page nav's box, measured before opening. */
  navOrigin: Rect | null;
  origin: Origin | null;
  closing: boolean;
  onNext: () => void;
  onRequestClose: () => void;
  onClosed: () => void;
};

function useReduceMotion(): boolean {
  return Boolean(useReducedMotion());
}

export function WorkDrawer(props: DrawerProps) {
  const reduce = useReduceMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [layout] = useState<ReaderLayout>(() =>
    computeReaderLayout(
      props.nav,
      props.navOrigin,
      window.innerWidth,
      window.innerHeight,
    ),
  );
  const [ready, setReady] = useState(props.variant !== "expand" || reduce);

  useDrawerFocus(dialogRef, ready);

  return (
    <>
      <Backdrop
        closing={props.closing}
        reduce={reduce}
        onRequestClose={props.onRequestClose}
      />

      <div
        ref={dialogRef}
        className="wd-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Case study: ${props.project.title}`}
        data-variant={props.variant}
        data-nav={props.nav}
      >
        {props.variant === "expand" && props.nav === "header" ? (
          <NavHeaderBar
            layout={layout}
            visible={ready && !props.closing}
            onRequestClose={props.onRequestClose}
          />
        ) : null}

        {props.variant === "expand" ? (
          <ReaderNav
            mode={props.nav}
            layout={layout}
            closing={props.closing}
            reduce={reduce}
          />
        ) : null}

        {props.variant === "sheet" ? (
          <SheetDrawer {...props} reduce={reduce} />
        ) : null}
        {props.variant === "side" ? (
          <SideDrawer {...props} reduce={reduce} />
        ) : null}
        {props.variant === "expand" ? (
          <ExpandDrawer
            {...props}
            reduce={reduce}
            layout={layout}
            onReady={() => setReady(true)}
          />
        ) : null}
      </div>
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
 * Keeps Tab inside the dialog (the nav is part of it), and moves the initial
 * focus to the close button once the reader is ready — the nav stays usable
 * and visible while the surface is still morphing.
 */
function useDrawerFocus(
  rootRef: RefObject<HTMLDivElement | null>,
  ready: boolean,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !root) return;

      const nodes = [
        ...root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => !node.closest("[inert]"));
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
  }, [rootRef]);

  useEffect(() => {
    if (!ready) return;

    rootRef.current
      ?.querySelector<HTMLElement>("[data-wd-close]")
      ?.focus({ preventScroll: true });
  }, [rootRef, ready]);
}

/** One reader, mounted by every variant. */
function DrawerContent({
  project,
  setup,
  content,
  reduce,
  onNext,
  scrollRef,
}: {
  project: Project;
  setup: Setup;
  content?: ContentVariant;
  reduce: boolean;
  onNext: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const index = Math.max(0, projectIndex(project.slug));
  const next = nextProject(project.slug);

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
      <div className="wd-column" data-content={content}>
        <AnimatePresence
          mode="wait"
          initial={false}
          onExitComplete={onExitComplete}
        >
          <motion.div
            key={`${project.slug}-${content ?? "classic"}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{
              duration: reduce ? 0.12 : 0.18,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            {content ? (
              <ReaderContent
                project={project}
                next={next}
                content={content}
                onNext={onNext}
              />
            ) : (
              <CaseStudy
                project={project}
                next={next}
                index={index}
                total={PROJECTS.length}
                setup={setup}
                onNext={onNext}
              />
            )}
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const openPose = reduce ? { opacity: 1 } : { y: 0 };
  const closedPose = reduce ? { opacity: 0 } : { y: "100%" };

  return (
    <motion.div
      className="wd-sheet"
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const openPose = reduce ? { opacity: 1 } : { x: 0 };
  const closedPose = reduce ? { opacity: 0 } : { x: "100%" };

  return (
    <motion.div
      className="wd-side"
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

function fallbackStart(target: Rect): Rect {
  return {
    left: target.left + target.width * 0.22,
    top: target.top + target.height * 0.2,
    width: target.width * 0.56,
    height: target.height * 0.6,
  };
}

function panelStyle(target: Rect, layout: ReaderLayout): CSSProperties {
  return {
    position: "fixed",
    left: target.left,
    top: target.top,
    width: target.width,
    height: target.height,
    transformOrigin: "top left",
    "--wd-pad-top": `${layout.padTop}px`,
    "--wd-pad-bottom": `${layout.padBottom}px`,
  } as CSSProperties;
}

function ExpandDrawer({
  project,
  setup,
  nav,
  content,
  origin,
  closing,
  reduce,
  layout,
  onNext,
  onRequestClose,
  onClosed,
  onReady,
}: DrawerProps & {
  reduce: boolean;
  layout: ReaderLayout;
  onReady: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"morph" | "open">(
    reduce ? "open" : "morph",
  );
  const [titleTo, setTitleTo] = useState<Rect | null>(null);

  const target = layout.panel;
  const from = origin?.card ?? fallbackStart(target);
  const titleFrom = origin?.title ?? null;
  const contentVisible = phase === "open" && !closing;

  // Measure the reader title in the panel's target space. Because the panel
  // is only transformed (never resized), dividing by its current scale gives
  // the untransformed layout rect — no duplicate hidden tree needed.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const title = panel?.querySelector<HTMLElement>("#wd-study-title");
    if (!panel || !title || !titleFrom) return;

    const panelRect = panel.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const scaleX = panelRect.width / target.width || 1;
    const scaleY = panelRect.height / target.height || 1;

    setTitleTo({
      left: target.left + (titleRect.left - panelRect.left) / scaleX,
      top: target.top + (titleRect.top - panelRect.top) / scaleY,
      width: titleRect.width / scaleX,
      height: titleRect.height / scaleY,
    });
  }, [target, titleFrom]);

  const closedPose = reduce
    ? { opacity: 0 }
    : {
        x: from.left - target.left,
        y: from.top - target.top,
        scaleX: from.width / target.width,
        scaleY: from.height / target.height,
      };
  const openPose = reduce
    ? { opacity: 1 }
    : { x: 0, y: 0, scaleX: 1, scaleY: 1 };

  return (
    <>
      <motion.div
        ref={panelRef}
        className="wd-expand"
        data-nav={nav}
        style={panelStyle(target, layout)}
        initial={closedPose}
        animate={closing ? closedPose : openPose}
        transition={
          reduce
            ? { duration: 0.12, ease: "easeOut" }
            : {
                duration: closing ? CLOSE_S : MORPH_S,
                ease: closing ? "easeIn" : EASE_ENTER,
              }
        }
        onAnimationComplete={() => {
          if (closing) {
            onClosed();
            return;
          }

          setPhase("open");
          onReady();
        }}
      >
        <div
          className="wd-expand-reader"
          data-visible={contentVisible ? "" : undefined}
          data-closing={closing ? "" : undefined}
          inert={!contentVisible}
        >
          {nav !== "header" ? (
            <CloseButton
              className="wd-float-close"
              onRequestClose={onRequestClose}
            />
          ) : null}

          <DrawerContent
            project={project}
            setup={setup}
            content={content}
            reduce={reduce}
            onNext={onNext}
            scrollRef={scrollRef}
          />
        </div>
      </motion.div>

      {titleFrom && !reduce ? (
        <motion.h2
          aria-hidden="true"
          className="wd-title-fly text-balance text-title-sm font-semibold md:text-title"
          initial={{
            left: titleFrom.left,
            top: titleFrom.top,
            width: titleFrom.width,
          }}
          animate={{
            left: (closing ? titleFrom : (titleTo ?? titleFrom)).left,
            top: (closing ? titleFrom : (titleTo ?? titleFrom)).top,
            width: (closing ? titleFrom : (titleTo ?? titleFrom)).width,
            opacity: contentVisible ? 0 : 1,
          }}
          transition={{
            left: {
              duration: closing ? CLOSE_S : MORPH_S,
              ease: closing ? "easeIn" : EASE_ENTER,
            },
            top: {
              duration: closing ? CLOSE_S : MORPH_S,
              ease: closing ? "easeIn" : EASE_ENTER,
            },
            width: {
              duration: closing ? CLOSE_S : MORPH_S,
              ease: closing ? "easeIn" : EASE_ENTER,
            },
            opacity: {
              duration: 0.18,
              ease: "easeOut",
              delay: contentVisible ? 0.05 : 0,
            },
          }}
          style={{
            position: "fixed",
            zIndex: 3,
            margin: 0,
            pointerEvents: "none",
          }}
        >
          {project.title}
        </motion.h2>
      ) : null}
    </>
  );
}
