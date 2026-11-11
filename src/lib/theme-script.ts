/**
 * Runs before paint so the document has the right phase tokens and `.dark`
 * class before React hydrates.
 *
 * This is a hand-inlined mirror of `parseStoredMode` + `phaseFor` in
 * `src/lib/theme.ts`: a valid stored choice wins, storage holds the legacy
 * "light"/"dark" pair during migration, and anything unavailable falls back to
 * Auto. Day mode mirrors 20–2 back to day and 2–5 back to dawn. Keep the two
 * in sync.
 */
export const THEME_INIT_SCRIPT = `(function(){var mode="auto";try{var stored=window.localStorage.getItem("theme");if(stored==="day"){mode="day";}else if(stored==="night"){mode="night";}else if(stored==="light"){mode="day";}else if(stored==="dark"){mode="night";}}catch(error){}var hour=new Date().getHours();var phase;if(mode==="night"){phase="night";}else if(hour>=5&&hour<8){phase="dawn";}else if(hour>=8&&hour<17){phase="day";}else if(hour>=17&&hour<20){phase="dusk";}else if(mode==="auto"){phase="night";}else{phase=hour>=2&&hour<5?"dawn":"day";}var root=document.documentElement;root.setAttribute("data-mode",mode);root.setAttribute("data-phase",phase);root.classList.toggle("dark",phase==="night");})();`;
