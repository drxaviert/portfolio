import { HumanContactExperience } from "./human-contact-experience";
import { HumanContactStill } from "./human-contact-still";

/**
 * The full-screen composition, shared by `/live/human-contact` and the dev
 * route. The still is the fallback and the first paint; the live experience
 * layers over it and is never the only way to see the artwork.
 */
export function HumanContactFull() {
  return (
    <main className="hc-live">
      <HumanContactStill />
      <HumanContactExperience mode="full" />
    </main>
  );
}
