"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck,
  Calendar,
  Users,
  Clock,
  CircleDollarSign,
  HelpCircle,
  UserCheck,
  MessageSquare,
  FolderArchive,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const navItems: NavItem[] = [
  {
    name: "Upcoming Sessions",
    href: "/teacher/dashboard",
    icon: CalendarCheck,
    exact: true,
  },
  {
    name: "Studio Calendar",
    href: "/teacher/dashboard/calendar",
    icon: Calendar,
  },
  {
    name: "My Students",
    href: "/teacher/dashboard/students",
    icon: Users,
  },
  {
    name: "Learning Resources",
    href: "/teacher/dashboard/resources",
    icon: FolderArchive,
  },
  {
    name: "Messages",
    href: "/teacher/dashboard/messages",
    icon: MessageSquare,
  },
  {
    name: "Availability & Schedule",
    href: "/teacher/dashboard/availability",
    icon: Clock,
  },
  {
    name: "Payment Management",
    href: "/teacher/dashboard/earnings",
    icon: CircleDollarSign,
  },
  {
    name: "Help & Support",
    href: "/teacher/dashboard/support",
    icon: HelpCircle,
  },
  {
    name: "Profile & Settings",
    href: "/teacher/dashboard/profile",
    icon: UserCheck,
  },
];

export function TeacherSidebar({
  teacherName,
  teacherEmail,
  teacherImage,
}: {
  teacherName?: string;
  teacherEmail?: string;
  teacherImage?: string | null;
}) {
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

  return (
    <>
      {/* Desktop Persistent 256px Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-white shrink-0 sticky top-16 h-[calc(100vh-4rem)] p-4 justify-between shadow-md select-none overflow-hidden">
        <div className="flex flex-col h-full overflow-hidden space-y-4">
          {/* Faculty Brand Mini-Header */}
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
              Faculty
            </span>
          </div>

          <nav className="space-y-1 flex-1 overflow-y-auto pr-1 text-xs sidebar-scroll">
            {navItems.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onClick={() => setNavigatingTo(item.href)}
                  className={`btn-tactile flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group active:scale-[0.98] ${
                    active
                      ? "bg-white/15 text-white font-bold shadow-xs"
                      : "text-white/75 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 transition-colors shrink-0 ${
                        active
                          ? "text-white"
                          : "text-white/60 group-hover:text-white"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {active && (
                    <span className="w-1.5 h-3.5 rounded-full bg-[#FF7803] shrink-0" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2.5 pt-2 shrink-0">
            {/* Faculty Profile Card */}
            <Link
              href="/teacher/dashboard/profile"
              className="btn-tactile p-2.5 bg-black/25 hover:bg-black/35 rounded-2xl flex items-center gap-2.5 transition-all group cursor-pointer shadow-2xs"
              title="Manage Faculty Profile & Photo"
            >
              {teacherImage ? (
                <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-xs">
                  <Image
                    src={teacherImage}
                    alt={teacherName || "Faculty"}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#4E1A8E] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-inner">
                  {teacherName?.slice(0, 2).toUpperCase() || "FC"}
                </div>
              )}
              <div className="overflow-hidden min-w-0 flex-1">
                <div className="text-xs font-bold text-white group-hover:text-[#FF9E40] transition-colors truncate">
                  {teacherName || "Faculty Studio"}
                </div>
                <div className="text-[10px] text-white/60 truncate">
                  {teacherEmail || "Edit Profile & Photo"}
                </div>
              </div>
            </Link>

            {/* Quick Help Footer */}
            <div className="p-2.5 rounded-xl bg-black/20 space-y-0.5">
              <p className="text-[11px] font-bold text-white">Gandharva Faculty</p>
              <p className="text-[10px] text-white/60 leading-relaxed">
                Institutional flat session payout model. For schedule questions, contact administration.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Horizontal Navigation Tabs (375px+ responsive) */}
      <div className="md:hidden sticky top-16 z-30 bg-primary text-white backdrop-blur-md px-3 py-2 overflow-x-auto no-scrollbar flex gap-1.5 shadow-md">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={() => setNavigatingTo(item.href)}
              className={`btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? "bg-white/20 text-white shadow-xs font-bold"
                  : "text-white/70 hover:text-white bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
