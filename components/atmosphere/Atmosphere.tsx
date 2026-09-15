const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E\")";

/**
 * Fixed atmosphere layers: green/gold bloom, floor vignette, grain.
 * Hero video is scoped to the hero section; this is the rest of the page.
 */
export function Atmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <div
        className="absolute inset-x-0 top-0 h-[80vh]"
        style={{
          background:
            "radial-gradient(110% 64% at 72% 0%, rgba(0,200,5,0.12) 0%, rgba(212,160,23,0.08) 36%, rgba(11,11,11,0) 68%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(85% 60% at 50% 42%, rgba(11,11,11,0) 0%, rgba(5,5,5,0.55) 78%, rgba(5,5,5,0.92) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-soft-light"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px" }}
      />
    </div>
  );
}
