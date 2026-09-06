"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, FlaskConical } from "@/components/ui/icons";

interface RecommendTest {
  test_name: string;
  category: string;
  reason: string;
  action_url: string;
  urgency: "low" | "medium" | "high";
}

interface AIAdvisorData {
  health_summary: string;
  risk_factors: string[];
  recommended_tests: RecommendTest[];
  lifestyle_tips: string[];
}

export default function PatientAIAdvisor() {
  const [data, setData] = useState<AIAdvisorData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/v1/patient/ai-recommendations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Could not fetch clinical recommendations.");
      }

      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load AI advice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div id="ai-health-advisor" className="cm-ai-advisor-panel" data-surface="glass">
      {/* Header */}
      <div className="cm-ai-advisor-header">
        <div className="cm-ai-advisor-title-wrap">
          <div className="cm-ai-wave-3d-box" aria-hidden="true">
            {/* 3D Glassmorphic Wave Logo */}
            <svg
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="cm-ai-wave-anim"
              style={{ width: 28, height: 28 }}
            >
              <defs>
                <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--cm-active, #0284c7)" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="waveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--cm-active, #0284c7)" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <path
                d="M4 22C10 14 16 28 22 20C26 14 32 24 36 18"
                stroke="url(#waveGrad1)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 27C10 20 16 32 22 25C26 20 32 29 36 24"
                stroke="url(#waveGrad2)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="22" cy="20" r="2.5" fill="#38bdf8" />
              <circle cx="36" cy="18" r="2" fill="#06b6d4" />
            </svg>
          </div>
          <div>
            <div className="cm-ai-advisor-badge-row">
              <h3 className="cm-ai-advisor-title">AI Preventive Care Advisor</h3>
              <span className="cm-ai-pill-badge">Clinical Intelligence</span>
            </div>
            <p className="cm-ai-advisor-subtitle">
              Continuous clinical monitoring and personalized diagnostic screening recommendations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRecommendations}
          disabled={loading}
          className="cm-ai-refresh-btn"
          aria-label="Refresh AI analysis"
        >
          <RefreshCw size={14} className={loading ? "cm-spin-icon" : ""} />
          <span>{loading ? "Analyzing..." : "Re-analyze"}</span>
        </button>
      </div>

      {/* Body Content */}
      {loading ? (
        <div className="cm-ai-skeleton-loader">
          <div className="cm-ai-skeleton-bar cm-ai-skeleton-bar--title" />
          <div className="cm-ai-skeleton-bar cm-ai-skeleton-bar--text" />
          <div className="cm-ai-skeleton-cards">
            <div className="cm-ai-skeleton-card" />
            <div className="cm-ai-skeleton-card" />
            <div className="cm-ai-skeleton-card" />
          </div>
        </div>
      ) : error ? (
        <div className="cm-ai-error-box">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={fetchRecommendations} className="cm-btn cm-btn--ghost cm-btn--sm">
            Retry
          </button>
        </div>
      ) : data ? (
        <div className="cm-ai-advisor-content">
          {/* Health Summary Card */}
          <div className="cm-ai-summary-card">
            <div className="cm-ai-summary-row">
              <ShieldCheck size={18} className="cm-ai-summary-shield" />
              <div className="cm-ai-summary-text">{data.health_summary}</div>
            </div>
            {data.risk_factors && data.risk_factors.length > 0 && (
              <div className="cm-ai-tags-wrap">
                {data.risk_factors.map((risk, idx) => (
                  <span key={idx} className="cm-ai-risk-tag">
                    <CheckCircle2 size={12} />
                    {risk}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Recommended Tests Grid */}
          <div className="cm-ai-tests-section">
            <div className="cm-ai-section-label">
              <FlaskConical size={14} />
              <span>Recommended Diagnostic Panels</span>
            </div>
            <div className="cm-ai-tests-grid">
              {data.recommended_tests.map((test, index) => (
                <div key={index} className="cm-ai-test-card">
                  <div className="cm-ai-test-card-head">
                    <span className={`cm-ai-urgency-tag cm-ai-urgency-tag--${test.urgency}`}>
                      {test.urgency === "high" ? "Priority" : "Recommended"}
                    </span>
                    <span className="cm-ai-cat-tag">{test.category}</span>
                  </div>

                  <h4 className="cm-ai-test-name">{test.test_name}</h4>
                  <p className="cm-ai-test-reason">{test.reason}</p>

                  <div className="cm-ai-test-footer">
                    <Link href={test.action_url} className="cm-ai-book-btn">
                      <span>Book Diagnostic Panel</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lifestyle & Wellness Tips */}
          {data.lifestyle_tips && data.lifestyle_tips.length > 0 && (
            <div className="cm-ai-tips-box">
              <div className="cm-ai-tips-label">Clinical Care Guidance:</div>
              <ul className="cm-ai-tips-list">
                {data.lifestyle_tips.map((tip, idx) => (
                  <li key={idx} className="cm-ai-tip-item">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
