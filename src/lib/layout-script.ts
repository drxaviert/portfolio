/**
 * Runs in the document head before paint so a visitor who chose the list on
 * /work gets it from the first frame of a hard load, instead of the grid
 * flashing first. The attribute is only read by the index's stylesheet.
 *
 * It belongs in the root layout's head, beside the theme bootstrap: a script
 * rendered by a nested layout is inside a tree the client re-renders, and React
 * rejects that ("Encountered a script tag while rendering React component").
 */
export const LAYOUT_INIT_SCRIPT = `(function(){try{if(window.localStorage.getItem("wd-work-layout")==="list"){document.documentElement.setAttribute("data-work-layout","list");}}catch(error){}})();`;
