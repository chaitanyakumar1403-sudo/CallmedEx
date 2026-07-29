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
 *
 * The balance is a cached projection, always recomputed from
 * `wallet_transactions` server-side — never edited in place. So the ledger
 * below treats credit and debit as equally first-class: each row carries a
 * Pill naming its direction, not just a colour, because a disputed collection
 * is reversed with a compensating entry the phlebotomist has to be able to
 * read, not a colour they have to guess at in direct sun.
 */

import { useCallback, useEffect, useState } from "react";
import { Banner, Icon, Panel, Pill, SkeletonRows, Stat, StatGrid } from "@/components/ui";
import { Award, CheckCircle2, IndianRupee, Wallet } from "@/components/ui/icons";

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
    return <SkeletonRows rows={3} />;
  }
  if (error) {
    return <Banner tone="urgent">{error}</Banner>;
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
    <div className="cm-wallet">
      {wallet.on_hold && (
        <Banner tone="waiting">
          <strong>Payout on hold.</strong> {wallet.hold_reason || "Contact operations."} Your
          balance keeps accruing — only the transfer is paused.
        </Banner>
      )}

      <StatGrid>
        <Stat
          label="Wallet balance"
          value={inr(wallet.balance)}
          meta="Settles monthly to your bank"
          icon={Wallet}
          tone="done"
        />
        <Stat
          label="Earned this month"
          value={inr(earnedThisMonth)}
          meta={`${collectionsThisMonth} verified collection${collectionsThisMonth === 1 ? "" : "s"}`}
          icon={IndianRupee}
        />
        <Stat
          label="Upsell incentives this month"
          value={inr(wallet.incentive_month || 0)}
          meta="Doorstep add-test rewards"
          icon={Award}
        />
        <Stat
          label="Lifetime earned"
          value={inr(wallet.lifetime_earned)}
          meta={`${inr(wallet.lifetime_paid)} paid out`}
          icon={CheckCircle2}
        />
      </StatGrid>

      <div className="cm-wallet__tip">
        <Icon as={CheckCircle2} size={16} />
        <span>
          A collection is credited only once the receiving lab <strong>verifies</strong> the
          tube. Rejected tubes are not payable.
        </span>
      </div>

      {/* ── Ledger ───────────────────────────────────────────────────── */}
      <Panel title="Statement">
        {txns.length === 0 ? (
          <p className="cm-wallet__empty">
            No entries yet. Your first verified collection will appear here.
          </p>
        ) : (
          <div className="cm-ledger">
            {txns.map((t) => {
              const credit = t.direction === "credit";
              return (
                <div key={t.id} className="cm-ledger__row">
                  <div className="cm-ledger__info">
                    <div className="cm-ledger__reason">{REASON_LABEL[t.reason] || t.reason}</div>
                    <div className="cm-ledger__meta">
                      {new Date(t.created_at).toLocaleString("en-IN")}
                      {t.notes ? ` • ${t.notes}` : ""}
                    </div>
                  </div>
                  <Pill tone={credit ? "done" : "halted"}>{credit ? "Credit" : "Debit"}</Pill>
                  <span
                    className={`cm-amount ${credit ? "cm-amount--credit" : "cm-amount--debit"}`}
                  >
                    {credit ? "+" : "−"}
                    {inr(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
