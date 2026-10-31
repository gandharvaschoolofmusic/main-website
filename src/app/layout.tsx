import type { Metadata } from "next";
import { DM_Sans, Vidaloka } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const vidaloka = Vidaloka({
  subsets: ["latin"],
  variable: "--font-vidaloka",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Gandharva School of Music: Live 1:1 Online Music & Dance Classes",
    template: "%s | Gandharva School of Music",
  },
  description:
    "Learn music and dance online with Gandharva School of Music's personalized 1:1 classes. Explore instruments, classical & western vocals, and dance with accredited maestros.",
  keywords: [
    "Gandharva School of Music",
    "online music classes",
    "1:1 music lessons",
    "piano lessons online",
    "guitar lessons",
    "classical music lessons",
    "tabla classes online",
    "carnatic vocals",
    "hindustani music",
    "bharatanatyam classes",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  other: {
    "darkreader-lock": "",
  },
};

import { Navbar } from "@/components/layout/Navbar";
import SiteChrome from "@/components/SiteChrome";
import { getServerCurrency } from "@/lib/currency-server";
import { CurrencyProvider } from "@/context/CurrencyContext";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialCurrency = await getServerCurrency();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${dmSans.variable} ${vidaloka.variable}`}
    >
      <head>
        <meta name="darkreader-lock" />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-bg text-body font-sans antialiased"
      >
        <CurrencyProvider initialCurrency={initialCurrency}>
          <Navbar />
          <SiteChrome>
            <main>{children}</main>
          </SiteChrome>
        </CurrencyProvider>
      </body>
    </html>
  );
}
