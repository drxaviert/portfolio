/**
 * The day's hang angle: 1.05–1.85°, alternating direction by date.
 *
 * A painting that hangs a degree or two off square reads as physically hung
 * rather than placed. The value is seeded by the artwork's UTC date, so it is
 * stable through a reload and every visitor sees the same crooked frame; the
 * css settles it straight under a fine pointer.
 */
export function tiltForDate(dateKey: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < dateKey.length; index += 1) {
    hash ^= dateKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  const unsigned = hash >>> 0;
  const direction = unsigned % 2 === 0 ? -1 : 1;
  const step = (unsigned >>> 8) % 9;

  return Number((direction * (1.05 + step * 0.1)).toFixed(2));
}
