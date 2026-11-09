/**
 * Runs before paint so the document has the right theme class before React
 * hydrates. It must mirror `resolveTheme` + `readStoredTheme`:
 * a valid stored choice wins, anything else follows the system preference,
 * and unavailable storage must not stop the theme from applying.
 */
export const THEME_INIT_SCRIPT = `(function(){var stored=null;try{stored=window.localStorage.getItem("theme");}catch(error){}var prefersDark=false;try{prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;}catch(error){}var theme=stored==="light"||stored==="dark"?stored:(prefersDark?"dark":"light");document.documentElement.classList.toggle("dark",theme==="dark");})();`;
