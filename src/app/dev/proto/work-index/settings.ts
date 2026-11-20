export const VARIANT_IDS = ["current", "a", "b", "c"] as const;

export type VariantId = (typeof VARIANT_IDS)[number];

export const VARIANTS: { id: VariantId; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "a", label: "A · Refined" },
  { id: "b", label: "B · Restructured" },
  { id: "c", label: "C · Expressive" },
];

/** The URL query for a selection, keeping any other params as they are. */
export function protoQuery(search: string, v: VariantId, doubled: boolean) {
  const params = new URLSearchParams(search);

  params.set("v", v);
  if (doubled) params.set("x2", "1");
  else params.delete("x2");

  return `?${params.toString()}`;
}
