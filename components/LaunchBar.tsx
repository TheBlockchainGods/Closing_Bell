import { LaunchChrome } from "@/components/LaunchChrome";

/** Thin action row under the trust tape: CA, Chart, Docs. */
export function LaunchBar() {
  return (
    <div className="relative z-20 border-b border-line bg-floor-950/90">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-2.5 sm:px-8 sm:py-3">
        <LaunchChrome />
      </div>
    </div>
  );
}
