import type {
  YouTubeCallbacks,
  YouTubeHandle,
} from "@/components/home/now-playing-youtube";
import type { AudioBandsStore } from "./audio-bands";

/**
 * The self-hosted backend: a hidden HTMLAudioElement behind the same handle
 * and state codes the YouTube iframe uses (1 playing, 2 paused, 3 buffering,
 * 0 ended), so the player store's state machine does not know which one it is
 * driving.
 *
 * `crossOrigin="anonymous"` is required: the Web Audio analyser reads zeros
 * (and mutes the element) for a cross-origin file served without CORS
 * headers. The R2 bucket must allow GET from the site origins.
 */
export function createAudioPlayer(
  host: HTMLElement,
  url: string,
  callbacks: YouTubeCallbacks,
  bands?: AudioBandsStore,
): YouTubeHandle {
  const element = document.createElement("audio");

  element.crossOrigin = "anonymous";
  element.preload = "metadata";
  element.hidden = true;
  element.setAttribute("aria-hidden", "true");
  element.src = url;
  host.replaceChildren(element);

  let destroyed = false;
  let ready = false;

  const handle: YouTubeHandle = {
    play: () => {
      void element.play().catch(() => {
        // A blocked or interrupted play() surfaces as a pause event; a real
        // load failure arrives on the error event.
      });
    },
    pause: () => element.pause(),
    seek: (seconds) => {
      element.currentTime = seconds;
    },
    currentTime: () => element.currentTime,
    duration: () => (Number.isFinite(element.duration) ? element.duration : 0),
    state: () => {
      if (element.ended) return 0;
      if (!element.paused) return element.readyState < 3 ? 3 : 1;
      return element.readyState === 0 ? -1 : 2;
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;

      bands?.detach(element);
      element.pause();
      element.removeAttribute("src");
      element.load();
      element.remove();
    },
  };

  const emitReady = () => {
    if (ready || destroyed) return;
    ready = true;
    callbacks.onReady(handle, handle.duration());
  };

  element.addEventListener("loadedmetadata", emitReady);
  element.addEventListener("playing", () => {
    if (!destroyed) callbacks.onStateChange(1, handle);
  });
  element.addEventListener("waiting", () => {
    if (!destroyed && !element.paused) callbacks.onStateChange(3, handle);
  });
  element.addEventListener("pause", () => {
    if (!destroyed && !element.ended) callbacks.onStateChange(2, handle);
  });
  element.addEventListener("ended", () => {
    if (!destroyed) callbacks.onStateChange(0, handle);
  });
  element.addEventListener("error", () => {
    if (!destroyed) callbacks.onError(element.error?.code ?? 0, handle);
  });

  try {
    bands?.attach(element);
  } catch {
    // Without an analyser the element still plays; the bands stay at 0.
  }

  if (element.readyState >= 1) emitReady();

  return handle;
}
