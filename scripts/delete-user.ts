import { db } from "../src/lib/db";

/**
 * Utility script to safely delete a user (student or teacher) and their cascading child records
 * Usage: npx tsx scripts/delete-user.ts <CUSTOM_ID_OR_EMAIL>
 * Example: npx tsx scripts/delete-user.ts S0002
 * Example: npx tsx scripts/delete-user.ts student@example.com
 */
async function deleteUser(identifier: string) {
  if (!identifier || !identifier.trim()) {
    console.error("❌ Please provide a Custom ID (e.g. S0002, T0001) or Email address.");
    process.exit(1);
  }

  const cleanIdentifier = identifier.trim();
  console.log(`🔍 Searching for user with identifier: "${cleanIdentifier}"...`);

  const user = await db.user.findFirst({
    where: {
      OR: [
        { customId: cleanIdentifier },
        { email: { equals: cleanIdentifier, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      customId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  if (!user) {
    console.log(`⚠️ No user found matching "${cleanIdentifier}".`);
    return;
  }

  console.log(`Found ${user.role}: ${user.name} (${user.customId || "No Custom ID"}, ${user.email})`);

  await db.$transaction(async (tx) => {
    // 1. Delete notifications
    await tx.notification.deleteMany({
      where: { userId: user.id },
    });

    // 2. Delete conversations and messages
    await tx.directMessage.deleteMany({
      where: { senderId: user.id },
    });
    await tx.conversation.deleteMany({
      where: {
        OR: [{ studentId: user.id }, { teacherId: user.id }],
      },
    });

    // 3. Delete trial records
    await tx.studentTrialStatus.deleteMany({
      where: { studentId: user.id },
    });
    await tx.trialRequest.deleteMany({
      where: {
        OR: [{ studentId: user.id }, { teacherId: user.id }],
      },
    });

    // 4. Delete course enrollments, requests, and lessons
    await tx.courseEnrollmentRequest.deleteMany({
      where: { studentId: user.id },
    });
    await tx.enrollment.deleteMany({
      where: { studentId: user.id },
    });
    await tx.lesson.deleteMany({
      where: {
        OR: [{ studentId: user.id }, { teacherId: user.id }],
      },
    });

    // 5. Delete event registrations
    await tx.eventRegistration.deleteMany({
      where: { userId: user.id },
    });

    // 6. Delete resources and shares
    await tx.resourceShare.deleteMany({
      where: { studentId: user.id },
    });
    await tx.resource.deleteMany({
      where: { teacherId: user.id },
    });

    // 7. Delete teacher profile if applicable
    await tx.teacherProfile.deleteMany({
      where: { userId: user.id },
    });

    // 8. Delete support tickets & payments
    await tx.supportTicket.deleteMany({
      where: { userId: user.id },
    });
    await tx.payment.deleteMany({
      where: { userId: user.id },
    });

    // 9. Delete sessions & accounts
    await tx.session.deleteMany({
      where: { userId: user.id },
    });
    await tx.account.deleteMany({
      where: { userId: user.id },
    });

    // 10. Clean up phone tokens
    if (user.phone) {
      await tx.phoneVerificationToken.deleteMany({
        where: { phone: user.phone },
      });
    }

    // 11. Clean up email verification tokens
    if (user.email) {
      await tx.verificationToken.deleteMany({
        where: { identifier: user.email },
      });
    }

    // 12. Delete user record
    await tx.user.delete({
      where: { id: user.id },
    });
  });

  console.log(`✅ Successfully deleted ${user.role} ${user.customId || ""} (${user.name}) from database.`);
}

const target = process.argv[2];
deleteUser(target)
  .catch(console.error)
  .finally(() => db.$disconnect());
