/**
 * T14 comparison switch only: `?entrance=blur` picks the blur-reveal entrance
 * instead of the cascade (see `entrance.css`).
 *
 * It runs before paint, like the theme script, so the variant is on `<html>`
 * for the first frame of a direct load, and it also survives the soft
 * navigation into the drawer (the overlay's URL drops the query but the
 * document keeps the attribute). Temporary: remove with the variant once Dat
 * picks.
 */
export const ENTRANCE_INIT_SCRIPT = `(function(){var match=/(?:^|[?&])entrance=blur(?:&|$)/.exec(window.location.search);if(match){document.documentElement.setAttribute("data-entrance","blur");}})();`;
