/**
 * Ring skip is not winner math. Empty bag or pot below MIN_POT_GME
 * skips the payout and must not pin a fake win.
 */
export function skipRingReason(input: {
  potGme: number;
  minPotGme: number;
  totalWeight: number;
}): string | null {
  if (input.totalWeight === 0) return "empty bag";
  if (input.potGme < input.minPotGme) {
    return `pot below MIN_POT_GME (${input.minPotGme})`;
  }
  return null;
}
