import { requireRole } from "@/lib/auth-helpers";
import { Role } from "@prisma/client";
import { getConversations, getMessageableUsers } from "@/actions/messaging";
import { MessagingContainer } from "@/components/messaging/MessagingContainer";

export const metadata = {
  title: "Messages | Teacher Studio",
  description: "Securely message your students. Discuss lessons and student progress.",
};

export default async function TeacherMessagesPage() {
  await requireRole(Role.TEACHER);

  const [conversations, messageableUsers] = await Promise.all([
    getConversations(),
    getMessageableUsers(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-heading tracking-tight">
          Messages
        </h1>
        <p className="text-xs text-body-muted mt-1">
          Securely communicate with your students. Discuss lessons and student progress.
        </p>
      </div>

      <MessagingContainer
        conversations={conversations}
        messageableUsers={messageableUsers}
        callerRole="TEACHER"
      />
    </div>
  );
}
