"use client";

import { useEffect } from "react";

/** Notice remote sign-out without waiting for the next admin navigation. */
export function AdminSessionMonitor() {
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const check = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const session = await response.json();
        if (!controller.signal.aborted && !session?.user) {
          window.location.replace("/login");
        }
      } catch {
        // Retry after a network interruption; offline does not mean signed out.
      } finally {
        pending = false;
      }
    };
    void check();
    const timer = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return null;
}
