import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const POOL_VERSION = 6;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
  connectionString: string | undefined;
  poolVersion: number | undefined;
};

const rawConnectionString = process.env.DATABASE_URL || "";
let connectionString = rawConnectionString;

// Auto-rewrite direct Supabase host to IPv4-compatible connection pooler
// Direct db.<ref>.supabase.co only provides IPv6 AAAA records which fails on standard IPv4 networks
if (connectionString.includes("db.kprifflfakbucchpimvz.supabase.co")) {
  if (!connectionString.includes("postgres.kprifflfakbucchpimvz:")) {
    connectionString = connectionString.replace("postgres:", "postgres.kprifflfakbucchpimvz:");
  }
  connectionString = connectionString.replace("db.kprifflfakbucchpimvz.supabase.co", "aws-0-ap-northeast-1.pooler.supabase.com");
}

// Automatically route Supabase connections to the dedicated PgBouncer / Supavisor transaction pooler (port 6543)
// instead of port 5432 (session mode pooler).
// Session mode pooler (port 5432) has a strict cap of 15 connections (EMAXCONNSESSION) which crashes
// in serverless environments (Vercel) and during concurrent navigation ("Session or Data Sync Interrupted").
// Transaction mode pooler (port 6543) supports unlimited concurrent connections.
if (connectionString.includes(":5432")) {
  connectionString = connectionString.replace(":5432", ":6543");
}

const isSupabaseOrSsl =
  connectionString.includes("supabase.co") ||
  connectionString.includes("supabase.com") ||
  connectionString.includes("sslmode=");

// Clean connection string so pg driver uses explicit ssl object without forcing verify-full
if (isSupabaseOrSsl && connectionString.includes("sslmode=")) {
  connectionString = connectionString
    .replace(/([?&])sslmode=[^&]+(&|$)/, "$1")
    .replace(/[?&]$/, "");
}

// Invalidate stale cached pool and prisma instances across Turbopack HMR reloads
if (
  globalForPrisma.pool &&
  (globalForPrisma.poolVersion !== POOL_VERSION ||
    globalForPrisma.connectionString !== connectionString)
) {
  try {
    globalForPrisma.pool.end();
  } catch {}
  globalForPrisma.pool = undefined;
  globalForPrisma.prisma = undefined;
}
globalForPrisma.poolVersion = POOL_VERSION;
globalForPrisma.connectionString = connectionString;

// Transaction mode pooler (port 6543) with max: 15 connections per serverless instance
// Extended idleTimeoutMillis to 5 minutes so connections remain hot and avoid repeated 400ms TCP/TLS handshakes
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    ssl: isSupabaseOrSsl ? { rejectUnauthorized: false } : undefined,
    max: 15,
    idleTimeoutMillis: 300000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

// Catch background socket errors on idle clients so they do not crash or leak
pool.on("error", (err) => {
  console.warn("PostgreSQL connection pool client error (idle socket drop handled):", err.message);
});

if (!globalForPrisma.pool) {
  globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db;
}

