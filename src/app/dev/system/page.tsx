import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PHASE_STARTS } from "@/lib/theme";
import type { Phase } from "@/lib/theme";

/**
 * Dev-only token preview. Every phase card re-declares data-phase, so the same
 * markup renders with that phase's colours, shadows and toggle.
 * Deep links into this route 404 in a production build.
 */
export const metadata = {
  title: "System · tokens",
  robots: { index: false, follow: false },
};

const PHASES: { phase: Phase; label: string; hours: string }[] = [
  { phase: "dawn", label: "Dawn", hours: "5–8" },
  { phase: "day", label: "Day", hours: "8–17" },
  { phase: "dusk", label: "Dusk", hours: "17–20" },
  { phase: "night", label: "Night", hours: "20–5" },
];

const COLOUR_TOKENS = [
  { name: "--surface", className: "bg-surface" },
  { name: "--surface-dim", className: "bg-surface-dim" },
  { name: "--surface-bright", className: "bg-surface-bright" },
  { name: "--surface-container-low", className: "bg-surface-container-low" },
  { name: "--surface-container", className: "bg-surface-container" },
  { name: "--surface-container-high", className: "bg-surface-container-high" },
  {
    name: "--surface-container-highest",
    className: "bg-surface-container-highest",
  },
  { name: "--on-surface", className: "bg-on-surface" },
  { name: "--on-surface-variant", className: "bg-on-surface-variant" },
  { name: "--outline", className: "bg-outline" },
  { name: "--outline-variant", className: "bg-outline-variant" },
  { name: "--primary", className: "bg-primary" },
  { name: "--on-primary", className: "bg-on-primary" },
  { name: "--secondary", className: "bg-secondary" },
  { name: "--toggle-track", className: "bg-toggle-track" },
  { name: "--toggle-selected", className: "bg-toggle-selected" },
];

const TRACKER_TOKENS = [
  { name: "--tracker-0", className: "bg-tracker-0" },
  { name: "--tracker-1", className: "bg-tracker-1" },
  { name: "--tracker-2", className: "bg-tracker-2" },
  { name: "--tracker-3", className: "bg-tracker-3" },
  { name: "--tracker-4", className: "bg-tracker-4" },
];

function PhaseCard({
  phase,
  label,
  hours,
}: {
  phase: Phase;
  label: string;
  hours: string;
}) {
  return (
    <section
      data-phase={phase}
      className="rounded-lg bg-surface p-4 text-on-surface shadow-card"
    >
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">{label}</h2>
        <p className="text-xs text-on-surface-variant">{hours}</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {COLOUR_TOKENS.map((token) => (
          <div key={token.name}>
            <div className={`h-12 rounded-md ${token.className}`} />
            <p className="mt-1 font-mono text-[10px] leading-tight text-on-surface-variant">
              {token.name}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-5 mb-2 text-xs font-medium text-on-surface-variant">
        Tracker ramp
      </p>
      <div className="flex overflow-hidden rounded-md">
        {TRACKER_TOKENS.map((token) => (
          <div
            key={token.name}
            className={`h-10 flex-1 ${token.className}`}
            title={token.name}
          />
        ))}
      </div>

      <p className="mt-5 mb-2 text-xs font-medium text-on-surface-variant">
        Shadow
      </p>
      <div className="rounded-lg bg-surface-container-low p-3 shadow-card">
        <p className="text-sm">Card · shadow-card</p>
        <p className="text-xs text-on-surface-variant">
          No border, solid fill.
        </p>
      </div>

      <p className="mt-5 mb-2 text-xs font-medium text-on-surface-variant">
        Toggle
      </p>
      <ThemeToggle />
    </section>
  );
}

export default function SystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface p-6 text-on-surface">
      <header className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-medium">Design tokens · phases</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Dev-only preview. Tokens mirror docs/design-system/tokens.md. Auto
          follows the local clock (dawn {PHASE_STARTS.dawn}:00, day{" "}
          {PHASE_STARTS.day}:00, dusk {PHASE_STARTS.dusk}:00, night{" "}
          {PHASE_STARTS.night}:00). Day mode never shows night: 20–02 reads as
          day and 02–05 as dawn. Night mode is always night.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PHASES.map((entry) => (
          <PhaseCard key={entry.phase} {...entry} />
        ))}
      </div>
    </main>
  );
}
