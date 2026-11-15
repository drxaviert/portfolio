import type { JSX } from "react";
import { TokenRow } from "@/components/system/token-row";
import { PALETTE, ROLES } from "@/lib/system/source.generated";

function resolvePalette(value: string): string {
  return value.replace(
    /var\((--[\w-]+)\)/g,
    (match, name: string) => PALETTE[name] ?? match,
  );
}

const DAY_SHADOW = resolvePalette(ROLES.day["--shadow-card"]);
const NIGHT_SHADOW = resolvePalette(ROLES.night["--shadow-card"]);

function ShadowCard({
  label,
  shadow,
  surface,
  ink,
}: {
  label: string;
  shadow: string;
  surface: string;
  ink: string;
}): JSX.Element {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </p>
      <div
        className="mt-2 rounded-lg p-5"
        style={{ backgroundColor: surface, color: ink, boxShadow: shadow }}
      >
        <p className="text-sm font-medium">Card · --shadow-card</p>
        <p className="mt-1 text-xs opacity-70">Shadow only. No border.</p>
      </div>
    </div>
  );
}

export function ShadowSection(): JSX.Element {
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-xs leading-relaxed text-on-surface-variant">
        Cards never take a stroke; elevation is the shadow alone. The light and
        dark values below are the shipped defaults.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <ShadowCard
          label="Day"
          shadow={DAY_SHADOW}
          surface="var(--palette-neutral-50)"
          ink="var(--palette-neutral-700)"
        />
        <ShadowCard
          label="Night"
          shadow={NIGHT_SHADOW}
          surface="var(--palette-neutral-700)"
          ink="var(--palette-neutral-100)"
        />
      </div>

      <TokenRow
        token="--shadow-card"
        usage="The only elevation token. Use shadow-card, never a border."
        preview={
          <span
            aria-hidden="true"
            className="block size-12 rounded-md bg-surface-container-low"
            style={{ boxShadow: "var(--shadow-card)" }}
          />
        }
      />
    </div>
  );
}
