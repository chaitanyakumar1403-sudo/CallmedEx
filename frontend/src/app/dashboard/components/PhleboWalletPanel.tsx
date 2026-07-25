"use client";

/**
 * Wallet Panel — field providers (phlebotomist first).
 *
 * Mirrors the MOU payment terms: part-time phlebotomists accrue their
 * per-collection rate as each tube is VERIFIED by the receiving lab, and the
 * balance settles to their bank monthly. Full-time phlebotomists are salaried,
 * so they see incentives and adjustments here but no per-collection accrual.
 *
 * A payment hold (a missed 05:15 selfie, or an open complaint) blocks
 * settlement, not accrual — so the banner explains the balance is still theirs.
 */

import { useCallback, useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

const REASON_LABEL: Record<string, string> = {
  collection_payout: "Sample collection",
  service_payout: "Service payout",
  incentive: "Incentive",
  penalty: "Penalty",
  adjustment: "Adjustment",
  settlement: "Settled to bank",
  reversal: "Reversal",
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PhleboWalletPanel() {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/samples/wallet`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Could not load your wallet.");
        return;
      }
      setWallet(data);
    } catch {
      setError("Network error loading your wallet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading wallet…</div>;
  }
  if (error) {
    return (
      <div className="card" style={{ padding: 20, color: "#991b1b", background: "#fef2f2" }}>
        {error}
      </div>
    );
  }

  const txns: any[] = wallet?.transactions || [];

  // "This month" is what the monthly settlement will actually pay out.
  const now = new Date();
  const thisMonth = txns.filter((t) => {
    const d = new Date(t.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const earnedThisMonth = thisMonth
    .filter((t) => t.direction === "credit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const collectionsThisMonth = thisMonth.filter(
    (t) => t.reason === "collection_payout" && t.direction === "credit"
  ).length;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {wallet.on_hold && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 10,
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
          }}
        >
          <strong>⏸ Payout on hold.</strong>{" "}
          {wallet.hold_reason || "Contact operations."} Your balance keeps accruing —
          only the transfer is paused.
        </div>
      )}

      {/* ── Headline figures ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <div
          className="card"
          style={{
            padding: 20,
            background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>Wallet balance</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: 4 }}>{inr(wallet.balance)}</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: 6 }}>Settles monthly to your bank</div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Earned this month</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
            {inr(earnedThisMonth)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 6 }}>
            {collectionsThisMonth} verified collection{collectionsThisMonth === 1 ? "" : "s"}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Lifetime earned</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
            {inr(wallet.lifetime_earned)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 6 }}>
            {inr(wallet.lifetime_paid)} paid out
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderRadius: 10,
          background: "#f1f5f9",
          fontSize: "0.83rem",
          color: "#475569",
        }}
      >
        💡 A collection is credited only once the receiving lab <strong>verifies</strong> the
        tube. Rejected tubes are not payable.
      </div>

      {/* ── Ledger ───────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem" }}>📒 Statement</h3>
        {txns.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>
            No entries yet. Your first verified collection will appear here.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {txns.map((t) => {
              const credit = t.direction === "credit";
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#f8fafc",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.9rem" }}>
                      {REASON_LABEL[t.reason] || t.reason}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {new Date(t.created_at).toLocaleString("en-IN")}
                      {t.notes ? ` • ${t.notes}` : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      color: credit ? "#166534" : "#991b1b",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {credit ? "+" : "−"}
                    {inr(t.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
