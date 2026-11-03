"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { NavbarUser } from "@/components/layout/NavbarWrapper";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export interface LandingHeaderProps {
  user?: NavbarUser | null;
  signOutAction?: () => Promise<void>;
}

const INSTRUMENT_ITEMS = [
  { label: "Piano", href: "/courses/piano" },
  { label: "Electronic Keyboard", href: "/courses/electronic-keyboard" },
  { label: "Acoustic Guitar", href: "/courses/acoustic-guitar" },
  { label: "Electric Guitar", href: "/courses/electric-guitar" },
  { label: "Ukulele", href: "/courses/ukulele" },
  { label: "Violin", href: "/courses/violin" },
  { label: "Flute", href: "/courses/flute" },
  { label: "Tabla", href: "/courses/tabla" },
];

const VOCAL_ITEMS = [
  { label: "Western Vocals", href: "/courses/western-vocals" },
  { label: "Carnatic Vocals", href: "/courses/carnatic-vocals" },
  { label: "Hindustani Vocals", href: "/courses/hindustani-vocals" },
  { label: "Bollywood Vocals", href: "/courses/bollywood-vocals" },
  { label: "Kannada Music", href: "/courses/kannada-music" },
  { label: "Malayalam Music", href: "/courses/malayalam-music" },
  { label: "Tamil Music", href: "/courses/tamil-music" },
  { label: "Telugu Music", href: "/courses/telugu-music" },
];

const DANCE_ITEMS = [
  { label: "Bharatanatyam", href: "/courses/bharatanatyam" },
  { label: "Kathak", href: "/courses/kathak" },
  { label: "Bollywood Dance", href: "/courses/bollywood-dance" },
];

export function LandingHeader({ user, signOutAction }: LandingHeaderProps = {}) {
  const pathname = usePathname();
  const isFormPage = ["/login", "/signup", "/book-trial"].includes(pathname);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileCoursesOpen, setMobileCoursesOpen] = useState(false);
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [mobileSupportOpen, setMobileSupportOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    const handleClickOutside = () => {
      setActiveDropdown(null);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <header className="relative z-50">
      {/* Desktop Header */}
      <div
        className={`hidden lg:block fixed top-0 left-0 right-0 z-50 w-full h-20 py-2 transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none ${
          isFormPage
            ? "bg-primary shadow-sm"
            : isScrolled
              ? "bg-[#24105E]/95 backdrop-blur-md shadow-lg"
              : "bg-gradient-to-b from-[#1A022D]/90 via-[#1A022D]/50 to-transparent"
        }`}
        style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
      >
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center" aria-label="Gandharva School Of Music">
                <Image
                  src="/cropped-Add-a-subheading-5-png-scaled.webp"
                  alt="Gandharva School Of Music"
                  width={150}
                  height={50}
                  className="h-10 xl:h-12 w-auto object-contain"
                  priority
                />
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="flex-1 flex justify-center text-white text-[13px] xl:text-[15px] px-2 xl:px-4 min-w-0">
              <ul className="flex items-center space-x-1 xl:space-x-3 whitespace-nowrap">
                {/* Courses Mega Dropdown */}
                <li
                  id="nav-courses-trigger"
                  className={`relative group px-2.5 xl:px-3 py-2 rounded-t-lg cursor-pointer transition-colors duration-150 ${
                    activeDropdown === "courses" ? "text-black bg-white" : "hover:text-black hover:bg-white"
                  }`}
                  onMouseEnter={() => setActiveDropdown("courses")}
                  onMouseLeave={() => setActiveDropdown(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === "courses" ? null : "courses");
                  }}
                >
                  <p className="flex items-center gap-1 font-medium whitespace-nowrap">
                    Courses
                    <svg
                      stroke="currentColor"
                      fill="currentColor"
                      strokeWidth="0"
                      viewBox="0 0 448 512"
                      className={`w-3 h-3 transition-transform duration-200 ${
                        activeDropdown === "courses" ? "rotate-180" : "group-hover:rotate-180"
                      }`}
                    >
                      <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
                    </svg>
                  </p>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute left-0 top-full pt-1 z-50 transition-all duration-200 ${
                      activeDropdown === "courses"
                        ? "opacity-100 visible pointer-events-auto"
                        : "opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto"
                    }`}
                  >
                    <div className="bg-white text-black rounded-2xl shadow-2xl grid grid-cols-3 p-4 xl:p-5 gap-3 xl:gap-4 border border-gray-100 w-[520px] xl:w-[560px] max-w-[calc(100vw-2rem)]">
                      <div>
                        <Link href="/courses" className="block px-3 py-1.5 font-bold text-[13px] text-[#24105E] hover:text-[#FF7703] border-b border-gray-100 mb-1 tracking-wider uppercase transition-colors">
                          INSTRUMENTS
                        </Link>
                        <ul className="space-y-0.5">
                          {INSTRUMENT_ITEMS.map((item) => (
                            <li key={item.label}>
                              <Link
                                href={item.href}
                                className="block px-3 py-1 text-[13px] text-gray-700 hover:text-[#24105E] hover:font-semibold hover:bg-[#D8D1E8]/50 rounded-md transition-colors whitespace-nowrap"
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <Link href="/courses" className="block px-3 py-1.5 font-bold text-[13px] text-[#24105E] hover:text-[#FF7703] border-b border-gray-100 mb-1 tracking-wider uppercase transition-colors">
                          SINGING
                        </Link>
                        <ul className="space-y-0.5">
                          {VOCAL_ITEMS.map((item) => (
                            <li key={item.label}>
                              <Link
                                href={item.href}
                                className="block px-3 py-1 text-[13px] text-gray-700 hover:text-[#24105E] hover:font-semibold hover:bg-[#D8D1E8]/50 rounded-md transition-colors whitespace-nowrap"
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <Link href="/courses" className="block px-3 py-1.5 font-bold text-[13px] text-[#24105E] hover:text-[#FF7703] border-b border-gray-100 mb-1 tracking-wider uppercase transition-colors">
                          DANCING
                        </Link>
                        <ul className="space-y-0.5">
                          {DANCE_ITEMS.map((item) => (
                            <li key={item.label}>
                              <Link
                                href={item.href}
                                className="block px-3 py-1 text-[13px] text-gray-700 hover:text-[#24105E] hover:font-semibold hover:bg-[#D8D1E8]/50 rounded-md transition-colors whitespace-nowrap"
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </li>

                {/* About Dropdown */}
                <li
                  id="nav-about-trigger"
                  className={`relative group px-2.5 xl:px-3 py-2 rounded-t-lg cursor-pointer transition-colors duration-150 ${
                    activeDropdown === "about" ? "text-black bg-white" : "hover:text-black hover:bg-white"
                  }`}
                  onMouseEnter={() => setActiveDropdown("about")}
                  onMouseLeave={() => setActiveDropdown(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === "about" ? null : "about");
                  }}
                >
                  <p className="flex items-center gap-1 font-medium whitespace-nowrap">
                    About
                    <svg
                      stroke="currentColor"
                      fill="currentColor"
                      viewBox="0 0 448 512"
                      className={`w-3 h-3 transition-transform duration-200 ${
                        activeDropdown === "about" ? "rotate-180" : "group-hover:rotate-180"
                      }`}
                    >
                      <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
                    </svg>
                  </p>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute left-0 top-full pt-1 z-50 transition-all duration-200 ${
                      activeDropdown === "about"
                        ? "opacity-100 visible pointer-events-auto"
                        : "opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto"
                    }`}
                  >
                    <ul className="w-44 bg-white text-black rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1">
                      <li>
                        <Link href="/company" className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#D8D1E8] hover:text-black hover:font-semibold transition-colors whitespace-nowrap">
                          Company
                        </Link>
                      </li>
                      <li>
                        <Link href="/policy" className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#D8D1E8] hover:text-black hover:font-semibold transition-colors whitespace-nowrap">
                          Policy
                        </Link>
                      </li>
                    </ul>
                  </div>
                </li>

                {/* Resources Dropdown */}
                <li
                  id="nav-resources-trigger"
                  className={`relative group px-2.5 xl:px-3 py-2 rounded-t-lg cursor-pointer transition-colors duration-150 ${
                    activeDropdown === "resources" ? "text-black bg-white" : "hover:text-black hover:bg-white"
                  }`}
                  onMouseEnter={() => setActiveDropdown("resources")}
                  onMouseLeave={() => setActiveDropdown(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === "resources" ? null : "resources");
                  }}
                >
                  <p className="flex items-center gap-1 font-medium whitespace-nowrap">
                    Resources
                    <svg
                      stroke="currentColor"
                      fill="currentColor"
                      viewBox="0 0 448 512"
                      className={`w-3 h-3 transition-transform duration-200 ${
                        activeDropdown === "resources" ? "rotate-180" : "group-hover:rotate-180"
                      }`}
                    >
                      <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
                    </svg>
                  </p>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute left-0 top-full pt-1 z-50 transition-all duration-200 ${
                      activeDropdown === "resources"
                        ? "opacity-100 visible pointer-events-auto"
                        : "opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto"
                    }`}
                  >
                    <ul className="w-44 bg-white text-black rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1">
                      <li>
                        <Link href="/blog" className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#D8D1E8] hover:text-black hover:font-semibold transition-colors whitespace-nowrap">
                          Blog
                        </Link>
                      </li>
                      <li>
                        <Link href="/tools" className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#D8D1E8] hover:text-black hover:font-semibold transition-colors whitespace-nowrap">
                          Tools
                        </Link>
                      </li>
                    </ul>
                  </div>
                </li>

                {/* Support Dropdown */}
                <li
                  id="nav-support-trigger"
                  className={`relative group px-2.5 xl:px-3 py-2 rounded-t-lg cursor-pointer transition-colors duration-150 ${
                    activeDropdown === "support" ? "text-black bg-white" : "hover:text-black hover:bg-white"
                  }`}
                  onMouseEnter={() => setActiveDropdown("support")}
                  onMouseLeave={() => setActiveDropdown(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === "support" ? null : "support");
                  }}
                >
                  <p className="flex items-center gap-1 font-medium whitespace-nowrap">
                    Support
                    <svg
                      stroke="currentColor"
                      fill="currentColor"
                      viewBox="0 0 448 512"
                      className={`w-3 h-3 transition-transform duration-200 ${
                        activeDropdown === "support" ? "rotate-180" : "group-hover:rotate-180"
                      }`}
                    >
                      <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
                    </svg>
                  </p>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute left-0 top-full pt-1 z-50 transition-all duration-200 ${
                      activeDropdown === "support"
                        ? "opacity-100 visible pointer-events-auto"
                        : "opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto"
                    }`}
                  >
                    <ul className="w-44 bg-white text-black rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1">
                      <li>
                        <Link href="/faq" className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#D8D1E8] hover:text-black hover:font-semibold transition-colors whitespace-nowrap">
                          FAQ
                        </Link>
                      </li>
                      <li>
                        <Link href="/contact-us" className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#D8D1E8] hover:text-black hover:font-semibold transition-colors whitespace-nowrap">
                          Contact Us
                        </Link>
                      </li>
                    </ul>
                  </div>
                </li>

                {/* Direct Links */}
                <li>
                  <Link
                    href="/teach-with-us"
                    className="px-2.5 xl:px-3 py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-all font-medium whitespace-nowrap inline-block text-[13px] xl:text-[15px]"
                  >
                    Teach With Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/become-our-affiliate"
                    className="px-2.5 xl:px-3 py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-all font-medium whitespace-nowrap inline-block text-[13px] xl:text-[15px]"
                  >
                    Become Our Affiliate
                  </Link>
                </li>
              </ul>
            </nav>

            {/* CTAs / User Profile */}
            <div className="flex-shrink-0 flex items-center gap-2 xl:gap-3">
              {user ? (
                <div className="flex items-center gap-2 xl:gap-3">
                  {/* Notification Bell */}
                  <NotificationBell userRole={user.role} />

                  {/* Dashboard link button */}
                  <Link
                    href={
                      user.role === "ADMIN"
                        ? "/admin"
                        : user.role === "TEACHER"
                        ? "/teacher/dashboard"
                        : "/student/dashboard"
                    }
                    className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 pl-2 pr-3 py-1 sm:py-1.5 text-xs xl:text-sm font-semibold text-white transition-all btn-tactile whitespace-nowrap active:scale-95"
                  >
                    {user.image ? (
                      <div className="relative w-5 h-5 xl:w-6 xl:h-6 rounded-full overflow-hidden shrink-0">
                        <Image
                          src={user.image}
                          alt={user.name || "Profile"}
                          fill
                          sizes="24px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-5 h-5 xl:w-6 xl:h-6 rounded-full bg-accent/30 text-accent font-bold text-[10px] flex items-center justify-center shrink-0">
                        {user.name?.slice(0, 1).toUpperCase() || "U"}
                      </div>
                    )}
                    <span>Dashboard</span>
                  </Link>

                  {/* Sign Out Button */}
                  {signOutAction && (
                    <form action={signOutAction}>
                      <button
                        type="submit"
                        className="rounded-lg px-2 xl:px-2.5 py-1 text-xs xl:text-sm text-white/80 transition-all hover:text-white hover:bg-white/10 btn-tactile whitespace-nowrap active:scale-95 cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-white hover:text-white/80 text-xs xl:text-sm font-semibold px-2.5 py-1.5 transition-colors whitespace-nowrap"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/book-trial"
                    id="nav-book-trial-cta"
                    className="inline-flex items-center justify-center px-3.5 xl:px-4 py-2 rounded-lg shadow-sm text-xs xl:text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all btn-tactile whitespace-nowrap"
                  >
                    Book a free trial
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header Bar */}
      <div
        className={`lg:hidden fixed w-full h-20 z-50 top-0 transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none ${
          isFormPage ? "bg-primary shadow-sm" : isScrolled ? "bg-[#24105E]/95 backdrop-blur-md shadow-md" : "bg-transparent"
        }`}
      >
        <div className="flex h-full justify-between items-center px-4 pr-6">
          <div className="flex-shrink-0">
            <Link href="/" aria-label="Gandharva School Of Music">
              <Image
                src="/cropped-Add-a-subheading-5-png-scaled.webp"
                alt="Gandharva School Of Music"
                width={120}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="flex items-center gap-1.5 mr-1">
                <NotificationBell userRole={user.role} />
                <Link
                  href={
                    user.role === "ADMIN"
                      ? "/admin"
                      : user.role === "TEACHER"
                      ? "/teacher/dashboard"
                      : "/student/dashboard"
                  }
                  className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-xs overflow-hidden"
                  aria-label="Dashboard"
                >
                  {user.image ? (
                    <div className="relative w-full h-full rounded-full overflow-hidden">
                      <Image src={user.image} alt={user.name || "Profile"} fill sizes="32px" className="object-cover" />
                    </div>
                  ) : (
                    user.name?.slice(0, 1).toUpperCase() || "U"
                  )}
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Menu"
              className="text-white p-1 focus:outline-none"
            >
              <svg stroke="currentColor" fill="currentColor" viewBox="0 0 512 512" className="w-7 h-7">
                <path d="M32 96v64h448V96H32zm0 128v64h448v-64H32zm0 128v64h448v-64H32z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Content */}
      <div
        className={`lg:hidden fixed top-0 right-0 h-full w-4/5 max-w-sm bg-white pr-4 text-black z-50 transform transition-transform duration-300 ease-in-out shadow-2xl overflow-y-auto ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex justify-end items-center p-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-[#FF7703] hover:opacity-80"
            aria-label="Close Menu"
          >
            <svg stroke="currentColor" fill="currentColor" viewBox="0 0 512 512" className="w-7 h-7">
              <path d="m289.94 256 95-95A24 24 0 0 0 351 127l-95 95-95-95a24 24 0 0 0-34 34l95 95-95 95a24 24 0 1 0 34 34l95-95 95 95a24 24 0 0 0 34-34z" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col p-4 space-y-4 font-medium text-[#24105E]">
          {/* Courses Accordion */}
          <div>
            <button
              type="button"
              onClick={() => setMobileCoursesOpen(!mobileCoursesOpen)}
              className="flex justify-between items-center w-full text-base font-semibold"
            >
              Courses
              <svg
                stroke="currentColor"
                fill="currentColor"
                viewBox="0 0 448 512"
                className={`w-3.5 h-3.5 transition-transform ${mobileCoursesOpen ? "rotate-180" : ""}`}
              >
                <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
              </svg>
            </button>
            {mobileCoursesOpen && (
              <div className="pl-3 pt-2 space-y-3 text-sm text-gray-700">
                <div>
                  <p className="font-bold text-[#FF7703] text-xs uppercase tracking-wider mb-1">Instruments</p>
                  <div className="space-y-1 pl-2 border-l border-gray-200">
                    {INSTRUMENT_ITEMS.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-1 hover:text-[#24105E]"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-bold text-[#FF7703] text-xs uppercase tracking-wider mb-1">Singing</p>
                  <div className="space-y-1 pl-2 border-l border-gray-200">
                    {VOCAL_ITEMS.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-1 hover:text-[#24105E]"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-bold text-[#FF7703] text-xs uppercase tracking-wider mb-1">Dancing</p>
                  <div className="space-y-1 pl-2 border-l border-gray-200">
                    {DANCE_ITEMS.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-1 hover:text-[#24105E]"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* About Accordion */}
          <div>
            <button
              type="button"
              onClick={() => setMobileAboutOpen(!mobileAboutOpen)}
              className="flex justify-between items-center w-full text-base font-semibold"
            >
              About
              <svg
                stroke="currentColor"
                fill="currentColor"
                viewBox="0 0 448 512"
                className={`w-3.5 h-3.5 transition-transform ${mobileAboutOpen ? "rotate-180" : ""}`}
              >
                <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
              </svg>
            </button>
            {mobileAboutOpen && (
              <div className="pl-4 pt-2 space-y-1.5 text-sm text-gray-700">
                <Link href="/company" onClick={() => setMobileMenuOpen(false)} className="block py-1">
                  Company
                </Link>
                <Link href="/policy" onClick={() => setMobileMenuOpen(false)} className="block py-1">
                  Policy
                </Link>
              </div>
            )}
          </div>

          {/* Resources Accordion */}
          <div>
            <button
              type="button"
              onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
              className="flex justify-between items-center w-full text-base font-semibold"
            >
              Resources
              <svg
                stroke="currentColor"
                fill="currentColor"
                viewBox="0 0 448 512"
                className={`w-3.5 h-3.5 transition-transform ${mobileResourcesOpen ? "rotate-180" : ""}`}
              >
                <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
              </svg>
            </button>
            {mobileResourcesOpen && (
              <div className="pl-4 pt-2 space-y-1.5 text-sm text-gray-700">
                <Link href="/blog" onClick={() => setMobileMenuOpen(false)} className="block py-1">
                  Blog
                </Link>
                <Link href="/tools" onClick={() => setMobileMenuOpen(false)} className="block py-1">
                  Tools
                </Link>
              </div>
            )}
          </div>

          {/* Support Accordion */}
          <div>
            <button
              type="button"
              onClick={() => setMobileSupportOpen(!mobileSupportOpen)}
              className="flex justify-between items-center w-full text-base font-semibold"
            >
              Support
              <svg
                stroke="currentColor"
                fill="currentColor"
                viewBox="0 0 448 512"
                className={`w-3.5 h-3.5 transition-transform ${mobileSupportOpen ? "rotate-180" : ""}`}
              >
                <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
              </svg>
            </button>
            {mobileSupportOpen && (
              <div className="pl-4 pt-2 space-y-1.5 text-sm text-gray-700">
                <Link href="/faq" onClick={() => setMobileMenuOpen(false)} className="block py-1">
                  FAQ
                </Link>
                <Link href="/contact-us" onClick={() => setMobileMenuOpen(false)} className="block py-1">
                  Contact Us
                </Link>
              </div>
            )}
          </div>

          {/* Direct Links */}
          <Link
            href="/teach-with-us"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1 font-semibold hover:text-[#FF7703]"
          >
            Teach With Us
          </Link>
          <Link
            href="/become-our-affiliate"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1 font-semibold hover:text-[#FF7703]"
          >
            Become Our Affiliate
          </Link>
          {user ? (
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <Link
                href={
                  user.role === "ADMIN"
                    ? "/admin"
                    : user.role === "TEACHER"
                    ? "/teacher/dashboard"
                    : "/student/dashboard"
                }
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-purple-50 text-purple-900 font-bold text-sm"
              >
                <div className="flex items-center gap-2">
                  {user.image ? (
                    <div className="relative w-6 h-6 rounded-full overflow-hidden border border-purple-300">
                      <Image src={user.image} alt={user.name || "Profile"} fill sizes="24px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-purple-200 text-purple-900 font-bold text-xs flex items-center justify-center">
                      {user.name?.slice(0, 1).toUpperCase() || "U"}
                    </div>
                  )}
                  <span>Go to Dashboard</span>
                </div>
                <span className="text-xs text-purple-700">→</span>
              </Link>
              {signOutAction && (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full text-left py-2 px-3 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                  >
                    Sign Out ({user.name || user.email})
                  </button>
                </form>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1 font-semibold text-purple-700 hover:text-purple-900"
            >
              Sign In
            </Link>
          )}
        </nav>

        {/* Mobile Trial Button */}
        {(!user || user.role === "STUDENT") && (
          <div className="p-4 pt-2">
            <Link
              href="/book-trial"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full bg-[#9506EE] hover:bg-[#8200DA] text-center text-white text-sm font-bold py-3 px-4 rounded-lg shadow-md transition-all btn-tactile"
            >
              Book a Free Trial
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
