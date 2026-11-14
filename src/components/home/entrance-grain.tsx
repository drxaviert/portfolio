/**
 * Throwaway prototype (dev route only): the tiled grain the "grain sky"
 * entrance resolves the glow out of.
 *
 * It sits between the horizon layers and the content column in HomeLayout and
 * only exists when the prototype asks for that variant, so `/` renders exactly
 * the tree it shipped with. Everything is CSS (home-entrance.css): the tile
 * jitters its background-position on a stepped loop while a single one-shot
 * animation decays the opacity and ends on `visibility: hidden`, so the layer
 * stops painting at animationend without needing JS.
 */
export function EntranceGrain() {
  return <div aria-hidden="true" className="entrance-grain" />;
}
