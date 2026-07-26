import { AppBar } from "@/components/ui";

/**
 * App routes get one bar. The marketing utility bar, public navbar, footer and
 * chat widget stay in (public) — a phlebotomist on duty has no use for a
 * Careers link.
 *
 * `role` and `userName` are placeholders until the session hook lands; the
 * dashboards already fetch /api/auth/me for the same data.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppBar role="" />
      <main id="main">{children}</main>
    </>
  );
}
