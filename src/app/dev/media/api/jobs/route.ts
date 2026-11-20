import { connection } from "next/server";
import { notFound } from "next/navigation";
import { dismissJob, listJobs } from "../jobs";

/**
 * Polled by the upload cards. `connection()` keeps this a request-time handler:
 * an in-memory queue has nothing static to prerender, and a prerendered answer
 * would freeze the list at build time.
 */
export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === "production") notFound();
  await connection();

  return Response.json(
    { jobs: listJobs() },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Dismiss a finished card; a queued or running job keeps its place. */
export async function DELETE(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") notFound();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "No job id." }, { status: 400 });

  if (!dismissJob(id)) {
    return Response.json(
      { error: "That job is still running, or it is already gone." },
      { status: 409 },
    );
  }

  return new Response(null, { status: 204 });
}
