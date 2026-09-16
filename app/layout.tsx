import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
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
  description:
    "Closing Bell is a market-ritual token on the GME pair. Buy in the window to earn Bell tickets, watch the Bell Pot build, and see it paid out in GME when the bell rings at 9:30 and 16:00 ET.",
  keywords: [
    "Closing Bell",
    "BELL token",
    "GME pair",
    "Bell Pot",
    "After Hours staking",
  ],
  openGraph: {
    title: "Closing Bell ($BELL)",
    description:
      "The Bell Pot builds all session. When the bell rings, one holder is paid in GME and every Bell ticket wipes.",
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
