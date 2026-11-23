"use client";

import { HumanContactFull } from "@/components/human-contact/human-contact-full";
import {
  LIGHTING_CHOICES,
  selectLightingChoice,
  useLightingChoice,
} from "./lighting-choice";

/**
 * The dev lighting lab: the full-screen composition with a three-way preset
 * switch. It is the only place the presets are reachable; /live and /work
 * keep the shipped current rig until Dat picks one.
 */
export function HumanContactLightingDev() {
  const choice = useLightingChoice();
  const option =
    LIGHTING_CHOICES.find((item) => item.id === choice) ?? LIGHTING_CHOICES[0];

  return (
    <>
      <HumanContactFull lighting={option.preset} />

      <div className="light-toggle" role="group" aria-label="Lighting preset">
        {LIGHTING_CHOICES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={choice === item.id}
            onClick={() => selectLightingChoice(item.id)}
          >
            {item.id} · {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
