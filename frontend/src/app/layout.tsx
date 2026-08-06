import type { Metadata } from "next";
import { Inter, Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by next/font. The previous @import inside
// globals.css was render-blocking: the browser had to fetch and parse the CSS
// before it even discovered the font request. This also removes the flash of
// unstyled text and drops a third-party connection to fonts.googleapis.com.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
  keywords: "healthcare, diagnostics, telemedicine, pharmacy, ABHA, home collection, Vizag",
};

import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoTelugu.variable}`}>
      <body>
        <a className="cm-skip" href="#main">Skip to main content</a>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
