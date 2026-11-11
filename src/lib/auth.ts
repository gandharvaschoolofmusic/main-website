import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { LoginSchema } from "@/schemas/auth";
import type { Provider } from "next-auth/providers";

import {
  normalizePhoneNumber,
  validateAndConsumePhoneOtp,
  getPhoneLookupVariations,
} from "@/lib/phone";
import { verifyTwoFactorChallenge } from "@/lib/two-factor-token";

const providers: Provider[] = [
  Credentials({
    name: "Credentials",
    credentials: {
      identifier: { label: "Email or Phone", type: "text" },
      email: { label: "Email", type: "text" },
      password: { label: "Password", type: "password" },
      phone: { label: "Phone", type: "text" },
      code: { label: "OTP Code", type: "text" },
      idToken: { label: "Firebase ID Token", type: "text" },
      authType: { label: "Auth Type", type: "text" },
      twoFactorToken: { label: "2FA Token", type: "text" },
    },
    async authorize(credentials) {
      // ─── 0. Two-Factor TOTP Authenticated Login (Admin 2FA) ──────
      if (credentials?.authType === "2fa_verified") {
        try {
          const twoFactorToken = (credentials?.twoFactorToken as string) || "";
          const payload = verifyTwoFactorChallenge(twoFactorToken);
          if (!payload || !payload.userId) {
            return null;
          }

          const user = await db.user.findUnique({
            where: { id: payload.userId },
            include: {
              teacherProfile: { select: { approvalStatus: true } },
            },
          });

          if (!user || !user.isActive) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            emailVerified: user.emailVerified,
            timezone: user.timezone,
          };
        } catch (err) {
          console.error("Error authorizing 2fa_verified session:", err);
          return null;
        }
      }

      // ─── 1. OTP Authentication (Phone + 6-digit code or Firebase ID Token) ──────
      if (credentials?.authType === "otp") {
        const rawPhone = (credentials?.phone as string) || "";
        const code = (credentials?.code as string)?.trim() || "";
        const idToken = (credentials?.idToken as string)?.trim() || undefined;

        if (!rawPhone || (!code && !idToken)) {
          return null;
        }

        const phone = normalizePhoneNumber(rawPhone);
        const otpValidation = await validateAndConsumePhoneOtp(phone, code, idToken);
        if (!otpValidation.isValid) {
          return null;
        }

        const variations = getPhoneLookupVariations(phone);
        const user = await db.user.findFirst({
          where: { phone: { in: variations } },
          include: {
            teacherProfile: { select: { approvalStatus: true } },
          },
        });

        if (
          !user ||
          !user.isActive ||
          ((user.role === "TEACHER" || user.teacherProfile) &&
            user.teacherProfile?.approvalStatus === "REJECTED")
        ) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          emailVerified: user.emailVerified,
          timezone: user.timezone,
        };
      }

      // ─── 2. Password Authentication (Email OR Phone + Password) ────────
      const rawIdentifier =
        ((credentials?.identifier as string) ||
          (credentials?.email as string) ||
          "").trim();
      const password = (credentials?.password as string) || "";

      if (!rawIdentifier || !password) {
        return null;
      }

      let user = null;
      if (rawIdentifier.includes("@")) {
        user = await db.user.findUnique({
          where: { email: rawIdentifier.toLowerCase() },
          include: {
            teacherProfile: { select: { approvalStatus: true } },
          },
        });
      } else {
        const phone = normalizePhoneNumber(rawIdentifier);
        const variations = getPhoneLookupVariations(phone);
        user = await db.user.findFirst({
          where: { phone: { in: variations } },
          include: {
            teacherProfile: { select: { approvalStatus: true } },
          },
        });
      }

      if (
        !user ||
        !user.passwordHash ||
        !user.isActive ||
        ((user.role === "TEACHER" || user.teacherProfile) &&
          user.teacherProfile?.approvalStatus === "REJECTED")
      ) {
        return null;
      }

      const isValid = await verifyPassword(user.passwordHash, password);
      if (!isValid) {
        return null;
      }

      // If user is ADMIN and has 2FA enabled, direct password sign-in is blocked
      // (They must verify via TOTP 2FA code)
      if (user.role === "ADMIN" && user.twoFactorEnabled) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        emailVerified: user.emailVerified,
        timezone: user.timezone,
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers,
});
