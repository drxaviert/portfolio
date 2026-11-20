import { notFound } from "next/navigation";
import { listWork } from "@/lib/work";
import { WorkIndexProto } from "./work-index-proto";
import { VARIANT_IDS } from "./settings";
import type { VariantId } from "./settings";

/**
 * Throwaway prototype: three directions for the work index, from the Mobbin
 * research brief in docs/research/2026-11-20-work-index-mobbin.md.
 *
 * `?v=current|a|b|c` picks the variant (default `a`), `?x2=1` doubles the list
 * so layouts can be judged with six studies. The floating panel keeps both in
 * the URL, and keys 1-4 switch variants.
 *
 * Dev-only; deep links 404 in a production build.
 */
export const metadata = {
  title: "Prototype · work index",
  robots: { index: false, follow: false },
};

/** The deep link is read on the server, so this dev route may block. */
export const instant = false;

export default async function WorkIndexProtoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const query = await searchParams;
  const v = VARIANT_IDS.includes(query.v as VariantId)
    ? (query.v as VariantId)
    : "a";

  return (
    <WorkIndexProto
      works={listWork()}
      initialVariant={v}
      initialDoubled={query.x2 === "1"}
    />
  );
}
