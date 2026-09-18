import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { WHO_PICKS_ONE_LINER } from "@/lib/fairness-copy";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://closingbellonrh.com"),
  title: "Closing Bell ($BELL) · Ring the bell, take the pot",
  description: WHO_PICKS_ONE_LINER,
  keywords: [
    "Closing Bell",
    "BELL token",
    "GME pair",
    "Bell Pot",
    "After Hours staking",
  ],
  openGraph: {
    title: "Closing Bell ($BELL)",
    description: WHO_PICKS_ONE_LINER,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0806",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
