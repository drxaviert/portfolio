"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Phase } from "@/lib/theme";
import { getActivePhase, THEME_CHANGE_EVENT } from "@/lib/theme";
import type { TokenMap } from "@/lib/system/derive";
import { createSystemEngine } from "@/lib/system/engine";
import type { SystemEngine } from "@/lib/system/engine";
import {
  clampParams,
  DEFAULT_PARAMS,
  parseQuery,
  serializeQuery,
  todForPhase,
} from "@/lib/system/params";
import type { Params } from "@/lib/system/params";

const URL_DEBOUNCE_MS = 200;

type Listener = (tokens: TokenMap, params: Params) => void;

type EngineFacade = {
  engine: SystemEngine;
  attach(next: SystemEngine): void;
  detach(): void;
};

/**
 * The hook owns the engine's lifetime, but the engine cannot exist during the
 * SSR render. The facade is stable from the first render: calls before the
 * effect runs are harmless, and subscribers registered early are forwarded
 * once the real engine attaches.
 */
function createEngineFacade(): EngineFacade {
  let current: SystemEngine | null = null;
  let unsubscribeEngine: (() => void) | null = null;
  const listeners = new Set<Listener>();

  return {
    engine: {
      set(params) {
        current?.set(params);
      },
      get() {
        return current?.get() ?? { ...DEFAULT_PARAMS };
      },
      subscribe(listener) {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
      spring(base) {
        return current?.spring(base) ?? base;
      },
      dispose() {
        current?.dispose();
      },
    },
    attach(next) {
      current = next;
      unsubscribeEngine = next.subscribe((tokens, params) => {
        for (const listener of listeners) listener(tokens, params);
      });
    },
    detach() {
      unsubscribeEngine?.();
      unsubscribeEngine = null;
      current?.dispose();
      current = null;
      listeners.clear();
    },
  };
}

export function useSystemParams(): {
  params: Params;
  setParam<K extends keyof Params>(key: K, value: Params[K]): void;
  reset(): void;
  sitePhase: Phase;
  engine: SystemEngine;
} {
  const [facade] = useState<EngineFacade>(createEngineFacade);
  const [params, setParamsState] = useState<Params>(DEFAULT_PARAMS);
  // The server cannot know the visitor's phase; the effect below reads it.
  const [sitePhase, setSitePhase] = useState<Phase>("day");

  const paramsRef = useRef<Params>(DEFAULT_PARAMS);
  const phaseRef = useRef<Phase>("day");
  const urlTimer = useRef<number | null>(null);
  const pendingUrl = useRef<{ params: Params; phase: Phase } | null>(null);
  const stateFrame = useRef<number | null>(null);

  const scheduleUrl = useCallback((next: Params, phase: Phase) => {
    pendingUrl.current = { params: next, phase };

    if (urlTimer.current !== null) window.clearTimeout(urlTimer.current);

    urlTimer.current = window.setTimeout(() => {
      urlTimer.current = null;

      const pending = pendingUrl.current;

      pendingUrl.current = null;

      if (!pending) return;

      const query = serializeQuery(pending.params, pending.phase);

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query}${window.location.hash}`,
      );
    }, URL_DEBOUNCE_MS);
  }, []);

  const commitNow = useCallback(
    (next: Params) => {
      paramsRef.current = next;

      if (stateFrame.current !== null) {
        window.cancelAnimationFrame(stateFrame.current);
        stateFrame.current = null;
      }

      setParamsState(next);
      facade.engine.set(next);
    },
    [facade],
  );

  /** Coalesces drags: React state follows at most once per animation frame. */
  const scheduleState = useCallback(() => {
    if (stateFrame.current !== null) return;

    stateFrame.current = window.requestAnimationFrame(() => {
      stateFrame.current = null;
      setParamsState({ ...paramsRef.current });
    });
  }, []);

  useEffect(() => {
    const phase = getActivePhase();

    phaseRef.current = phase;

    // The URL and the visitor's phase are client-only: the first paint is the
    // SSR default and this effect is the first place they can be read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSitePhase(phase);

    const initial = parseQuery(window.location.search, phase);

    paramsRef.current = initial;
    setParamsState(initial);

    const engine = createSystemEngine();

    facade.attach(engine);
    engine.set(initial);

    const onThemeChange = () => {
      const nextPhase = getActivePhase();

      setSitePhase(nextPhase);

      if (nextPhase === phaseRef.current) return;

      phaseRef.current = nextPhase;

      const next = clampParams({
        ...paramsRef.current,
        tod: todForPhase(nextPhase),
      });

      commitNow(next);
      scheduleUrl(next, nextPhase);
    };

    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);

      if (urlTimer.current !== null) {
        window.clearTimeout(urlTimer.current);
        urlTimer.current = null;
      }

      if (stateFrame.current !== null) {
        window.cancelAnimationFrame(stateFrame.current);
        stateFrame.current = null;
      }

      facade.detach();
    };
  }, [commitNow, facade, scheduleUrl]);

  const setParam = useCallback(
    <K extends keyof Params>(key: K, value: Params[K]) => {
      const next = clampParams({ ...paramsRef.current, [key]: value });

      // The engine is updated immediately and coalesces its own rAF write;
      // React state only catches up once per frame.
      paramsRef.current = next;
      facade.engine.set(next);
      scheduleState();
      scheduleUrl(next, phaseRef.current);
    },
    [facade, scheduleState, scheduleUrl],
  );

  const reset = useCallback(() => {
    const phase = getActivePhase();
    const next = { ...DEFAULT_PARAMS, tod: todForPhase(phase) };

    phaseRef.current = phase;
    setSitePhase(phase);
    commitNow(next);
    scheduleUrl(next, phase);
  }, [commitNow, scheduleUrl]);

  return { params, setParam, reset, sitePhase, engine: facade.engine };
}
