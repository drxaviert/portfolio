/**
 * Prototype type-scale switcher: ids, labels and the pre-paint initialiser.
 * Remove this module together with `src/app/proto-type-scale.css` and
 * `src/components/proto/type-scale-switcher.tsx` to drop the prototype.
 */

export const TYPE_SCALES = [
  { id: "current", label: "Current", key: "1" },
  { id: "m3", label: "M3", key: "2" },
  { id: "radix", label: "Radix", key: "3" },
  { id: "tailwind", label: "Tailwind", key: "4" },
  { id: "primer", label: "Primer", key: "5" },
  { id: "apple", label: "Apple", key: "6" },
] as const;

export type TypeScaleId = (typeof TYPE_SCALES)[number]["id"];

export const TYPE_SCALE_STORAGE_KEY = "portfolio:type-scale";

const TYPE_SCALE_IDS: readonly string[] = TYPE_SCALES.map((scale) => scale.id);

export function isTypeScaleId(value: string | null): value is TypeScaleId {
  return value !== null && TYPE_SCALE_IDS.includes(value);
}

/**
 * Reads `?type=` first, then localStorage, and writes the result to
 * `<html data-type-scale>` before paint. Any failure leaves "current".
 */
export const TYPE_SCALE_INIT_SCRIPT = `(function(){try{var ids=${JSON.stringify(
  TYPE_SCALE_IDS,
)};var v=new URLSearchParams(window.location.search).get("type");if(ids.indexOf(v)<0){v=null;}if(!v){v=localStorage.getItem(${JSON.stringify(
  TYPE_SCALE_STORAGE_KEY,
)});}if(ids.indexOf(v)<0){v="current";}document.documentElement.dataset.typeScale=v;}catch(e){document.documentElement.dataset.typeScale="current";}})();`;
