"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Clock,
  Calendar,
  BookOpen,
  HelpCircle,
  Award,
  Sparkles,
  Receipt,
  User as UserIcon,
  Music2,
  MessageSquare,
  FolderArchive,
  Video,
} from "lucide-react";

export type SidebarUserInfo = {
  name: string;
  email: string;
  image?: string | null;
};

const STUDENT_NAV_ITEMS = [
  {
    label: "Upcoming Sessions",
    href: "/student/dashboard",
    icon: Clock,
    exact: true,
  },
  {
    label: "Lecture Recordings",
    href: "/student/dashboard/recordings",
    icon: Video,
  },
  {
    label: "Learning Materials",
    href: "/student/dashboard/resources",
    icon: FolderArchive,
  },
  {
    label: "Solo Music Studio",
    href: "/student/dashboard/studio",
    icon: Music2,
    badge: "Studio",
  },
  {
    label: "Calendar",
    href: "/student/dashboard/calendar",
    icon: Calendar,
  },
  {
    label: "Messages",
    href: "/student/dashboard/messages",
    icon: MessageSquare,
  },
  {
    label: "Courses & Catalog",
    href: "/student/dashboard/courses",
    icon: BookOpen,
  },
  {
    label: "Billing & Receipts",
    href: "/student/dashboard/payments",
    icon: Receipt,
  },
  {
    label: "Help & Support",
    href: "/student/dashboard/support",
    icon: HelpCircle,
  },
  {
    label: "My Certificates",
    href: "/student/dashboard/certificates",
    icon: Award,
  },
  {
    label: "Events & Activities",
    href: "/student/dashboard/events",
    icon: Sparkles,
  },
  {
    label: "Profile",
    href: "/student/dashboard/profile",
    icon: UserIcon,
  },
];

export function DashboardSidebar({ user }: { user: SidebarUserInfo }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  const checkIsActive = (href: string, exact?: boolean) => {
    if (navigatingTo) {
      return exact ? navigatingTo === href : navigatingTo.startsWith(href);
    }
    if (!pathname) return false;
    return exact ? pathname === href : pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar (>= 768px) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-surface-muted/80 shrink-0 sticky top-16 h-[calc(100vh-4rem)] p-4 justify-between shadow-xs">
        <div className="space-y-6">
          {/* Academy Brand Mini-Header */}
          <div className="px-2 py-2 flex items-center justify-between border-b border-surface-muted/80 pb-4">
            <Link href="/" className="flex items-center">
              <Image
                src="/cropped-Add-a-subheading-5-png-scaled.webp"
                alt="Gandharva School of Music"
                width={130}
                height={40}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
              Student
            </span>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            {STUDENT_NAV_ITEMS.map((item) => {
              const isActive = checkIsActive(item.href, item.exact);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onTouchStart={() => router.prefetch(item.href)}
                  onClick={() => setNavigatingTo(item.href)}
                  className={`btn-tactile flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-xs"
                      : "text-body hover:text-heading hover:bg-bg-alt/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive
                          ? "text-primary"
                          : "text-body/60 group-hover:text-heading"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <Link
          href="/student/dashboard/profile"
          className="btn-tactile p-3 bg-bg-alt/25 hover:bg-bg-alt/50 border border-surface-muted/80 hover:border-primary/30 rounded-xl flex items-center gap-3 transition-colors group cursor-pointer"
          title="Manage Student Profile & Settings"
        >
          {user.image ? (
            <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-xs border border-primary/20">
              <Image
                src={user.image}
                alt={user.name || "Student"}
                fill
                sizes="36px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-cta flex items-center justify-center text-white font-bold text-xs uppercase shrink-0 shadow-xs">
              {user.name?.slice(0, 2) || "ST"}
            </div>
          )}
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-heading group-hover:text-primary transition-colors truncate">
              {user.name}
            </div>
            <div className="text-[11px] text-body truncate">
              {user.email}
            </div>
          </div>
        </Link>
      </aside>

      {/* Mobile Top Navigation Tabs (< 768px, 100% usable at 375px) */}
      <div className="md:hidden sticky top-16 z-30 bg-white/95 border-b border-surface-muted/80 backdrop-blur-md px-3 py-2 overflow-x-auto scrollbar-none flex gap-1.5 shadow-xs">
        {STUDENT_NAV_ITEMS.map((item) => {
          const isActive = checkIsActive(item.href, item.exact);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onMouseEnter={() => router.prefetch(item.href)}
              onTouchStart={() => router.prefetch(item.href)}
              onClick={() => setNavigatingTo(item.href)}
              className={`btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? "bg-primary text-white shadow-xs"
                  : "text-body hover:text-heading bg-bg-alt/40 border border-surface-muted/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`text-[8px] uppercase font-bold px-1 py-0.5 rounded ${isActive ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-700"}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}

