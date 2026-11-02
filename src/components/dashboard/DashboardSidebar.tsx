"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
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
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load sidebar collapse preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("student_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("student_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Close drawer and reset navigating state on path change
  useEffect(() => {
    setNavigatingTo(null);
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  // Handle escape key and lock body scroll when mobile drawer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileDrawerOpen(false);
      }
    };
    if (isMobileDrawerOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isMobileDrawerOpen]);

  const checkIsActive = (href: string, exact?: boolean) => {
    if (navigatingTo) {
      return exact ? navigatingTo === href : navigatingTo.startsWith(href);
    }
    if (!pathname) return false;
    return exact ? pathname === href : pathname.startsWith(href);
  };

  const currentItem =
    STUDENT_NAV_ITEMS.find((item) => checkIsActive(item.href, item.exact)) ||
    STUDENT_NAV_ITEMS[0];

  const initials =
    user.name
      ?.split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ST";

  return (
    <>
      {/* ── Persistent Left Sidebar for Tablets, Laptops & Desktops (>= 640px) ── */}
      <aside
        className={`hidden sm:flex flex-col shrink-0 bg-primary text-white sticky top-16 h-[calc(100vh-4rem)] p-3 space-y-2 shadow-xl z-40 select-none overflow-hidden transition-all duration-200 ease-in-out ${
          isCollapsed ? "w-16" : "w-56 lg:w-60"
        }`}
      >
        {/* Sidebar Header with Collapse / Expand Toggle */}
        <div className="flex items-center justify-between px-1.5 py-1">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-serif font-bold text-sm tracking-wide text-white truncate">
                  Gandharva
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-[#FF9E40] shrink-0">
                  Student
                </span>
              </div>
              <button
                type="button"
                onClick={toggleCollapsed}
                title="Collapse sidebar to icon rail"
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={toggleCollapsed}
                title="Expand sidebar"
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items List */}
        <nav className="space-y-0.5 flex-1 overflow-y-auto pr-1 text-xs sidebar-scroll">
          {STUDENT_NAV_ITEMS.map((item) => {
            const isActive = checkIsActive(item.href, item.exact);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => setNavigatingTo(item.href)}
                title={isCollapsed ? item.label : undefined}
                className={`relative flex items-center rounded-xl text-xs transition-all active:scale-[0.98] ${
                  isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-white/15 text-white font-bold shadow-xs"
                    : "text-white/70 hover:text-white hover:bg-white/5 font-medium"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? "text-[#FF9E40]" : "text-white/70"
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate flex-1">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#FF7803]/20 text-[#FF9E40] shrink-0">
                    {item.badge}
                  </span>
                )}
                {!isCollapsed && isActive && (
                  <span className="w-1.5 h-4 rounded-full bg-[#FF7803] shrink-0" />
                )}
                {isCollapsed && isActive && (
                  <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-[#FF7803]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Card at Bottom */}
        <div className="pt-2">
          {!isCollapsed ? (
            <Link
              href="/student/dashboard/profile"
              className="p-2 rounded-xl bg-black/25 hover:bg-black/35 flex items-center gap-2.5 transition-all group cursor-pointer shadow-2xs"
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
                  {initials}
                </div>
              )}
              <div className="overflow-hidden min-w-0 flex-1">
                <div className="text-xs font-bold text-white group-hover:text-[#FF9E40] transition-colors truncate">
                  {user.name}
                </div>
                <div className="text-[10px] text-white/50 truncate">
                  {user.email}
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <Link
                href="/student/dashboard/profile"
                title={`${user.name} (${user.email})`}
                className="transition-transform hover:scale-105"
              >
                {user.image ? (
                  <div className="relative w-8 h-8 rounded-full overflow-hidden shadow-xs">
                    <Image
                      src={user.image}
                      alt={user.name || "Student"}
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#4E1A8E] text-white flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                    {initials}
                  </div>
                )}
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile Top Bar with Left Drawer Trigger (< 640px) ── */}
      <div className="sm:hidden sticky top-16 z-30 bg-primary text-white shrink-0 shadow-xs border-b border-white/10 px-3 py-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white font-medium text-xs cursor-pointer"
        >
          <Menu className="w-4 h-4 text-[#FF9E40]" />
          <span className="font-semibold truncate max-w-[150px]">
            {currentItem.label}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-[#FF9E40]">
            Student
          </span>
          <div className="w-6 h-6 rounded-full bg-[#4E1A8E] text-white flex items-center justify-center font-bold text-[10px]">
            {initials}
          </div>
        </div>
      </div>

      {/* ── Mobile Left Slide-out Drawer (< 640px) ── */}
      {isMobileDrawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer content sliding in from the LEFT */}
          <aside className="relative flex flex-col w-72 max-w-[85vw] bg-primary text-white h-full p-4 space-y-2 shadow-2xl z-50 select-none overflow-hidden animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base tracking-wide text-white">
                  Gandharva
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/10 text-[#FF9E40]">
                  Student
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Nav Items */}
            <nav className="space-y-1 flex-1 overflow-y-auto pr-1 text-xs py-2 sidebar-scroll">
              {STUDENT_NAV_ITEMS.map((item) => {
                const isActive = checkIsActive(item.href, item.exact);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      setNavigatingTo(item.href);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all active:scale-[0.98] ${
                      isActive
                        ? "bg-white/15 text-white font-bold shadow-xs ring-1 ring-white/10"
                        : "text-white/70 hover:text-white hover:bg-white/5 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? "text-[#FF9E40]" : "text-white/70"
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
                        <span className="w-1.5 h-4 rounded-full bg-[#FF7803] shrink-0" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Drawer User Card */}
            <div className="pt-2 border-t border-white/10">
              <Link
                href="/student/dashboard/profile"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-2.5 rounded-2xl bg-black/25 flex items-center gap-2.5 shadow-2xs"
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
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-white/50 truncate">
                    {user.email}
                  </div>
                </div>
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
