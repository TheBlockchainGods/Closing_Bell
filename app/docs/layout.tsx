import type { Metadata } from "next";

import { DocsShell } from "@/components/docs/DocsShell";

export const metadata: Metadata = {
  title: {
    default: "Docs · Closing Bell ($BELL)",
    template: "%s · Closing Bell Docs",
  },
  description:
    "Closing Bell documentation: tickets, odds, fees, bag lock, draw fairness, verification, payouts, Bellwether bot, and system architecture.",
};

export default function DocsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DocsShell>{children}</DocsShell>;
}
