/**
 * How the three middle cards share the width the peek frees (`?peekFit=`). Dat
 * picks one and this module goes away.
 *
 * With the peek open the row reads [peek][gap][A][gap][B][gap][C][gap][peek],
 * so A + B + C is the column width minus both peeks and four gaps. That is a
 * little more than the cards have at rest; the difference is the "extra".
 *
 *   featured      the featured (first) card takes all of it; the others keep
 *                 their exact rest widths and move right
 *   proportional  the three share it in proportion to their rest widths
 */
export type PeekFit = "featured" | "proportional";

const FITS: readonly PeekFit[] = ["featured", "proportional"];

export function parsePeekFit(search: string): PeekFit {
  const value = new URLSearchParams(search).get("peekFit");
  return FITS.find((fit) => fit === value) ?? "featured";
}

/** The widths of the three middle cards with the peek open. */
export function fitWidths(
  fit: PeekFit,
  rest: number[],
  extra: number,
): number[] {
  if (fit === "featured") return rest.map((w, i) => (i === 0 ? w + extra : w));

  const total = rest.reduce((sum, w) => sum + w, 0);
  return rest.map((w) => w + (total > 0 ? (extra * w) / total : 0));
}
