"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import WhatsAppComponent from "./WhatsAppComponent";

export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideFooter =
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/student") ||
    pathname.startsWith("/classroom") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/lesson") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/book-trial") ||

    pathname.startsWith("/thank-you");

  if (hideFooter) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <WhatsAppComponent />
      <Footer />
    </>
  );
}