"use client";

import { useState } from "react";
import Image from "next/image";

const INSTRUCTORS = [
  {
    name: "Rohanel Max",
    subject: "Acoustic Guitar",
    cert: "Trinity Grade 8 Certification",
    exp: "Experience: 10+ Years",
    img: "/HomeSection6/Rohanel.jpg",
  },
  {
    name: "Devraj Pilai",
    subject: "Carnatic Classical",
    cert: "RSL Carnatic Grade 8 Certified",
    exp: "Experience: 20+ Years",
    img: "/HomeSection6/Devraj.jpg",
  },
  {
    name: "Nisha Iyer",
    subject: "Western Vocals",
    cert: "Western Vocal Certification",
    exp: "Experience: 15+ Years",
    img: "/HomeSection6/Nisha.jpg",
  },
  {
    name: "Kavya Mehta",
    subject: "Carnatic Vocals",
    cert: "RSL Carnatic Grade Certificate",
    exp: "Experience: 15+ Years",
    img: "/HomeSection6/kavya.jpg",
  },
  {
    name: "Sanvi Poul",
    subject: "Piano",
    cert: "Sr. Grade, Piano",
    exp: "Experience: 15+ Years",
    img: "/HomeSection6/Sanvi.jpg",
  },
];

export function InstructorsCarousel() {
  const [slideOffset, setSlideOffset] = useState(0);

  // Maximum offset: on desktop showing 3 cards at a time, max offset is INSTRUCTORS.length - 3
  const maxDesktopOffset = Math.max(0, INSTRUCTORS.length - 3);
  const maxMobileOffset = Math.max(0, INSTRUCTORS.length - 1);

  const desktopOffset = Math.min(slideOffset, maxDesktopOffset);
  const mobileOffset = Math.min(slideOffset, maxMobileOffset);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Desktop Multi-Card Slider */}
      <div className="hidden md:block w-full max-w-6xl overflow-hidden pb-8 px-4">
        <div
          className="flex transition-transform duration-500 ease-out gap-8"
          style={{ transform: `translateX(-${desktopOffset * (100 / 3 + 2.6)}%)` }}
        >
          {INSTRUCTORS.map((teacher, idx) => (
            <div
              key={`${teacher.name}-${idx}`}
              className="flex-none w-[calc(33.333%-1.35rem)] flex flex-col items-center pt-8"
            >
              {/* Overlapping Teacher Avatar */}
              <div className="relative z-20 w-32 h-32 rounded-2xl overflow-hidden border-0 shadow-xl bg-gray-100 -mb-16">
                <Image
                  src={teacher.img}
                  alt={teacher.name}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </div>

              {/* Card Container */}
              <div className="w-full pt-20 pb-8 px-6 bg-white rounded-2xl shadow-xl border-0 flex flex-col items-center text-center">
                <h3 className="font-medium text-2xl text-black custom-font-2 mb-1">
                  {teacher.name}
                </h3>
                <p className="text-base font-medium text-gray-600 mb-4 custom-font-2">
                  {teacher.subject}
                </p>
                <div className="text-sm font-semibold text-[#FF7703] pb-1">
                  {teacher.cert}
                </div>
                <div className="text-sm text-[#FF7703]">
                  {teacher.exp}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Single Card Slider */}
      <div className="md:hidden w-full max-w-xs overflow-hidden pb-6 px-2">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${mobileOffset * 100}%)` }}
        >
          {INSTRUCTORS.map((teacher, idx) => (
            <div
              key={`mobile-${teacher.name}-${idx}`}
              className="flex-none w-full flex flex-col items-center pt-6 px-2"
            >
              <div className="relative z-20 w-28 h-28 rounded-2xl overflow-hidden border-0 shadow-xl bg-gray-100 -mb-14">
                <Image
                  src={teacher.img}
                  alt={teacher.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div className="w-full pt-18 pb-6 px-4 bg-white rounded-2xl shadow-lg border-0 flex flex-col items-center text-center">
                <h3 className="font-medium text-xl text-black custom-font-2 mb-1">
                  {teacher.name}
                </h3>
                <p className="text-sm font-medium text-gray-600 mb-3 custom-font-2">
                  {teacher.subject}
                </p>
                <div className="text-xs font-semibold text-[#FF7703] pb-0.5">
                  {teacher.cert}
                </div>
                <div className="text-xs text-[#FF7703]">
                  {teacher.exp}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Dot Indicators */}
      <div className="hidden md:flex gap-3 justify-center items-center pt-2">
        {Array.from({ length: maxDesktopOffset + 1 }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setSlideOffset(idx)}
            aria-label={`Slide ${idx + 1}`}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              desktopOffset === idx
                ? "w-7 bg-[#FF7703] opacity-100"
                : "w-2.5 bg-black/25 hover:bg-black/50"
            }`}
          />
        ))}
      </div>

      {/* Mobile Dot Indicators */}
      <div className="flex md:hidden gap-2.5 justify-center items-center pt-2">
        {Array.from({ length: maxMobileOffset + 1 }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setSlideOffset(idx)}
            aria-label={`Slide ${idx + 1}`}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              mobileOffset === idx
                ? "w-6 bg-[#FF7703] opacity-100"
                : "w-2.5 bg-black/25 hover:bg-black/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
