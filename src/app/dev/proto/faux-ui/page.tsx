import { notFound } from "next/navigation";
import "@/components/home/ring-hover.css";
import { FauxUiProto } from "./faux-ui";
import type { Mode, Scene, Phase } from "./faux-ui";

/**
 * Throwaway prototype: the featured work ProjectCard's product visual.
 *
 * Three generic faux scenes — desktop window, phone, bento tiles — each drawn
 * on the card's Figma canvas (753 × 416) and scaled to fit, with an 8s CSS
 * loop by default (Dat's pick for the featured card) or a still for
 * reduced-motion review, plus a Day/Night switch.
 *
 * Dev-only; deep links 404 in a production build. The card frame reuses the
 * ring-hover surface from src/components/home, so its size, radius and shadow
 * are the shipped card's.
 *
 * `?scene=phone&mode=still&theme=night` opens a single frame, so a review can
 * link to it. The panel keeps the URL in step from there.
 */
export const metadata = {
  title: "Prototype · faux UI",
  robots: { index: false, follow: false },
};

/** The deep link is read on the server, so this dev route may block. */
export const instant = false;

function pick<T extends string>(
  value: string | string[] | undefined,
  options: readonly T[],
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

export default async function FauxUiPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const query = await searchParams;

  return (
    <FauxUiProto
      initialScene={pick<Scene>(
        query.scene,
        ["window", "phone", "tiles"],
        "window",
      )}
      // Dat picked Loop for all three scenes, so an absent ?mode= opens the
      // loop; Still stays available as the reduced-motion fallback to check.
      initialMode={pick<Mode>(query.mode, ["still", "loop"], "loop")}
      initialPhase={pick<Phase>(query.theme, ["day", "night"], "day")}
    />
  );
}
