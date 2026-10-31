/**
 * Production Seed Script - Admin Only
 * Creates:
 * - 1 PlatformSettings singleton row (required for the platform to operate)
 * - 1 Admin User (with full permissions, emailVerified, and phoneVerified)
 * 
 * Does NOT create any dummy students, teachers, mock lessons, or enrollments.
 * 
 * Usage:
 *   npx tsx prisma/seed-admin.ts
 * Or with custom credentials:
 *   $env:ADMIN_EMAIL="custom@domain.com"; $env:ADMIN_PASSWORD="MyPassword123!"; npx tsx prisma/seed-admin.ts
 */

import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL is not set in your environment or .env file.");
  process.exit(1);
}

const adapter = new PrismaPg(connectionString);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Initializing clean database for Gandharva School of Music...\n");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@gandharvaschoolofmusic.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@Gandharva2026!";
  const adminName = process.env.ADMIN_NAME || "Gandharva Admin";
  const adminPhone = process.env.ADMIN_PHONE || "+919876543210";

  console.log(`🔐 Hashing password for admin (${adminEmail})...`);
  const adminPasswordHash = await hashPassword(adminPassword);

  // 1. Platform Settings (Singleton with id: 1)
  const settings = await prisma.platformSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      freeTrialLessonCount: 2,
    },
  });
  console.log(`  ✓ Platform settings initialized (freeTrialLessonCount = ${settings.freeTrialLessonCount})`);

  // 2. Admin User
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: Role.ADMIN,
      passwordHash: adminPasswordHash,
      phone: adminPhone,
      phoneVerified: new Date(),
      emailVerified: new Date(),
      isActive: true,
      timezone: "Asia/Kolkata",
    },
    create: {
      email: adminEmail,
      name: adminName,
      phone: adminPhone,
      phoneVerified: new Date(),
      timezone: "Asia/Kolkata",
      role: Role.ADMIN,
      emailVerified: new Date(),
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });

  console.log(`\n🎉 Success! Clean Admin Account is ready.`);
  console.log(`────────────────────────────────────────────────────`);
  console.log(`  Name:     ${admin.name}`);
  console.log(`  Email:    ${admin.email}`);
  console.log(`  Password: ${adminPassword}`);
  console.log(`  Phone:    ${admin.phone}`);
  console.log(`  Role:     ${admin.role}`);
  console.log(`────────────────────────────────────────────────────`);
  console.log(`✨ Zero students, teachers, or test lessons were created.`);
  console.log(`   You can now log in at /login with these credentials.\n`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

