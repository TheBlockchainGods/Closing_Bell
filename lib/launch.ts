/**
 * Launch-surface env. Empty means "not live yet" — never claim a chart or CA.
 *
 * NEXT_PUBLIC_TOKEN_ADDRESS  0x… contract
 * NEXT_PUBLIC_CHART_URL      DexScreener (or other) chart link
 * NEXT_PUBLIC_API_BASE       Public API for /verify fetch
 * NEXT_PUBLIC_DRY_RUN_PAYOUTS  When true (default), show one sitewide payouts banner
 */

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

export const TOKEN_ADDRESS = read("NEXT_PUBLIC_TOKEN_ADDRESS");
export const CHART_URL = read("NEXT_PUBLIC_CHART_URL");

/** Default true until go-live: flip to false to hide the sitewide payouts banner. */
export const DRY_RUN_PAYOUTS = readBool("NEXT_PUBLIC_DRY_RUN_PAYOUTS", true);

export const CA_PLACEHOLDER = "CA at launch";

export function truncateAddress(address: string, left = 6, right = 4): string {
  if (address.length <= left + right + 1) return address;
  return `${address.slice(0, left)}\u2026${address.slice(-right)}`;
}
