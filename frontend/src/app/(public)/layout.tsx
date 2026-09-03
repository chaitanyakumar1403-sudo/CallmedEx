import SmartNavbar from "../components/SmartNavbar";
import { Phone, ShieldAlert, Droplet, ShieldCheck, MessageSquare } from "lucide-react";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* Top Utility Bar */}
      <div className="utility-bar">
        <div className="container">
          <div className="utility-bar__left">
            <a href="tel:108" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ShieldAlert size={14} style={{ color: "var(--cm-urgent)" }} /> Ambulance: 108
            </a>
            <a href="tel:104" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Phone size={14} style={{ color: "var(--cm-active)" }} /> Health Helpline: 104
            </a>
            <a href="tel:1910" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Droplet size={14} style={{ color: "var(--cm-urgent)" }} /> Blood Bank: 1910
            </a>
          </div>
          <div className="utility-bar__right">
            <span className="tagline-badge" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={14} style={{ color: "var(--cm-done)" }} /> Vizag&apos;s Verified Healthcare Platform
            </span>
          </div>
        </div>
      </div>

      {/* Smart Auth-Aware Navbar */}
      <SmartNavbar />

      {/* Page Content — landmark target for the skip link */}
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
        <button className="chat-widget__btn" aria-label="Chat with clinical coordinator" style={{ display: "grid", placeItems: "center" }}>
          <MessageSquare size={20} color="#ffffff" />
          <span className="chat-widget__pulse"></span>
        </button>
      </div>
    </>
  );
}
