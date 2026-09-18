import { describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";

import { resolveSnapshotBlockhash } from "../src/chain/blockhash.js";
import { syntheticBlockhash } from "../src/draw/select.js";

const WINDOW = "bell-close-2026-09-17";
const AT = new Date("2026-09-17T19:58:00.000Z");
const LIVE_HASH =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Hex;

describe("resolveSnapshotBlockhash", () => {
  it("uses synthetic hash in fixture mode and does not call RPC", async () => {
    const fetchLatest = vi.fn(async () => LIVE_HASH);
    const hash = await resolveSnapshotBlockhash({
      fixtureMode: true,
      rpcUrl: "https://rpc.example",
      windowId: WINDOW,
      at: AT,
      fetchLatest,
    });
    expect(hash).toBe(syntheticBlockhash(WINDOW, AT));
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it("uses the live RPC latest hash when FIXTURE_MODE=false", async () => {
    const fetchLatest = vi.fn(async () => LIVE_HASH);
    const hash = await resolveSnapshotBlockhash({
      fixtureMode: false,
      rpcUrl: "https://rpc.example",
      windowId: WINDOW,
      at: AT,
      fetchLatest,
    });
    expect(hash).toBe(LIVE_HASH);
    expect(fetchLatest).toHaveBeenCalledTimes(1);
    expect(fetchLatest).toHaveBeenCalledWith("https://rpc.example");
  });

  it("falls back to synthetic and logs when live RPC fails", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchLatest = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const hash = await resolveSnapshotBlockhash({
      fixtureMode: false,
      rpcUrl: "https://rpc.example",
      windowId: WINDOW,
      at: AT,
      fetchLatest,
    });
    expect(hash).toBe(syntheticBlockhash(WINDOW, AT));
    expect(err.mock.calls.some((call) => String(call[0]).includes("RPC failed"))).toBe(
      true,
    );
    err.mockRestore();
  });

  it("falls back when RPC_URL is empty in live mode", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchLatest = vi.fn(async () => LIVE_HASH);
    const hash = await resolveSnapshotBlockhash({
      fixtureMode: false,
      rpcUrl: "   ",
      windowId: WINDOW,
      at: AT,
      fetchLatest,
    });
    expect(hash).toBe(syntheticBlockhash(WINDOW, AT));
    expect(fetchLatest).not.toHaveBeenCalled();
    expect(
      err.mock.calls.some((call) => String(call[0]).includes("RPC_URL is empty")),
    ).toBe(true);
    err.mockRestore();
  });
});
