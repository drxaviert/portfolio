import { notFound } from "next/navigation";

/**
 * Dev-only viewport bench for the home frame's scale-to-fit work.
 *
 * Each iframe is a real document at the target desktop size, so `100dvh`,
 * `--fit` and every media query inside it resolve exactly as they do on that
 * screen. The iframe is then transform-scaled down for the page, with the
 * wrapper reserving only the scaled box. `/dev` routes are excluded from the
 * site nav (nav-dock.tsx) and 404 in a production build.
 */
export const metadata = {
  title: "Viewports · home fit",
  robots: { index: false, follow: false },
};

const VIEWPORTS = [
  { width: 1920, height: 1080, scale: 0.36 },
  { width: 1536, height: 864, scale: 0.44 },
  { width: 2560, height: 1440, scale: 0.27 },
  { width: 1440, height: 900, scale: 0.47 },
  { width: 3440, height: 1440, scale: 0.2 },
] as const;

export default function ViewportsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface p-6 text-on-surface">
      <header className="mb-6 max-w-3xl">
        <h1 className="text-2xl font-medium">Home · viewport fit</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Live iframes of <code>/</code> at the target desktop sizes, each
          scaled down to fit this page. The iframe itself is the full
          width/height, so the home frame&rsquo;s <code>--fit</code>,{" "}
          <code>100dvh</code> and the edge blur bands resolve as they do on that
          screen. 3440 × 1440 is the reference: it must stay at 1×.
        </p>
      </header>

      <div className="flex flex-wrap items-start gap-8">
        {VIEWPORTS.map((viewport) => {
          const label = `${viewport.width} × ${viewport.height}`;
          const scaledWidth = viewport.width * viewport.scale;
          const scaledHeight = viewport.height * viewport.scale;

          return (
            <figure key={label} className="m-0">
              <figcaption className="mb-2 flex items-baseline gap-2">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-on-surface-variant">
                  {Math.round(viewport.scale * 100)}%
                </span>
              </figcaption>
              <div
                className="relative overflow-hidden rounded-lg bg-surface-container-low shadow-card"
                style={{ width: scaledWidth, height: scaledHeight }}
              >
                <iframe
                  src="/"
                  title={`Home at ${label}`}
                  className="absolute top-0 left-0 border-0"
                  style={{
                    width: viewport.width,
                    height: viewport.height,
                    transform: `scale(${viewport.scale})`,
                    transformOrigin: "0 0",
                  }}
                />
              </div>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
