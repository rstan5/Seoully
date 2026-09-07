import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Type is doing a lot of work in this product. The pairing is deliberate:
 *
 *   Instrument Serif — editorial display. High contrast, slightly literary.
 *     Used for collector names and room titles so identity reads as a magazine
 *     masthead rather than a dashboard header.
 *
 *   Archivo — a grotesque that holds up at tiny sizes with wide tracking,
 *     which is what all the uppercase object labels need.
 *
 *   JetBrains Mono — every number. Collection counts, completion ratios, and
 *     compatibility scores are the product's vital signs, and tabular figures
 *     make them feel measured rather than decorative.
 */

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-stack",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Seoully",
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
    <html
      lang="en"
      className={`${instrument.variable} ${archivo.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
