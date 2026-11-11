/**
 * Prototype-only "horizon glow" page background.
 *
 * Mirrors the bg / stripe gradient in the Figma 1440 frames (Day 121:2004,
 * Night 121:3244, Dawn 121:4483, Dusk 121:5722): a flat surface that holds to
 * 70%, then lifts into a phase tint at the bottom edge, with two blurred
 * ellipses tucked below the fold. Stops, blob hues, sizes and alphas are the
 * per-phase horizon tokens, so data-phase alone recolours every layer.
 */
export function HorizonBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, var(--horizon-base) 0%, var(--horizon-base) 70%, var(--horizon-mid) var(--horizon-mid-at), var(--horizon-end) 100%)",
        }}
      />

      {/* 900x420 at -200/860 and 1000x460 at 700/820 in the 1440 frame. */}
      <div className="absolute top-[84%] -left-[14%] h-[41%] w-[63%] rounded-full bg-horizon-blob-left blur-[81px] md:blur-[96px] lg:blur-[128px] xl:blur-[180px]" />
      <div className="absolute top-[80%] left-[49%] h-[45%] w-[69%] rounded-full bg-horizon-blob-right blur-[81px] md:blur-[96px] lg:blur-[128px] xl:blur-[180px]" />
    </div>
  );
}
