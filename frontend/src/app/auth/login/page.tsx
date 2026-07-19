"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Read values manually since there's no form element anymore
    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
    const email = emailInput?.value || "";
    const password = passwordInput?.value || "";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        const errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        throw new Error(errorMsg || "Login failed");
      }

      // Store token and user info
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect to role-specific dashboard
      const role = data.user.role;
      router.push(`/dashboard/${role}`);
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

        <div className="login-form-container">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input name="email" type="email" className="form-input" placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input name="password" type="password" className="form-input" placeholder="Enter your password" required />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, fontSize: "0.85rem" }}>
            <label className="form-checkbox">
              <input type="checkbox" /> Remember me
            </label>
            <a href="#" style={{ color: "var(--color-teal)" }}>Forgot Password?</a>
          </div>
          <button type="button" onClick={handleSubmit} className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          <p style={{ textAlign: "center", marginTop: 20, fontSize: "0.9rem", color: "var(--color-gray-500)" }}>
            Don&apos;t have an account? <a href="/auth/signup" style={{ color: "var(--color-navy)", fontWeight: 600 }}>Sign Up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
