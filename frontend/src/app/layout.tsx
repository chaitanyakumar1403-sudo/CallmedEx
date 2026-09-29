import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/mobile-shell.css";
import "./styles/mobile-field.css";
import "./styles/mobile-clinical.css";
import "./styles/mobile-console.css";
import { Toaster } from 'sonner';
import SessionKeeper from './components/SessionKeeper';

export const metadata: Metadata = {
  title: "CallMedex — India's AI-Native Healthcare Platform",
  description: "Book diagnostic tests, video consultations, pharmacy delivery, and home sample collection. ABHA-integrated, WhatsApp-native healthcare marketplace.",
  keywords: "healthcare, diagnostics, telemedicine, pharmacy, ABHA, home collection",
  appleWebApp: { capable: true, title: "CallMedex", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a2b4a",
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
