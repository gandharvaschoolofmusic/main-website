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
      <aside className="hidden md:flex flex-col w-64 bg-primary text-white shrink-0 sticky top-16 h-[calc(100vh-4rem)] p-4 justify-between shadow-md select-none overflow-hidden">
        <div className="flex flex-col h-full overflow-hidden space-y-4">
          {/* Academy Brand Mini-Header */}
          <div className="px-2 py-1.5 flex items-center justify-between pb-3 shrink-0">
            <Link href="/" className="flex items-center">
              <Image
                src="/cropped-Add-a-subheading-5-png-scaled.webp"
                alt="Gandharva School of Music"
                width={130}
                height={40}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-[#FF9E40]">
              Student
            </span>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1 flex-1 overflow-y-auto pr-1 text-xs sidebar-scroll">
            {STUDENT_NAV_ITEMS.map((item) => {
              const isActive = checkIsActive(item.href, item.exact);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onClick={() => setNavigatingTo(item.href)}
                  className={`btn-tactile flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group active:scale-[0.98] ${
                    isActive
                      ? "bg-white/15 text-white font-bold shadow-xs"
                      : "text-white/75 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors shrink-0 ${
                        isActive
                          ? "text-white"
                          : "text-white/60 group-hover:text-white"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#FF7803]/20 text-[#FF9E40]">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="w-1.5 h-3.5 rounded-full bg-[#FF7803] shrink-0" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User Card */}
          <div className="pt-2 shrink-0">
            <Link
              href="/student/dashboard/profile"
              className="btn-tactile p-2.5 bg-black/25 hover:bg-black/35 rounded-2xl flex items-center gap-2.5 transition-all group cursor-pointer shadow-2xs"
              title="Manage Student Profile & Settings"
            >
              {user.image ? (
                <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-xs">
                  <Image
                    src={user.image}
                    alt={user.name || "Student"}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#4E1A8E] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-inner">
                  {user.name?.slice(0, 2).toUpperCase() || "ST"}
                </div>
              )}
              <div className="overflow-hidden min-w-0 flex-1">
                <div className="text-xs font-bold text-white group-hover:text-[#FF9E40] transition-colors truncate">
                  {user.name}
                </div>
                <div className="text-[10px] text-white/60 truncate">
                  {user.email}
                </div>
              </div>
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile Top Navigation Tabs (< 768px, 100% usable at 375px) */}
      <div className="md:hidden sticky top-16 z-30 bg-primary text-white backdrop-blur-md px-3 py-2 overflow-x-auto no-scrollbar flex gap-1.5 shadow-md">
        {STUDENT_NAV_ITEMS.map((item) => {
          const isActive = checkIsActive(item.href, item.exact);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={() => setNavigatingTo(item.href)}
              className={`btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? "bg-white/20 text-white shadow-xs font-bold"
                  : "text-white/70 hover:text-white bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="text-[8px] uppercase font-bold px-1 py-0.5 rounded bg-[#FF7803]/20 text-[#FF9E40]">
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

