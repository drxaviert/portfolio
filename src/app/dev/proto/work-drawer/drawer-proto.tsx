"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HomeLayout } from "@/components/home/home-layout";
import { WorkDrawer } from "./drawer";
import { DrawerPanel } from "./panel";
import { nextProject, projectBySlug, PROJECTS } from "./works";
import type { Origin, Rect, Setup, Variant } from "./types";
import "./work-drawer.css";

/**
 * Throwaway prototype: compare three drawer treatments for opening a full
 * case study from the home work row.
 *
 * The real HomeLayout renders behind (with its optional `work` hook attached),
 * the drawer is a sibling so the scaled/dimmed page never clips it, and the
 * dev panel floats above everything.
 */

const STACK_PROJECTS = PROJECTS.slice(1, 4);

function toRect(element: Element): Rect {
  const rect = element.getBoundingClientRect();

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function slugFromUrl(): string | null {
  const value = new URLSearchParams(window.location.search).get("project");

  return projectBySlug(value)?.slug ?? null;
}

export function DrawerProto() {
  const [setup, setSetup] = useState<Setup>("featured");
  const [variant, setVariant] = useState<Variant>("sheet");
  const [slug, setSlugState] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [origin, setOrigin] = useState<Origin | null>(null);

  const slugRef = useRef<string | null>(null);
  const pushedRef = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const setSlug = useCallback((next: string | null) => {
    slugRef.current = next;
    setSlugState(next);
  }, []);

  const openProject = useCallback(
    (index: number, element: HTMLElement | null) => {
      const project = PROJECTS[index];
      if (!project) return;

      const card = element ? toRect(element) : null;
      const title = element?.querySelector<HTMLElement>("h1");

      setOrigin(card ? { card, title: title ? toRect(title) : null } : null);
      triggerRef.current =
        element ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      pushedRef.current = true;
      setClosing(false);
      setSlug(project.slug);

      const url = new URL(window.location.href);
      url.searchParams.set("project", project.slug);
      window.history.pushState(
        { ...(window.history.state ?? {}), wd: true },
        "",
        url,
      );
    },
    [setSlug],
  );

  const goNext = useCallback(() => {
    const current = slugRef.current;
    if (!current) return;

    const next = nextProject(current);
    setSlug(next.slug);

    const url = new URL(window.location.href);
    url.searchParams.set("project", next.slug);
    window.history.replaceState(window.history.state, "", url);
  }, [setSlug]);

  const requestClose = useCallback(() => {
    if (!slugRef.current) return;
    setClosing(true);
  }, []);

  /** Runs after the active drawer's exit animation. */
  const handleClosed = useCallback(() => {
    const stillInUrl = slugFromUrl();
    const wasPushed = pushedRef.current;

    pushedRef.current = false;
    setSlug(null);
    setClosing(false);
    setOrigin(null);

    if (stillInUrl) {
      if (wasPushed) {
        window.history.back();
      } else {
        const url = new URL(window.location.href);
        url.searchParams.delete("project");
        window.history.replaceState(window.history.state, "", url);
      }
    }
  }, [setSlug]);

  // Open from a deep link, and let browser Back close the drawer.
  useEffect(() => {
    function sync() {
      const next = slugFromUrl();

      if (!next) {
        if (slugRef.current) setClosing(true);
        return;
      }

      if (next !== slugRef.current) {
        setOrigin(null);
        setSlug(next);
        setClosing(false);
      }
    }

    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [setSlug]);

  // Escape closes; the exit animation then unmounts.
  useEffect(() => {
    if (!slug) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slug, requestClose]);

  // Body scroll lock, with the scrollbar width paid back so nothing shifts.
  useEffect(() => {
    if (!slug) return;

    const body = document.body;
    const overflow = body.style.overflow;
    const paddingRight = body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = paddingRight;
    };
  }, [slug]);

  // Restore focus once the card is no longer inert (the same commit that
  // unmounts the drawer removes it, so this cannot run inside onClosed).
  useEffect(() => {
    if (slug) return;

    const trigger = triggerRef.current;
    if (!trigger) return;

    triggerRef.current = null;
    trigger.focus({ preventScroll: true });
  }, [slug]);

  const work = useMemo(
    () => ({
      title: PROJECTS[0].title,
      onOpen: (element: HTMLElement) => openProject(0, element),
      slivers:
        setup === "stack"
          ? STACK_PROJECTS.map((project, index) => ({
              title: project.title,
              onOpen: (element: HTMLElement) => openProject(index + 1, element),
            }))
          : undefined,
    }),
    [setup, openProject],
  );

  const project = projectBySlug(slug);

  return (
    <div
      className="wd-page"
      data-open={slug ? "true" : undefined}
      data-variant={variant}
    >
      <div className="wd-home" inert={slug ? true : undefined}>
        <HomeLayout work={work} />
      </div>

      {project ? (
        <WorkDrawer
          project={project}
          setup={setup}
          variant={variant}
          origin={origin}
          closing={closing}
          onNext={goNext}
          onRequestClose={requestClose}
          onClosed={handleClosed}
        />
      ) : null}

      <DrawerPanel
        setup={setup}
        variant={variant}
        onSetup={setSetup}
        onVariant={setVariant}
      />
    </div>
  );
}
