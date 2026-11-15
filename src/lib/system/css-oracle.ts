import { readFileSync } from "node:fs";
import path from "node:path";
import type { Phase } from "@/lib/theme";

/**
 * Test-only oracle: reads the real `globals.css` / `home-entrance.css` text and
 * resolves the engine's token families the way the browser would, without
 * importing the generated TS source (which would make parity a tautology).
 */

type Records = Record<string, string>;

const PHASES: readonly Phase[] = ["dawn", "day", "dusk", "night"];

type ParsedGlobals = {
  root: Records;
  palette: Records;
  roles: Record<Phase, Records>;
  radii: Records;
  durations: Records;
  eases: Records;
};

const GLOBALS_PATH = path.resolve(process.cwd(), "src/app/globals.css");
const ENTRANCE_PATH = path.resolve(
  process.cwd(),
  "src/components/home/home-entrance.css",
);

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function declarations(body: string): Records {
  const result: Records = {};

  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    result[match[1]] = match[2].trim().replace(/\s+/g, " ");
  }

  return result;
}

function blocks(css: string): Array<{ selectors: string[]; body: string }> {
  const result: Array<{ selectors: string[]; body: string }> = [];

  for (const match of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    result.push({
      selectors: match[1].split(",").map((selector) => selector.trim()),
      body: match[2],
    });
  }

  return result;
}

function pickPrefix(source: Records, prefix: string): Records {
  return Object.fromEntries(
    Object.entries(source).filter(([name]) => name.startsWith(prefix)),
  );
}

const phaseSelector = /^\[data-phase="(dawn|day|dusk|night)"\]$/;

function parseGlobals(): ParsedGlobals {
  const root: Records = {};
  const roles: Record<Phase, Records> = {
    dawn: {},
    day: {},
    dusk: {},
    night: {},
  };
  const theme: Records = {};

  for (const block of blocks(readFileSync(GLOBALS_PATH, "utf8"))) {
    const values = declarations(block.body);

    for (const selector of block.selectors) {
      if (selector === ":root") Object.assign(root, values);

      const phase = selector.match(phaseSelector)?.[1] as Phase | undefined;

      if (phase) Object.assign(roles[phase], values);

      if (selector.startsWith("@theme")) Object.assign(theme, values);
    }
  }

  // `home-entrance.css` carries the one-off entrance timings; only the
  // duration-valued ones belong to the engine.
  const durations: Records = pickPrefix(root, "--duration-");

  for (const block of blocks(readFileSync(ENTRANCE_PATH, "utf8"))) {
    const isEntranceScope =
      block.selectors.includes(".entrance-scope") ||
      block.selectors.includes('[data-entrance="soft"]');

    if (!isEntranceScope) continue;

    for (const [name, value] of Object.entries(declarations(block.body))) {
      if (/^-?\d*\.?\d+m?s$/.test(value) || /^var\(--duration-[\w-]+\)$/.test(value)) {
        durations[name] = value;
      }
    }
  }

  return {
    root,
    palette: pickPrefix(root, "--palette-"),
    roles,
    radii: pickPrefix(theme, "--radius-"),
    durations,
    eases: pickPrefix(root, "--ease-"),
  };
}

let cached: ParsedGlobals | null = null;

function parsed(): ParsedGlobals {
  cached ??= parseGlobals();

  return cached;
}

function resolveVars(value: string, scope: Records): string {
  let result = value;

  for (let pass = 0; pass < 20 && result.includes("var("); pass += 1) {
    const next = result.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,
      (_match, name: string, fallback?: string) => {
        const resolved = scope[name];

        if (resolved !== undefined) return resolved;
        if (fallback !== undefined) return fallback.trim();

        throw new Error(`css-oracle: could not resolve var(${name})`);
      },
    );

    if (next === result) break;
    result = next;
  }

  return result;
}

function resolveAll(source: Records, scope: Records): Records {
  return Object.fromEntries(
    Object.entries(source).map(([name, value]) => [
      name,
      resolveVars(value, scope),
    ]),
  );
}

/** Raw (still var()-referencing) role values for one phase. */
export function rawRoleTokens(phase: Phase): Records {
  return parsed().roles[phase];
}

/** Every engine token, resolved the way the browser would for `phase`. */
export function oracleTokens(phase: Phase): Records {
  const source = parsed();
  const scope = { ...source.root, ...source.roles[phase] };

  return {
    ...source.palette,
    ...resolveAll(source.roles[phase], scope),
    ...source.radii,
    ...resolveAll(source.durations, source.durations),
    ...source.eases,
    "--orb-gradient": resolveVars(source.root["--orb-gradient"], scope),
  };
}

export { PHASES };
