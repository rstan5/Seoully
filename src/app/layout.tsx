import type { Metadata, Viewport } from "next";
import { Baloo_2, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

/**
 * Baloo 2 is the product typeface — room, social, and onboarding.
 * Noto Sans KR covers Hangul glyphs Baloo 2 does not include (서울리).
 */

const baloo = Baloo_2({
  subsets: ["latin", "latin-ext"],
  variable: "--font-baloo",
  display: "swap",
});

const korean = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-korean",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Seoully 서울리",
  description: "The digital home of K-pop fandom.",
};

export const viewport: Viewport = {
  themeColor: "#08070b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${baloo.variable} ${korean.variable} ${baloo.className}`}>
      <body>{children}</body>
    </html>
  );
}
