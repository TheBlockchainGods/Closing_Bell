export function publicApiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}
