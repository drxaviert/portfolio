import { describe, expect, it } from "vitest";
import { POWER3_IN_OUT_EASE, TRANSITION } from "@/components/canvas/transition";
import {
  HUMAN_CONTACT_CLOSE,
  HUMAN_CONTACT_MOTION,
  HUMAN_CONTACT_MOTION_CSS,
  HUMAN_CONTACT_OPEN,
  HUMAN_CONTACT_VIEW_TRANSITION,
  humanContactTileTransform,
} from "./human-contact-motion";

describe("Human Contact route motion", () => {
  it("takes the canvas tile's open and close timings", () => {
    expect(HUMAN_CONTACT_MOTION.openMs).toBe(TRANSITION.glideMs);
    expect(HUMAN_CONTACT_MOTION.closeMs).toBe(TRANSITION.closeShrinkMs);
    expect(HUMAN_CONTACT_MOTION.pageFadeMs).toBe(TRANSITION.fadeOutMs);
    expect(HUMAN_CONTACT_MOTION.ease).toBe(POWER3_IN_OUT_EASE);
  });

  it("writes the timings into the properties globals.css reads", () => {
    expect(HUMAN_CONTACT_MOTION_CSS).toContain(
      `--human-contact-open-duration: ${TRANSITION.glideMs}ms`,
    );
    expect(HUMAN_CONTACT_MOTION_CSS).toContain(
      `--human-contact-close-duration: ${TRANSITION.closeShrinkMs}ms`,
    );
    expect(HUMAN_CONTACT_MOTION_CSS).toContain(
      `--human-contact-page-fade-duration: ${TRANSITION.fadeOutMs}ms`,
    );
    expect(HUMAN_CONTACT_MOTION_CSS).toContain(
      `--human-contact-ease: ${POWER3_IN_OUT_EASE}`,
    );
  });

  it("keeps one shared name and a distinct class per direction", () => {
    expect(HUMAN_CONTACT_VIEW_TRANSITION).toBe("human-contact");
    expect(HUMAN_CONTACT_OPEN).toBe("human-contact-open");
    expect(HUMAN_CONTACT_CLOSE).toBe("human-contact-close");
    expect(HUMAN_CONTACT_OPEN).not.toBe(HUMAN_CONTACT_CLOSE);
  });
});

describe("humanContactTileTransform", () => {
  it("covers the embed rect and centres the crop", () => {
    const transform = humanContactTileTransform(
      { left: 272.5, top: 202.734375, width: 880, height: 495 },
      1440,
      900,
    );

    expect(transform.scale).toBeCloseTo(880 / 1440, 6);
    expect(transform.x).toBeCloseTo(272.5, 4);
    expect(transform.y).toBeCloseTo(175.234375, 4);
    expect(transform.clipX).toBeCloseTo(0, 4);
    expect(transform.clipY).toBeCloseTo(45, 4);
  });

  it("lands the full viewport as an untouched snapshot", () => {
    const transform = humanContactTileTransform(
      { left: 0, top: 0, width: 1440, height: 900 },
      1440,
      900,
    );

    expect(transform).toEqual({ scale: 1, x: 0, y: 0, clipX: 0, clipY: 0 });
  });

  it("clamps a tile that is partly off screen", () => {
    const transform = humanContactTileTransform(
      { left: -100, top: 850, width: 880, height: 495 },
      1440,
      900,
    );

    expect(transform.x).toBeCloseTo(0, 4);
    expect(transform.y).toBeGreaterThan(0);
    expect(transform.y).toBeLessThan(405);
  });
});
