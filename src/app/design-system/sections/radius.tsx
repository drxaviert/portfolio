import type { JSX } from "react";
import { TokenRow } from "@/components/system/token-row";
import { RADII } from "@/lib/system/source.generated";

const RADIUS_TOKENS = Object.keys(RADII);

const FIXED_GEOMETRY = [
  "rounded-full (9999px): nav glyph, tracker dots, bottom-sheet handle",
  "rounded-[6px]: theme toggle segments and the dev phase picker",
  "rounded-t-2xl: the phone bottom sheet's top corners",
];

export function RadiusSection(): JSX.Element {
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-xs leading-relaxed text-on-surface-variant">
        Roundness multiplies these four tokens. Zero stays square and the pill
        stays a pill; geometry that is not a radius token does not move.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {RADIUS_TOKENS.map((token) => (
          <TokenRow
            key={token}
            token={token}
            usage="Radius token. Boxes, cards and inner surfaces follow it."
            preview={
              <span
                aria-hidden="true"
                className="block size-12 bg-surface-container-high shadow-card"
                style={{ borderRadius: `var(${token})` }}
              />
            }
          />
        ))}

        <div className="flex min-w-0 items-center gap-3 rounded-md bg-surface-container-low p-3 shadow-card">
          <span
            aria-hidden="true"
            className="block h-8 w-12 shrink-0 rounded-full bg-surface-container-high shadow-card"
          />
          <div className="min-w-0">
            <code className="font-mono text-xs">pill · 9999px</code>
            <p className="mt-1 text-xs text-on-surface-variant">
              Not a radius token; always stays a pill.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Fixed geometry</h3>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-on-surface-variant">
          {FIXED_GEOMETRY.map((item) => (
            <li key={item} className="break-words">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
