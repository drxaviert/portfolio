/**
 * Safari detection for the live scene fallback.
 *
 * Safari gets the static still rather than a WebGL loop, matching the site's
 * Horizon rule. `navigator.vendor` is the reliable part: Safari (and the other
 * WebKit browsers on iOS) report Apple, while Chrome, Edge and Firefox do not.
 * The UA tokens then weed out the WebKit siblings that are not Safari.
 */
export function isSafariUserAgent(userAgent: string, vendor: string): boolean {
  if (!/Apple/.test(vendor)) return false;
  if (!/Safari/.test(userAgent)) return false;

  return !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|OPiOS|OPR\/)/.test(
    userAgent,
  );
}

export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;

  return isSafariUserAgent(navigator.userAgent, navigator.vendor ?? "");
}

/**
 * One 1x1 probe before three.js is asked for a renderer. Without it, a browser
 * with WebGL disabled still logs three's context-creation error before the
 * caught exception, which would leave a handled fallback sounding broken.
 */
export function hasWebGLSupport(): boolean {
  if (typeof document === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");

    if (!gl) return false;

    gl.getExtension("WEBGL_lose_context")?.loseContext();

    return true;
  } catch {
    return false;
  }
}
