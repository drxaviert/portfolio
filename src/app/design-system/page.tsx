import type { Metadata } from "next";
import { SECTIONS } from "./sections";
import type { SectionId } from "./sections";
import { SystemShell } from "./system-shell";

export const metadata: Metadata = {
  title: "Design system",
};

const SUMMARIES: Record<SectionId, string> = {
  overview: "What the system is and how one parameter reaches a component.",
  parameters: "The five source parameters and everything each one moves.",
  colour: "The primitive palette and the per-phase colour roles.",
  type: "The type scale and Work Sans.",
  radius: "Radius tokens, and the geometry that is not a radius token.",
  shadow: "The card shadow, light and dark.",
  motion: "Durations, easings and the Glide spring.",
  components: "Cards, nav, theme toggle and tracker, with their states.",
};

export default function DesignSystemPage() {
  return (
    <SystemShell>
      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-title`}
          className="scroll-mt-8 rounded-lg bg-surface-container-low p-6 shadow-card"
        >
          <h2
            id={`${section.id}-title`}
            className="text-xl font-medium tracking-tight"
          >
            {section.label}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            {SUMMARIES[section.id]}
          </p>
          <p className="mt-4 text-sm text-on-surface-variant">
            This section is filled in by the next step of the build.
          </p>
        </section>
      ))}
    </SystemShell>
  );
}
