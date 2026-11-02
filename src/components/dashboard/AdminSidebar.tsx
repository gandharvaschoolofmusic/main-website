"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Sparkles,
  Music,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Video,
  CreditCard,
  Banknote,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { signOutAction } from "@/actions/auth";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const navItems: NavItem[] = [
  {
    name: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Trial Bookings",
    href: "/admin/trials",
    icon: Sparkles,
  },
  {
    name: "Course Catalog",
    href: "/admin/courses",
    icon: Music,
  },
  {
    name: "Students",
    href: "/admin/students",
    icon: Users,
  },
  {
    name: "Teachers",
    href: "/admin/teachers",
    icon: GraduationCap,
  },
  {
    name: "Enrollments",
    href: "/admin/enrollments",
    icon: BookOpen,
  },
  {
    name: "Classes",
    href: "/admin/lessons",
    icon: Calendar,
  },
  {
    name: "Recordings",
    href: "/admin/recordings",
    icon: Video,
  },
  {
    name: "Payments",
    href: "/admin/payments",
    icon: CreditCard,
  },
  {
    name: "Teacher Payments",
    href: "/admin/teacher-payments",
    icon: Banknote,
  },
  {
    name: "Resources",
    href: "/admin/resources",
    icon: FileText,
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
  {
    name: "Help & Support",
    href: "/admin/support",
    icon: HelpCircle,
  },
];

interface AdminSidebarProps {
  currentUser?: {
    name?: string | null;
    email?: string | null;
  };
}

export function AdminSidebar({ currentUser }: AdminSidebarProps = {}) {
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load sidebar collapse preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin_sidebar_collapsed");
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
        localStorage.setItem("admin_sidebar_collapsed", String(next));
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

  const isActive = (item: NavItem) => {
    if (navigatingTo) {
      if (item.exact) return navigatingTo === item.href;
      return navigatingTo.startsWith(item.href);
    }
    if (!pathname) return false;
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const currentItem = navItems.find((item) => isActive(item)) || navItems[0];
  const displayName = currentUser?.name || "Administrator";
  const displayEmail = currentUser?.email || "India · Global portal";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AM";

  return (
    <>
      {/* ── Persistent Left Sidebar for Tablets, Laptops & Desktops (>= 640px) ── */}
      <aside
        className={`hidden sm:flex flex-col shrink-0 bg-primary text-white h-full max-h-[calc(100vh-4rem)] p-3 space-y-2 shadow-xl z-40 select-none overflow-hidden transition-all duration-200 ease-in-out ${
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
                  Admin
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
          {navItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                onClick={() => setNavigatingTo(item.href)}
                title={isCollapsed ? item.name : undefined}
                className={`relative flex items-center rounded-xl text-xs transition-all active:scale-[0.98] ${
                  isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  active
                    ? "bg-white/15 text-white font-bold shadow-xs"
                    : "text-white/70 hover:text-white hover:bg-white/5 font-medium"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? "text-[#FF9E40]" : "text-white/70"
                  }`}
                />
                {!isCollapsed && <span className="truncate flex-1">{item.name}</span>}
                {!isCollapsed && active && (
                  <span className="w-1.5 h-4 rounded-full bg-[#FF7803] shrink-0" />
                )}
                {isCollapsed && active && (
                  <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-[#FF7803]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Card at Bottom */}
        <div className="pt-2">
          {!isCollapsed ? (
            <div className="p-2 rounded-xl bg-black/25 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#4E1A8E] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white truncate">
                    {displayName}
                  </div>
                  <div className="text-[10px] text-white/50 truncate">
                    {displayEmail}
                  </div>
                </div>
              </div>
              <form action={signOutAction} className="shrink-0">
                <button
                  type="submit"
                  title="Sign Out"
                  className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div
                title={`${displayName} (${displayEmail})`}
                className="w-7 h-7 rounded-full bg-[#4E1A8E] text-white flex items-center justify-center font-bold text-xs shadow-inner cursor-default"
              >
                {initials}
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile Top Bar with Left Drawer Trigger (< 640px) ── */}
      <div className="sm:hidden bg-primary text-white shrink-0 z-30 shadow-xs border-b border-white/10 px-3 py-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white font-medium text-xs cursor-pointer"
        >
          <Menu className="w-4 h-4 text-[#FF9E40]" />
          <span className="font-semibold truncate max-w-[150px]">
            {currentItem.name}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-[#FF9E40]">
            Admin
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
                  Admin
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
              {navItems.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      setNavigatingTo(item.href);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all active:scale-[0.98] ${
                      active
                        ? "bg-white/15 text-white font-bold shadow-xs ring-1 ring-white/10"
                        : "text-white/70 hover:text-white hover:bg-white/5 font-medium"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? "text-[#FF9E40]" : "text-white/70"
                      }`}
                    />
                    <span className="truncate flex-1">{item.name}</span>
                    {active && (
                      <span className="w-1.5 h-4 rounded-full bg-[#FF7803] shrink-0" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Drawer User Card */}
            <div className="pt-2 border-t border-white/10">
              <div className="p-2.5 rounded-2xl bg-black/25 flex items-center justify-between gap-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#4E1A8E] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-white truncate">
                      {displayName}
                    </div>
                    <div className="text-[10px] text-white/50 truncate">
                      {displayEmail}
                    </div>
                  </div>
                </div>
                <form action={signOutAction} className="shrink-0">
                  <button
                    type="submit"
                    title="Sign Out"
                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
