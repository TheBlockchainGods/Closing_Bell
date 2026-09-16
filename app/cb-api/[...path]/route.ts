import { NextRequest, NextResponse } from "next/server";

import { configuredApiOrigin } from "@/lib/api-base";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function safePath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  for (const part of segments) {
    if (!part || part === "." || part === ".." || part.includes("\\")) {
      return null;
    }
  }
  return segments.map((part) => encodeURIComponent(part)).join("/");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const origin = configuredApiOrigin();
  if (!origin) {
    return NextResponse.json(
      { error: "API not configured", message: "Set NEXT_PUBLIC_API_BASE" },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const joined = safePath(path);
  if (!joined) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const upstream = new URL(`${origin}/${joined}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.append(key, value);
  });

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "Upstream unreachable" },
      { status: 502 },
    );
  }

  const headers = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("Cache-Control", "no-store");

  const body = await upstreamRes.arrayBuffer();
  return new NextResponse(body, {
    status: upstreamRes.status,
    headers,
  });
}
