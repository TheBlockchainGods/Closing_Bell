export type DocsNavItem = {
  href: string;
  label: string;
  external?: boolean;
};

export const DOCS_NAV: DocsNavItem[] = [
  { href: "/docs", label: "Introduction" },
  { href: "/docs/tickets", label: "How tickets work" },
  { href: "/docs/odds", label: "Odds and the 10% cap" },
  { href: "/docs/fees", label: "Fees and the Bell Pot (v1)" },
  { href: "/docs/draw", label: "Bag lock and the draw" },
  { href: "/docs/verify", label: "Verify a ring" },
  { href: "/docs/payouts", label: "Payouts" },
  { href: "/docs/architecture", label: "System architecture and tech" },
  { href: "/docs/operations", label: "Automated vs operator-run" },
  { href: "/docs/faq", label: "FAQ" },
];

export const DOCS_TITLE = "Closing Bell Docs";
