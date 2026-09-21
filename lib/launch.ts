/**
 * Live $BELL launch surface. Exact CA from PONS create. Do not invent another.
 *
 * NEXT_PUBLIC_CHART_URL may override the default Defined chart.
 * TOKEN_ADDRESS is always this checksummed live CA.
 */

export const LIVE_TOKEN_ADDRESS =
  "0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7";

export const PONS_LAUNCH_URL =
  "https://www.ponsfamily.com/launchpad/0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7";

export const DEFINED_URL =
  "https://www.defined.fi/token/robinhood/0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7";

export const DEXSCREENER_URL =
  "https://dexscreener.com/robinhood/0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7";

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export const TOKEN_ADDRESS = LIVE_TOKEN_ADDRESS;

export const CHART_URL = read("NEXT_PUBLIC_CHART_URL") ?? DEFINED_URL;

export function truncateAddress(address: string, left = 6, right = 4): string {
  if (address.length <= left + right + 1) return address;
  return `${address.slice(0, left)}\u2026${address.slice(-right)}`;
}
