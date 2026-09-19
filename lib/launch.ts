/**
 * Launch-surface env. Empty means "not live yet" — never claim a chart or CA.
 *
 * NEXT_PUBLIC_TOKEN_ADDRESS  0x… contract
 * NEXT_PUBLIC_CHART_URL      DexScreener (or other) chart link
 * NEXT_PUBLIC_API_BASE       Public API origin (Lightsail). Browser uses /cb-api.
 */

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export const TOKEN_ADDRESS = read("NEXT_PUBLIC_TOKEN_ADDRESS");
export const CHART_URL = read("NEXT_PUBLIC_CHART_URL");

export const CA_PLACEHOLDER = "CA at launch";

export function truncateAddress(address: string, left = 6, right = 4): string {
  if (address.length <= left + right + 1) return address;
  return `${address.slice(0, left)}\u2026${address.slice(-right)}`;
}
