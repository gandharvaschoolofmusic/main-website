"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

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
      {/* Desktop Persistent Sidebar with Navbar matching color bg-primary */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-primary text-white h-full max-h-[calc(100vh-4rem)] p-4 space-y-2 shadow-xl z-40 select-none overflow-hidden">
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
                className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all active:scale-[0.98] ${
                  active
                    ? "bg-white/15 text-white font-bold shadow-xs"
                    : "text-white/70 hover:text-white hover:bg-white/5 font-medium"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? "text-white" : "text-white/60"
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

        {/* User Card at Bottom without any white line borders */}
        <div className="pt-2">
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

      {/* Mobile Horizontal Navigation Header */}
      <div className="md:hidden bg-primary text-white sticky top-16 z-40 shadow-md">
        <div className="flex items-center justify-between px-4 py-2.5">
          <Link href="/admin" className="flex items-center text-sm font-serif font-bold text-white tracking-wide">
            Gandharva
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-[#FF9E40]">
              Admin
            </span>
            <div className="w-6 h-6 rounded-full bg-[#4E1A8E] text-white flex items-center justify-center font-bold text-[10px]">
              {initials}
            </div>
          </div>
        </div>

        {/* Scrollable Tabs */}
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                onClick={() => setNavigatingTo(item.href)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                  active
                    ? "bg-white/15 text-white font-bold"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
