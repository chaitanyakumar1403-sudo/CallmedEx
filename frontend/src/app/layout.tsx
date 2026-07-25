import type { Metadata } from "next";
import { Inter, Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";
import SmartNavbar from "./components/SmartNavbar";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoTelugu.variable}`}>
      <body>
        <a className="cm-skip" href="#main">Skip to main content</a>
        {/* Top Utility Bar */}
        <div className="utility-bar">
          <div className="container">
            <div className="utility-bar__left">
              <a href="tel:108">🚑 Ambulance: 108</a>
              <a href="tel:104">📞 Health Helpline: 104</a>
              <a href="tel:1910">🩸 Blood Bank: 1910</a>
            </div>
            <div className="utility-bar__right">
              <span className="tagline-badge">✨ Vizag&apos;s #1 Healthcare Platform</span>
            </div>
          </div>
        </div>

        {/* Smart Auth-Aware Navbar */}
        <SmartNavbar />

        {/* Page Content — landmark target for the skip link, and the region a
            screen reader jumps to past ~14 tab stops of nav and utility bar. */}
        <main id="main">{children}</main>

        {/* Footer */}
        <footer className="footer">
          <div className="container">
            <div className="footer__grid">
              <div className="footer__brand">
                <h3><img src="/logo.png" alt="CallMedex Logo" style={{ height: '48px', width: 'auto', verticalAlign: 'middle', marginRight: '10px' }} /></h3>
                <p>India&apos;s most advanced AI-native healthcare orchestration platform. ABHA-first, WhatsApp-native, real-time dispatch for home healthcare services.</p>
              </div>
              <div className="footer__column">
                <h4>Services</h4>
                <ul>
                  <li><a href="/diagnostics">Diagnostics</a></li>
                  <li><a href="/consultation">Video Consultation</a></li>
                  <li><a href="/pharmacy">Pharmacy</a></li>
                </ul>
              </div>
              <div className="footer__column">
                <h4>Company</h4>
                <ul>
                  <li><a href="/about">About Us</a></li>
                  <li><a href="#">Careers</a></li>
                  <li><a href="#">Partner With Us</a></li>
                  <li><a href="#">Blog</a></li>
                </ul>
              </div>
              <div className="footer__column">
                <h4>Support</h4>
                <ul>
                  <li><a href="#">Help Center</a></li>
                  <li><a href="#">Privacy Policy</a></li>
                  <li><a href="#">Terms of Service</a></li>
                  <li><a href="#">DPDP Compliance</a></li>
                </ul>
              </div>
            </div>
            <div className="footer__bottom">
              <span>© 2026 CallMedex by ZukoLabs. All rights reserved.</span>
              <span>ABDM Compliant · DPDP Act 2023 · FHIR R4</span>
            </div>
          </div>
        </footer>

        {/* Chat Widget */}
        <div className="chat-widget">
          <button className="chat-widget__btn" aria-label="Chat with us">
            💬
            <span className="chat-widget__pulse"></span>
          </button>
        </div>
      </body>
    </html>
  );
}
