import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      emailVerified: Date | null;
      timezone: string;
      sessionId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: Role;
    emailVerified?: Date | null;
    timezone?: string;
    sessionId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    emailVerified?: Date | null;
    timezone?: string;
    sessionId?: string;
  }
}
