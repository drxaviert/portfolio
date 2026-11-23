"use client";

/**
 * The dev harness now reads the shipped orb, so there is one implementation to
 * test and tune. This path stays so the prototype's imports keep their local
 * shape; see src/components/home/gaze-orb.tsx.
 */
export { GazeOrb, LOOK_DISTANCE } from "@/components/home/gaze-orb";
