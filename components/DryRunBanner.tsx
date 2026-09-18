import { DRY_RUN_PAYOUTS } from "@/lib/launch";

/**
 * Single sitewide note while payouts are still dry-run.
 * Disable at go-live with NEXT_PUBLIC_DRY_RUN_PAYOUTS=false.
 */
export function DryRunBanner() {
  if (!DRY_RUN_PAYOUTS) return null;

  return (
    <div
      role="status"
      className="border-b border-brass-700/40 bg-brass-500/10"
    >
      <p className="mx-auto max-w-[1200px] px-5 py-2.5 text-center text-[0.8rem] leading-snug text-brass-100 sm:px-8 sm:text-[0.84rem]">
        Payouts are in dry-run until go-live. Draws and verify still use public
        formula closing-bell-draw-v1.
      </p>
    </div>
  );
}
