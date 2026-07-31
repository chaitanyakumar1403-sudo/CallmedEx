"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

/** Decode JWT payload to check expiry without verifying signature */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp;
  } catch {
    return true; // Treat unparseable tokens as expired
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const email = emailRef.current?.value || "";
    const password = passwordRef.current?.value || "";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        throw new Error(errorMsg || "Login failed");
      }

      // Store token and user info
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Store expiry for client-side pre-check
      localStorage.setItem("token_expires_at", String(Date.now() + 60 * 60 * 1000)); // 60 min

      // Redirect to role-specific dashboard
      const role = data.user.role;
      const slug = role === 'processing_center' ? 'processing-center' : role;
      router.push(`/dashboard/${slug}`);
    } catch (err: unknown) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card auth-card--login">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "3rem", marginBottom: 8 }}>🫀</div>
          <h2>Welcome Back</h2>
          <p className="subtitle">Login to your CallMedex account</p>
        </div>

        {error && (
          <div className="form-error" style={{ textAlign: "center", marginBottom: 16, fontSize: "0.9rem", padding: "10px", background: "#fef2f2", borderRadius: 8 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form-container">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input id="login-email" ref={emailRef} name="email" type="email" className="form-input" placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input id="login-password" ref={passwordRef} name="password" type="password" className="form-input" placeholder="Enter your password" required />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, fontSize: "0.85rem" }}>
            <label className="form-checkbox">
              <input type="checkbox" /> Remember me
            </label>
            <a href="/auth/forgot-password" style={{ color: "var(--color-teal)" }}>Forgot Password?</a>
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
          <p style={{ textAlign: "center", marginTop: 20, fontSize: "0.9rem", color: "var(--color-gray-500)" }}>
            Don&apos;t have an account? <a href="/auth/signup" style={{ color: "var(--color-navy)", fontWeight: 600 }}>Sign Up</a>
          </p>
        </div>
      </div>
  );
}
