import { describe, expect, it } from "vitest";

import {
  SHARE_CAPTION_MAX,
  formatJackpotShareCaption,
} from "./share-caption.js";

const CA = "0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7";

describe("formatJackpotShareCaption", () => {
  it("keeps Jackpot, then Paid out, ritual, site, and CA", () => {
    const text = formatJackpotShareCaption({
      jackpotGme: 4.0456,
      jackpotUsd: 94.2,
      paidOutGme: 12.5,
      paidOutUsd: 290.4,
      tokenAddress: CA,
    });
    expect(text).toBe(
      [
        "$BELL buy-to-win on @RobinhoodApp Chain \u{1F514}",
        "Jackpot: 4.0456 GME (~$94)",
        "Paid out: 12.5 GME (~$290)",
        "3 jackpots/day \u00B7 24/7 \u00B7 7 days a week",
        "https://closingbellonrh.com",
        CA,
      ].join("\n"),
    );
    expect(text.length).toBeLessThanOrEqual(SHARE_CAPTION_MAX);
    expect(text).not.toContain("\u2014");
  });

  it("drops Paid out USD before dropping the CA", () => {
    const fitted = formatJackpotShareCaption({
      jackpotGme: 4.0456,
      jackpotUsd: 94,
      paidOutGme: 12.5,
      paidOutUsd: 290,
      tokenAddress: CA,
    });
    const overflow = "x".repeat(SHARE_CAPTION_MAX - fitted.length + 4);
    const text = formatJackpotShareCaption({
      jackpotGme: 4.0456,
      jackpotUsd: 94,
      paidOutGme: 12.5,
      paidOutUsd: 290,
      siteUrl: `https://closingbellonrh.com/${overflow}`,
      tokenAddress: CA,
    });
    expect(text).toContain("Paid out: 12.5 GME");
    expect(text).not.toContain("Paid out: 12.5 GME (~$");
    expect(text.endsWith(CA)).toBe(true);
    expect(text.length).toBeLessThanOrEqual(SHARE_CAPTION_MAX);
  });
});
