import type { NextAuthConfig } from "next-auth";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl, headers } = request;
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const pathname = nextUrl.pathname;

      const isAuthRoute =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password");

      const isTeacherRoute =
        pathname === "/teacher" || pathname.startsWith("/teacher/");
      const isStudentRoute =
        pathname === "/student" || pathname.startsWith("/student/");
      const isAdminRoute =
        pathname === "/admin" || pathname.startsWith("/admin/");
      const isLessonRoute = pathname.startsWith("/lesson");
      const isDashboardRoute = pathname === "/dashboard";

      const isProtectedRoute =
        isTeacherRoute || isStudentRoute || isAdminRoute || isLessonRoute || isDashboardRoute;

      const getRedirectUrl = (target: string) => {
        try {
          const rawHost =
            headers.get("x-forwarded-host") || headers.get("host") || "";
          const forwardedHost = rawHost.split(",")[0].trim();
          const rawProto = headers.get("x-forwarded-proto") || "https";
          const forwardedProto = rawProto.split(",")[0].trim();
          if (
            forwardedHost &&
            !forwardedHost.startsWith("localhost") &&
            !forwardedHost.startsWith("127.0.0.1")
          ) {
            return new URL(target, `${forwardedProto}://${forwardedHost}`);
          }
        } catch {
          // Fall through to nextUrl
        }
        return new URL(target, nextUrl);
      };

      // 1. If user is logged in and visits auth pages, redirect to dashboard
      if (isLoggedIn && isAuthRoute) {
        const target =
          role === "ADMIN"
            ? "/admin"
            : role === "TEACHER"
            ? "/teacher/dashboard"
            : role === "STUDENT"
            ? "/student/dashboard"
            : "/dashboard";
        return NextResponse.redirect(getRedirectUrl(target));
      }

      // 2. If unauthenticated user accesses protected route, deny (redirects to /login)
      if (!isLoggedIn && isProtectedRoute) {
        return false;
      }

      // 3. Edge-level defense: non-admin users cannot access admin portal
      if (isLoggedIn && isAdminRoute) {
        if (role && role !== "ADMIN") {
          return NextResponse.redirect(getRedirectUrl("/dashboard"));
        }
      }

      // 4. For /dashboard, /student, and /teacher routes:
      // Allow request to proceed to Server Component layouts (StudentDashboardLayout, TeacherDashboardLayout, DashboardRedirectPage)
      // which query the live database via getCurrentUser() and handle role-based redirection natively
      // with Next.js redirect(), ensuring flawless RSC flight stream handling without "unexpected response" router crashes.
      return true;
    },

    redirect({ url, baseUrl }) {
      // 1. If it's a relative path (e.g. "/admin" or "/student/dashboard"), keep it relative
      // so the browser resolves it against the active domain on mobile / external devices!
      if (url.startsWith("/")) {
        return url;
      }

      try {
        const parsed = new URL(url);
        const base = new URL(baseUrl);

        // Normalize hostnames (strip www and port differences)
        const parsedHost = parsed.hostname.replace(/^www\./, "").toLowerCase();
        const baseHost = base.hostname.replace(/^www\./, "").toLowerCase();

        // If it's an internal redirect (same root host, localhost, Vercel preview, Cloudflare tunnel, or gandharvaschoolofmusic.com)
        if (
          parsedHost === baseHost ||
          parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname.endsWith(".vercel.app") ||
          parsed.hostname.endsWith(".trycloudflare.com") ||
          parsed.hostname.endsWith("gandharvaschoolofmusic.com")
        ) {
          return parsed.pathname + parsed.search + parsed.hash;
        }

        if (parsed.origin === base.origin) {
          return url;
        }
      } catch {
        // Fallback
      }

      return url.startsWith("/") ? url : "/";
    },


    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.emailVerified = user.emailVerified;
        token.timezone = user.timezone;
        token.picture = user.image;
        if (!token.sessionId) {
          token.sessionId = user.sessionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
        }
      }

      // Ensure every token has a stable sessionId
      if (!token.sessionId) {
        token.sessionId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
      }

      if (trigger === "update" && session) {
        if (session.user?.role) token.role = session.user.role;
        if (session.user?.emailVerified) token.emailVerified = session.user.emailVerified;
        if (session.user?.timezone) token.timezone = session.user.timezone;
        if (session.user?.email) token.email = session.user.email;
        if (session.user?.image !== undefined) token.picture = session.user.image;
      }

      return token;
    },

    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.emailVerified = (token.emailVerified as Date) ?? null;
        session.user.timezone = (token.timezone as string) ?? "UTC";
        session.user.image = (token.picture as string) ?? null;
        session.user.sessionId = (token.sessionId as string) || undefined;
      }
      return session;
    },
  },
  providers: [], // Populated in auth.ts with server-side providers
};
