"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

const SLIDES = [
  {
    id: 1,
    desktopImg: "/HomeSection1/1.webp",
    mobileImg: "/HomeSection1/mobile-1.webp",
    heading: (
      <>
        Most Affordable <br />
        Live 1:1 Online Music & Dance Classes <br />
        For Kids & Adults
      </>
    ),
    content: (
      <div className="flex gap-4 pt-2">
        <Link
          href="/courses"
          className="text-[14px] text-black bg-white hover:bg-gray-100 py-3 px-5 rounded-sm font-medium transition-all shadow-md btn-tactile"
        >
          Explore our courses
        </Link>
        <Link
          href="/book-trial"
          className="text-[14px] text-white bg-[#9506EE] hover:bg-[#8200DA] py-3 px-5 rounded-sm font-medium transition-all shadow-md shadow-purple-900/30 btn-tactile"
        >
          Book a free trial
        </Link>
      </div>
    ),
  },
  {
    id: 2,
    desktopImg: "/HomeSection1/2.webp",
    mobileImg: "/HomeSection1/mobile-2.webp",
    icons: [
      "/HomeSection1/certificationIcons/1.webp",
      "/HomeSection1/certificationIcons/2.webp",
      "/HomeSection1/certificationIcons/3.webp",
      "/HomeSection1/certificationIcons/4.webp",
      "/HomeSection1/certificationIcons/5.webp",
    ],
    heading: <>Graded Music Certifications</>,
    content: (
      <div className="text-[16px] md:text-[17px] text-white leading-relaxed space-y-1">
        <p className="flex items-center gap-2 font-light">
          <span className="text-[#FF7703] font-bold">•</span> Globally Accredited
        </p>
        <p className="flex items-center gap-2 font-light">
          <span className="text-[#FF7703] font-bold">•</span> Key Milestones on Your Musical Journey, From Beginner to Expert
        </p>
        <p className="flex items-center gap-2 font-light">
          <span className="text-[#FF7703] font-bold">•</span> Welcoming All Ages, No Restrictions
        </p>
      </div>
    ),
  },
  {
    id: 3,
    desktopImg: "/HomeSection1/3.webp",
    mobileImg: "/HomeSection1/mobile-3.webp",
    heading: (
      <>
        Adaptive Learning <br />
        On Gandharva&apos;s Digital Platform
      </>
    ),
    content: (
      <div className="text-[16px] md:text-[17px] text-white leading-relaxed space-y-1">
        <p className="flex items-center gap-2 font-light">
          <span className="text-[#FF7703] font-bold">•</span> Learn at your own pace
        </p>
        <p className="flex items-center gap-2 font-light">
          <span className="text-[#FF7703] font-bold">•</span> Making learning engaging & fun
        </p>
      </div>
    ),
  },
  {
    id: 4,
    desktopImg: "/HomeSection1/4.webp",
    mobileImg: "/HomeSection1/mobile-4.webp",
    heading: (
      <>
        Gandharva Idol: Showcase Your Talent and Compete with Aspiring Musicians Worldwide!
      </>
    ),
    content: (
      <div className="text-[16px] md:text-[17px] text-white leading-relaxed space-y-1">
        <p className="flex items-center gap-2 font-light">
          <span className="text-[#FF7703] font-bold">•</span> World Stage at Your Fingertips
        </p>
        <p className="flex items-center gap-2 font-light">
          <span className="text-[#FF7703] font-bold">•</span> Participants from 6+ Countries
        </p>
        <p className="flex items-center gap-2 font-light">
          <span className="text-[#FF7703] font-bold">•</span> Over 150 Participants in Our Inaugural Edition!
        </p>
      </div>
    ),
  },
  {
    id: 5,
    desktopImg: "/HomeSection1/5.webp",
    mobileImg: "/HomeSection1/mobile-5.webp",
    heading: <>Tailored Learning on Gandharva&apos;s Digital Platform</>,
    content: (
      <div className="pt-2">
        <Link
          href="/book-trial"
          className="text-[14px] text-white bg-[#9506EE] hover:bg-[#8200DA] py-3 px-6 rounded-sm font-medium transition-all shadow-md shadow-purple-900/30 btn-tactile inline-block"
        >
          Book a free trial
        </Link>
      </div>
    ),
  },
];

export function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  return (
    <section className="w-full h-[90vh] md:h-[100vh] bg-black/80 relative overflow-hidden select-none">
      {/* Slides Container */}
      <div
        className="flex h-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            className="relative text-white flex-none w-full h-full flex flex-col justify-center px-6 md:px-12 lg:px-24"
          >
            {/* Background Images with subtle dark overlay */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
              <div className="hidden sm:block relative h-full w-full">
                <Image
                  src={slide.desktopImg}
                  alt={`Slide ${slide.id}`}
                  fill
                  sizes="(min-width: 640px) 100vw, 1px"
                  priority={idx === 0}
                  className="object-cover"
                />
              </div>
              <div className="sm:hidden relative h-full w-full">
                <Image
                  src={slide.mobileImg}
                  alt={`Slide ${slide.id}`}
                  fill
                  sizes="(max-width: 640px) 100vw, 1px"
                  priority={idx === 0}
                  className="object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-black/45 backdrop-brightness-95" />
            </div>

            {/* Slide Content */}
            <div className="relative z-20 max-w-4xl space-y-4 md:space-y-6 pt-16 md:pt-20">
              {/* Optional Certification Badges */}
              {slide.icons && (
                <div className="flex flex-row gap-3 md:gap-5 pb-2">
                  {slide.icons.map((icon, iconIdx) => (
                    <div
                      key={iconIdx}
                      className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-white/10 backdrop-blur-xs p-1.5 flex items-center justify-center border-0 shadow-md"
                    >
                      <Image
                        src={icon}
                        alt="Certification"
                        width={60}
                        height={60}
                        className="object-contain w-full h-full"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1
                className="text-[32px] sm:text-[42px] md:text-[54px] text-white custom-font-2 leading-tight tracking-tight drop-shadow-md max-w-3xl"
                style={{ fontWeight: 500 }}
              >
                {slide.heading}
              </h1>

              {/* Body / CTAs */}
              <div className="pt-1 font-sans">{slide.content}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Bubble Dots */}
      <div className="absolute bottom-8 md:bottom-12 flex gap-2.5 w-full justify-center z-30">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrentSlide(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              currentSlide === idx
                ? "w-8 bg-[#FF7703] opacity-100 shadow-sm"
                : "w-2.5 bg-white opacity-40 hover:opacity-75"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
