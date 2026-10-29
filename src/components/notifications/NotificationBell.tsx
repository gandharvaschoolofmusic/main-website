"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  GraduationCap,
  UserCheck,
  UserPlus,
  Sparkles,
  Calendar,
  Clock,
  CircleDollarSign,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Music,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/actions/notifications";
import { NotificationType } from "@prisma/client";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date | string;
};

function formatRelativeTime(dateInput: Date | string): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.NEW_TEACHER_SIGNUP:
      return {
        icon: UserCheck,
        bg: "bg-purple-100 text-purple-700",
        border: "border-purple-200",
      };
    case NotificationType.NEW_STUDENT_SIGNUP:
      return {
        icon: UserPlus,
        bg: "bg-emerald-100 text-emerald-700",
        border: "border-emerald-200",
      };
    case NotificationType.TEACHER_APPROVED:
      return {
        icon: CheckCircle2,
        bg: "bg-emerald-100 text-emerald-700",
        border: "border-emerald-200",
      };
    case NotificationType.TEACHER_REJECTED:
      return {
        icon: AlertCircle,
        bg: "bg-rose-100 text-rose-700",
        border: "border-rose-200",
      };
    case NotificationType.NEW_TRIAL_REQUEST:
    case NotificationType.TRIAL_ALLOTTED:
      return {
        icon: Sparkles,
        bg: "bg-amber-100 text-amber-700",
        border: "border-amber-200",
      };
    case NotificationType.NEW_LESSON_BOOKED:
    case NotificationType.LESSON_REMINDER:
      return {
        icon: Calendar,
        bg: "bg-blue-100 text-blue-700",
        border: "border-blue-200",
      };
    case NotificationType.LESSON_RESCHEDULED:
      return {
        icon: Clock,
        bg: "bg-amber-100 text-amber-700",
        border: "border-amber-200",
      };
    case NotificationType.NEW_ENROLLMENT:
      return {
        icon: GraduationCap,
        bg: "bg-indigo-100 text-indigo-700",
        border: "border-indigo-200",
      };
    case NotificationType.PAYOUT_COMPLETED:
      return {
        icon: CircleDollarSign,
        bg: "bg-green-100 text-green-700",
        border: "border-green-200",
      };
    case NotificationType.NEW_SUPPORT_TICKET:
    case NotificationType.SUPPORT_TICKET_REPLY:
      return {
        icon: LifeBuoy,
        bg: "bg-rose-100 text-rose-700",
        border: "border-rose-200",
      };
    default:
      return {
        icon: Bell,
        bg: "bg-primary-subtle text-primary",
        border: "border-purple-200",
      };
  }
}

export function NotificationBell({ userRole }: { userRole?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);

  // Initial fetch and auto-polling every 25 seconds for fast updates
  const loadNotifications = async () => {
    try {
      const [list, count] = await Promise.all([
        getNotifications(25),
        getUnreadCount(),
      ]);
      setNotifications(list as NotificationItem[]);
      setUnreadCount(count);
    } catch {
      // Background poll failure silent
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 25000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      // Reload on open to show freshest fast info
      setIsLoading(true);
      loadNotifications().finally(() => setIsLoading(false));
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    startTransition(async () => {
      await markNotificationRead(id);
    });
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    startTransition(async () => {
      await markAllNotificationsRead();
    });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === id);
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    startTransition(async () => {
      await deleteNotification(id);
    });
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      await handleMarkAsRead(item.id);
    }
    setIsOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  const displayedNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Platform Notifications"
        aria-expanded={isOpen}
        className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white transition-all btn-tactile focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Bell className="w-4 h-4 sm:w-[18px] sm:h-[18px] transition-transform" />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-sm ring-2 ring-primary animate-pulse-subtle">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications panel"
          className="absolute right-0 top-full mt-2.5 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl border border-border-subtle overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right text-heading"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="font-sans font-bold text-sm tracking-tight text-heading">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-dark">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium text-cta hover:text-cta-hover active:scale-95 transition-all flex items-center gap-1 btn-tactile cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-bg-alt/20 border-b border-border-subtle/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeTab === "all"
                  ? "bg-white text-heading font-semibold shadow-xs"
                  : "text-body hover:text-heading"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("unread")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeTab === "unread"
                  ? "bg-white text-heading font-semibold shadow-xs"
                  : "text-body hover:text-heading"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-border-subtle/50 overscroll-contain">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-body-muted">
                Loading notifications...
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-11 h-11 rounded-full bg-primary-subtle/60 text-primary flex items-center justify-center mb-2.5">
                  <Bell className="w-5 h-5 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-heading">
                  {activeTab === "unread"
                    ? "No unread notifications"
                    : "All caught up!"}
                </p>
                <p className="text-[11px] text-body-muted mt-0.5 max-w-xs">
                  {activeTab === "unread"
                    ? "You have acknowledged all recent updates."
                    : "Real-time admissions, student alerts, and schedule changes will appear here."}
                </p>
              </div>
            ) : (
              displayedNotifications.map((item) => {
                const iconConfig = getNotificationIcon(item.type);
                const IconComponent = iconConfig.icon;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer text-left ${
                      item.isRead
                        ? "bg-white hover:bg-bg-alt/30"
                        : "bg-primary-subtle/30 hover:bg-primary-subtle/50"
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`relative flex items-center justify-center w-8 h-8 rounded-xl shrink-0 mt-0.5 ${iconConfig.bg} border ${iconConfig.border} shadow-2xs`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-5">
                      <div className="flex items-center gap-1.5">
                        <p
                          className={`text-xs font-semibold truncate ${
                            item.isRead ? "text-heading" : "text-heading font-bold"
                          }`}
                        >
                          {item.title}
                        </p>
                        {!item.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-body leading-relaxed line-clamp-2 mt-0.5">
                        {item.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-body-muted font-medium">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        {item.link && (
                          <span className="text-[10px] text-cta font-medium flex items-center gap-0.5 opacity-90 group-hover:opacity-100 transition-opacity">
                            View details
                            <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick actions (Dismiss / Mark Read) */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {!item.isRead && (
                        <button
                          type="button"
                          title="Mark as read"
                          onClick={(e) => handleMarkAsRead(item.id, e)}
                          className="p-1 rounded-md text-body-muted hover:text-heading hover:bg-white/80 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Delete notification"
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-1 rounded-md text-body-muted hover:text-rose-600 hover:bg-white/80 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer role status */}
          <div className="px-4 py-2 bg-bg-alt/25 border-t border-border-subtle flex items-center justify-between text-[11px] text-body-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Platform Feed
            </span>
            <span className="capitalize font-medium text-body">
              {userRole?.toLowerCase() || "Account"} Portal
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
