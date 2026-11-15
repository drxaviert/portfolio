"use client";

import type { JSX } from "react";
import { ComponentDoc } from "@/components/system/component-doc";
import { CardSample } from "@/components/system/samples/card-sample";
import {
  NavGlideDemo,
  NavItemSample,
} from "@/components/system/samples/nav-item-sample";
import { ThemeToggleSample } from "@/components/system/samples/theme-toggle-sample";

export function ComponentsSection(): JSX.Element {
  return (
    <div className="space-y-8">
      <ComponentDoc
        name="Card"
        description="The ring card: a shadow-card surface at rest, and a 1px ring that grows outward on hover or keyboard focus."
        states={["rest", "hover", "focus-visible"]}
        render={(state) => <CardSample forceState={state} />}
        use={[
          "Project and work tiles on the home grid.",
          "Let the ring grow into the gutters; keep content inside the rest box.",
        ]}
        dont={[
          "Don’t add a border; the card is shadow-card plus the ring.",
          "Don’t add a click affordance: cards are hover-only today.",
        ]}
        tokens={[
          "--shadow-card",
          "--radius-lg",
          "--surface-container-low",
          "--frame-line",
          "--horizon-ring-glow",
        ]}
        notes="Cards are hover-only today: the ring is feedback, not a link. Nothing on the card is clickable until the work-drawer job lands."
      />

      <ComponentDoc
        name="Nav item + Glide"
        description="A nav label with one shared capsule across the whole item run. Hover or keyboard focus slides and stretches the capsule; the glyph is part of the same run."
        states={["rest", "hover", "active", "focus-visible"]}
        render={(state) =>
          state === undefined ? (
            <div className="p-2">
              <NavGlideDemo />
            </div>
          ) : (
            <NavItemSample
              label="Work"
              forceState={state}
              active={state === "active"}
            />
          )
        }
        use={[
          "The home nav labels and the design-system glyph.",
          "Let one capsule serve the whole run, and retarget it mid-flight as the pointer sweeps.",
        ]}
        dont={[
          "Don’t give an item its own capsule or transition.",
          "Don’t add a filled hover state to a non-current item; the capsule is the hover.",
        ]}
        tokens={[
          "--primary",
          "--on-surface",
          "--surface-container",
          "--radius-md",
          "--duration-short-2",
          "--duration-short-3",
          "--duration-medium-5",
        ]}
        notes="The Glide spring is read through the engine, so Motion speed time-scales it. The capsule is a clip-path on a shared layer (paint-only, no layout), the glyph is part of the run, and reduced motion hides the capsule, as on the site."
      />

      <ComponentDoc
        name="Theme toggle"
        description="Day · Night · Auto, plus the Day phase row (Clock/Dawn/Midday/Dusk). Documented as it exists on the site; on this page picking a phase also moves the tod slider."
        states={["rest", "focus-visible"]}
        render={(state) =>
          state === undefined ? (
            <div className="flex justify-end p-4 pt-20">
              <ThemeToggleSample />
            </div>
          ) : (
            <ThemeToggleSample forceState={state} />
          )
        }
        use={[
          "The site header's theme control: Day, Night, Auto, with the Day phase row for Clock or a pinned phase.",
          "Let the sample drive this page's tod when a phase is picked; it never changes the real site theme.",
        ]}
        dont={[
          "Don’t treat the sample as the site control: it mirrors the markup and writes nothing to storage or the document.",
          "Don’t add a new icon set; the glyphs are the live toggle’s.",
        ]}
        tokens={["--toggle-track", "--toggle-selected", "--primary"]}
        notes="The toggle’s pointer and open states are driven by JS, so only rest and focus-visible are forced in the matrix; the live sample covers the rest. Picking a phase moves only this page’s time of day — no localStorage writes and no site theme change."
      />
    </div>
  );
}
