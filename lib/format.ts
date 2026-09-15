const gmeFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const gmeWholeFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdPreciseFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const etStamp = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const etTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const etWeekday = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
});

export function formatGme(value: number): string {
  return gmeFormatter.format(value);
}

export function formatGmeWhole(value: number): string {
  return gmeWholeFormatter.format(value);
}

export function formatUsd(value: number): string {
  return usdFormatter.format(value);
}

export function formatUsdPrecise(value: number): string {
  return usdPreciseFormatter.format(value);
}

export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

export function formatBell(value: number): string {
  return gmeWholeFormatter.format(Math.round(value));
}

/** Percentage with a fixed number of decimals. Input is a fraction (0.0412). */
export function formatPct(fraction: number, digits = 2): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** 0x1234…9abc */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

/** "Sep 12, 16:00 ET" (deterministic across server and client). */
export function formatEtStamp(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return `${etStamp.format(date).replace(" at ", ", ")} ET`;
}

/** "16:00 ET" */
export function formatEtTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return `${etTime.format(date)} ET`;
}

/** "Fri" in ET. */
export function formatEtWeekday(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return etWeekday.format(date);
}

export function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}
