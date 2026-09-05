"use client";

import { useEffect } from "react";
import { installSessionKeeper } from "@/lib/sessionKeeper";

/**
 * Installs the global 401 → refresh → replay interceptor once, for the whole
 * app. Mounted from the root layout so every page — and every raw `fetch` in
 * them — is covered without touching ~195 call sites.
 */
export default function SessionKeeper() {
  useEffect(() => {
    installSessionKeeper();
  }, []);
  return null;
}
