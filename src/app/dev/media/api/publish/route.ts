import { notFound } from "next/navigation";
import { publishMedia } from "../../publish";

/**
 * Commits and pushes the pending manifests to main. Dev only: production
 * answers 404, and the page itself disables the button with the reason.
 */
export async function POST(): Promise<Response> {
  if (process.env.NODE_ENV === "production") notFound();

  const result = await publishMedia();

  return result.ok
    ? Response.json(result)
    : Response.json({ error: result.error }, { status: 409 });
}
