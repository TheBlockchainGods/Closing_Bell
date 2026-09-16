/** Same-origin prefix. The App Router proxies this to the public API origin. */
export const API_PROXY_PREFIX = "/cb-api";

/** Lightsail API. Used when NEXT_PUBLIC_API_BASE is unset so the UI never
 *  silently falls back to hardcoded pot/odds/winners. */
export const DEFAULT_API_ORIGIN =
  "https://closing-bell-api.qdwgj1kmyrm0a.us-west-2.cs.amazonlightsail.com";

/**
 * Absolute public API origin. Used only on the server proxy.
 * Browser code should call {@link publicApiBase} so requests stay
 * same-origin (the live API does not send CORS headers).
 */
export function configuredApiOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_BASE?.trim();
  const origin = (raw && !raw.startsWith("/") ? raw : DEFAULT_API_ORIGIN).replace(
    /\/$/,
    "",
  );
  return origin || null;
}

/** Client/server fetch base. Null only if no origin can be resolved. */
export function publicApiBase(): string | null {
  return configuredApiOrigin() ? API_PROXY_PREFIX : null;
}
