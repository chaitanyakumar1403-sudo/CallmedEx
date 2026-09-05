/**
 * CallMedex — Session Keeper
 *
 * Access tokens live 60 minutes (ACCESS_TOKEN_EXPIRE_MINUTES). The backend has
 * issued a refresh token alongside every access token since day one, and the
 * frontend threw it away — so an hour into any session every write started
 * failing with "Invalid or expired token", and the ~195 raw `fetch` call sites
 * across the app each handled that in their own way: the booking wizard printed
 * the raw 401 detail over a filled-in form, while the phlebotomist dashboard
 * silently swallowed it and rendered "No processing centre assigned" and
 * "could not load earnings" for a collector who was correctly assigned to one.
 *
 * Patching 195 call sites is not a fix. This installs ONE `window.fetch`
 * wrapper: any 401 from our own API triggers a single shared refresh, and the
 * original request is replayed with the new token. Concurrent 401s share one
 * refresh (`inflight`) instead of stampeding the endpoint. Only when the
 * refresh itself fails is the session actually over.
 */

const REFRESH_PATH = "/api/auth/refresh-token";
const LOGIN_PATH = "/auth/login";

/** Requests that must never be retried or intercepted — they mint the tokens. */
const AUTH_ENDPOINTS = [
  REFRESH_PATH,
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/signup",
  "/api/auth/otp/verify",
  "/api/auth/biometric/verify",
];

let inflight: Promise<string | null> | null = null;

let originalFetch: typeof fetch =
  typeof window !== "undefined" ? window.fetch.bind(window) : (undefined as never);

function apiPathOf(input: RequestInfo | URL): string | null {
  try {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    const url = new URL(raw, window.location.origin);
    // Only our own backend, whether called relatively (/api/...) via the Next
    // rewrite or absolutely through NEXT_PUBLIC_API_URL.
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const sameOrigin = url.origin === window.location.origin;
    const isApiOrigin = apiBase ? raw.startsWith(apiBase) : false;
    if (!sameOrigin && !isApiOrigin) return null;
    return url.pathname.startsWith("/api/") ? url.pathname : null;
  } catch {
    return null;
  }
}

export function storeSession(data: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: unknown;
}) {
  if (typeof window === "undefined") return;
  if (data.access_token) localStorage.setItem("token", data.access_token);
  if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
  if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
  const ttlMs = (data.expires_in ? data.expires_in : 60 * 60) * 1000;
  localStorage.setItem("token_expires_at", String(Date.now() + ttlMs));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  localStorage.removeItem("token_expires_at");
}

/**
 * Exchange the refresh token for a new access token. Returns the new access
 * token, or null when the session is genuinely over. Concurrent callers share
 * one request.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (inflight) return inflight;

  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return Promise.resolve(null);

  const base = process.env.NEXT_PUBLIC_API_URL || "";
  const send = originalFetch || window.fetch.bind(window);
  // The refresh call must not re-enter the interceptor.
  inflight = send(`${base}${REFRESH_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.access_token) return null;
      storeSession(data);
      return data.access_token as string;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

let installed = false;

export function installSessionKeeper() {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const path = apiPathOf(input);

    // Not our API, or an auth endpoint that mints tokens — pass straight through.
    if (!path || AUTH_ENDPOINTS.some((p) => path.startsWith(p))) {
      return originalFetch(input, init);
    }

    const response = await originalFetch(input, init);
    if (response.status !== 401) return response;

    // A 401 on a request that never carried a token is an
    // authentication-required answer, not an expired session — leave it alone
    // so public pages don't bounce anonymous visitors to the login screen.
    const headerBag = init?.headers;
    const sentAuth =
      (headerBag instanceof Headers && headerBag.has("Authorization")) ||
      (!!headerBag &&
        !(headerBag instanceof Headers) &&
        Object.keys(headerBag as Record<string, string>).some(
          (k) => k.toLowerCase() === "authorization"
        )) ||
      (input instanceof Request && input.headers.has("Authorization"));
    if (!sentAuth && !localStorage.getItem("token")) return response;

    const newToken = await refreshAccessToken();
    if (!newToken) {
      clearSession();
      if (!window.location.pathname.startsWith(LOGIN_PATH)) {
        window.location.href = LOGIN_PATH;
      }
      return response;
    }

    // Replay the original request with the fresh token. A Request body can
    // only be read once, so rebuild from a clone when one was passed.
    if (input instanceof Request) {
      const replay = new Request(input.clone(), {});
      replay.headers.set("Authorization", `Bearer ${newToken}`);
      return originalFetch(replay);
    }

    const headers = new Headers(init?.headers || {});
    headers.set("Authorization", `Bearer ${newToken}`);
    return originalFetch(input, { ...init, headers });
  } as typeof fetch;
}
