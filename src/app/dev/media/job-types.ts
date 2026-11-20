/** Shapes shared by the upload route, the jobs route and the client cards. */

export type JobStage = "queued" | "encoding" | "uploading" | "done" | "failed";

/** `auto` follows post.ts's 20 s rule; the other two pass --hls / --no-hls. */
export type HlsChoice = "auto" | "force" | "off";

export interface UploadOptions {
  caption: string;
  audio: boolean;
  hls: HlsChoice;
}

export interface JobView {
  id: string;
  /** The sanitised inbox filename, which is also what the card shows. */
  name: string;
  stage: JobStage;
  /** A plain-word failure line, with the encoder's own tail underneath. */
  error?: string;
}
