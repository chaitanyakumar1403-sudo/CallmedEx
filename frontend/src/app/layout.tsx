import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'sonner';
import SessionKeeper from './components/SessionKeeper';

export const metadata: Metadata = {
  title: "CallMedex — India's AI-Native Healthcare Platform",
  description: "Book diagnostic tests, video consultations, pharmacy delivery, and home sample collection. ABHA-integrated, WhatsApp-native healthcare marketplace.",
  keywords: "healthcare, diagnostics, telemedicine, pharmacy, ABHA, home collection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+Telugu:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SessionKeeper />
        <a className="cm-skip" href="#main">Skip to main content</a>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
