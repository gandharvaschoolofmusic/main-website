"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Keep admission queues current when requests arrive from another user's session. */
export function AdminQueueRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!["/admin", "/admin/student-courses"].includes(pathname)) return;
    const refresh = () => {
      // Do not interrupt an administrator entering an allotment or editing a dialog.
      if (document.visibilityState !== "visible" || document.querySelector("dialog[open], [role='dialog']")) return;
      if (document.activeElement?.matches("input, textarea, select, [contenteditable='true']")) return;
      router.refresh();
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname, router]);
  return null;
}
