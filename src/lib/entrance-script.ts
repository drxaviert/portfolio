/**
 * T9 comparison switch only: `?entrance=a|b|c` picks one of the three content
 * entrances Dat is choosing between (see `entrance.css`).
 *
 * It runs before paint, like the theme script, so the variant is on `<html>`
 * for the first frame: a direct load of `/work/[slug]` plays the chosen
 * entrance instead of flashing the default one, and the value also survives
 * the soft navigation into the drawer (the overlay's URL drops the query but
 * the document keeps the attribute). Remove this script with `entrance.css`
 * once Dat picks.
 */
export const ENTRANCE_INIT_SCRIPT = `(function(){var match=/(?:^|[?&])entrance=(a|b|c)(?:&|$)/.exec(window.location.search);if(match){document.documentElement.setAttribute("data-entrance",match[1]);}})();`;
