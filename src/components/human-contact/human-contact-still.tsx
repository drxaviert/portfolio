/**
 * The pre-rendered grid, used underneath the live canvas.
 *
 * It is the first paint and the permanent floor: Safari never mounts the
 * WebGL scene, and a missing or lost context leaves this frame in place. The
 * file is captured from the real render, so the fallback is the same artwork
 * the live scene shows.
 */
export const HUMAN_CONTACT_STILL_SRC =
  "/human-contact/human-contact-still.webp";

export function HumanContactStill() {
  return (
    // A fixed local asset, already encoded at its display size; next/image
    // would add a resizer hop for one still.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="hc-still"
      src={HUMAN_CONTACT_STILL_SRC}
      alt=""
      width={1920}
      height={1080}
      draggable={false}
      decoding="async"
    />
  );
}
