import { LaunchChrome } from "@/components/LaunchChrome";

/** Thin action row under the trust tape: CA, Chart, Docs. */
export function LaunchBar() {
  return (
    <div className="relative z-20 border-t border-line/70">
      <div className="mx-auto w-full max-w-[1200px] px-3 py-1.5 sm:px-8 sm:py-2">
        <LaunchChrome />
      </div>
    </div>
  );
}
