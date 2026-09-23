import { describe, expect, it } from "vitest";

import { sumPaidDraws } from "../src/pot/paid-out.js";

describe("sumPaidDraws", () => {
  it("sums settled paidAmountGme and skips dry-run, failed, and skipped", () => {
    const total = sumPaidDraws([
      { phase: "paid", dryRun: false, paidAmountGme: "8.8582515" },
      { phase: "paid", dryRun: false, paidAmountGme: 1.25 },
      { phase: "dry_run", dryRun: true, paidAmountGme: "99" },
      { phase: "paid", dryRun: true, paidAmountGme: "40" },
      { phase: "failed", dryRun: false, paidAmountGme: "7" },
      { phase: "skipped", dryRun: false, paidAmountGme: "3" },
      { phase: "paid", dryRun: false, paidAmountGme: null },
      { phase: "paid", dryRun: false, paidAmountGme: "12.5 GME" },
    ]);
    expect(total).toBeCloseTo(10.1082515, 8);
  });
});
