"use client";

import type { JSX } from "react";
import { ComponentDoc } from "@/components/system/component-doc";
import { CardSample } from "@/components/system/samples/card-sample";

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
    </div>
  );
}
