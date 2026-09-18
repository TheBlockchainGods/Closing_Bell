import { config } from "../config.js";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function joinUrl(base: string, path: string): string {
  return `${trimSlash(base)}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface PublicLinkSet {
  siteUrl?: string;
  potUrl?: string;
  oddsUrl?: string;
  countdownUrl?: string;
  verifyUrl?: string;
  docsUrl?: string;
  xUrl?: string;
  winnersUrl?: string;
}

export function publicSiteOrigin(): string {
  const site = config.publicSiteUrl.trim();
  return trimSlash(site || "https://closingbellonrh.com");
}

export function publicLinks(windowId?: string): PublicLinkSet {
  const site = publicSiteOrigin();
  const api = config.publicApiUrl.trim();
  const x = config.xUrl.trim() || "https://x.com/ClosingBellOnRH";
  const links: PublicLinkSet = {
    siteUrl: site,
    potUrl: `${site}/#bell-pot`,
    oddsUrl: `${site}/#odds`,
    countdownUrl: `${site}/#countdown`,
    verifyUrl: joinUrl(site, "/verify"),
    docsUrl: joinUrl(site, "/docs"),
    xUrl: x,
  };
  if (windowId && api) {
    links.winnersUrl = joinUrl(api, `/winners/${encodeURIComponent(windowId)}`);
  }
  return links;
}

export function appendPublicLinks(
  lines: string[],
  links: PublicLinkSet,
): void {
  if (links.siteUrl) lines.push(`Site: ${links.siteUrl}`);
  if (links.verifyUrl) lines.push(`Verify: ${links.verifyUrl}`);
  if (links.winnersUrl) lines.push(`Receipt: ${links.winnersUrl}`);
  if (links.docsUrl) lines.push(`Docs: ${links.docsUrl}`);
  if (links.xUrl) lines.push(`X: ${links.xUrl}`);
}

export function jackpotShareUrl(pageUrl: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`;
}

/** Robinhood Chain explorer (Blockscout). No repo PONS tx URL existed. */
export function explorerTxUrl(txHash: string): string | null {
  const hash = txHash.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
  const prefix = config.explorerTxUrlPrefix.trim();
  if (prefix) {
    return `${trimSlash(prefix)}/${hash}`;
  }
  if (config.chainId === 46630) {
    return `https://explorer.testnet.chain.robinhood.com/tx/${hash}`;
  }
  return `https://robinhoodchain.blockscout.com/tx/${hash}`;
}
