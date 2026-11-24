/**
 * The focus viewer is the only owner of its video.
 *
 * It starts the piece once and retries only until the first presented frame;
 * after that the native controls (and the user) own play/pause. It never seeks
 * and never pauses until it is torn down, so a `canplay` during buffering
 * cannot start a seek/play loop or override a pause the user asked for.
 */
export function ownViewerVideo(video: HTMLVideoElement): () => void {
  video.controls = true;
  video.muted = true;

  let started = false;
  let cancelled = false;

  const start = () => {
    if (started || cancelled) return;

    if (!video.paused) {
      started = true;
      return;
    }

    void video.play().then(
      () => {
        started = true;
      },
      () => {
        // The source may not be ready yet; a later canplay retries.
      },
    );
  };
  const onPlaying = () => {
    started = true;
  };
  const onCanPlay = () => {
    if (!started) start();
  };

  video.addEventListener("playing", onPlaying);
  video.addEventListener("canplay", onCanPlay);
  video.addEventListener("loadeddata", onCanPlay);
  start();

  return () => {
    cancelled = true;
    video.removeEventListener("playing", onPlaying);
    video.removeEventListener("canplay", onCanPlay);
    video.removeEventListener("loadeddata", onCanPlay);
    video.pause();
  };
}
