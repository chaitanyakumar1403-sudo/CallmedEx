import type { Metadata } from "next";
import { Inter, Manrope, Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by next/font — non-blocking, zero external layout shift.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

// The product promises Telugu to patients in Andhra Pradesh, but no Telugu face
// was ever loaded — Inter has no Telugu glyphs, so those users were seeing
// fallback boxes or whatever the OS happened to substitute.
const notoTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  weight: ["400", "600", "700"],
  variable: "--font-te",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CallMedex — India's AI-Native Healthcare Platform",
  description: "Book diagnostic tests, video consultations, pharmacy delivery, and home sample collection. ABHA-integrated, WhatsApp-native healthcare marketplace.",
  keywords: "healthcare, diagnostics, telemedicine, pharmacy, ABHA, home collection",
};

import { Toaster } from 'sonner';
import SessionKeeper from './components/SessionKeeper';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${notoTelugu.variable}`}>
      <body>
        <SessionKeeper />
        <a className="cm-skip" href="#main">Skip to main content</a>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
