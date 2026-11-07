"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

type CourseItem = {
  name: string;
  cardImg: string;
  bgImg: string;
  description: string;
};

const INSTRUMENT_COURSES: CourseItem[] = [
  {
    name: "Piano",
    cardImg: "/HomeSection4/cards/piano.webp",
    bgImg: "/HomeSection4/backgrounds/piano.webp",
    description:
      "From Western Classical to Pop Hits, our courses empower your child to play all their favorite tunes! With guidance from our expert teachers, students can also achieve international certifications. Enroll today and witness your child's transformation into a confident musician!",
  },
  {
    name: "Acoustic Guitar",
    cardImg: "/HomeSection4/cards/acoustic%20guitar.webp",
    bgImg: "/HomeSection4/backgrounds/acoustic%20guitar.webp",
    description:
      "Master essential chords, rhythmic strumming patterns, fingerstyle technique, and sight-reading with experienced guitar faculty. Tailored for beginners through advanced performers.",
  },
  {
    name: "Electric Guitar",
    cardImg: "/HomeSection4/cards/electric%20guitar.webp",
    bgImg: "/HomeSection4/backgrounds/electric%20guitar.webp",
    description:
      "Explore rock, jazz, blues, and metal improvisation. Dive into tone shaping, overdrive dynamics, lead soloing, and pentatonic mastery in private 1:1 sessions.",
  },
  {
    name: "Violin",
    cardImg: "/HomeSection4/cards/violin.webp",
    bgImg: "/HomeSection4/backgrounds/violin.webp",
    description:
      "Develop exquisite tone purity, precise intonation, bowing mechanics, and posture. Covering both classical Western and Indian Carnatic violin repertoires.",
  },
  {
    name: "Tabla",
    cardImg: "/HomeSection4/cards/tabla.webp",
    bgImg: "/HomeSection4/backgrounds/tabla.webp",
    description:
      "Discover the rhythm foundations of Indian music. Learn Taals, Bols, Kaidas, and Peshkar from maestros to accompany vocal and instrumental performances.",
  },
];

const SINGING_COURSES: CourseItem[] = [
  {
    name: "Western Vocals",
    cardImg: "/HomeSection4/cards/western%20vocals.webp",
    bgImg: "/HomeSection4/backgrounds/western%20vocals.webp",
    description:
      "Unlock your genuine vocal range with breath control, pitch accuracy, belting, falsetto, and contemporary styling for pop, jazz, and musical theater.",
  },
  {
    name: "Carnatic Vocals",
    cardImg: "/HomeSection4/cards/carnatic%20vocals.webp",
    bgImg: "/HomeSection4/backgrounds/carnatic%20vocals.webp",
    description:
      "Immerse in timeless South Indian classical traditions. Learn Sarali Varisais, Alankarams, Varnams, and Kritis with authentic Shruti alignment.",
  },
  {
    name: "Hindustani Vocals",
    cardImg: "/HomeSection4/cards/hindustani%20vocals.webp",
    bgImg: "/HomeSection4/backgrounds/hindustani%20vocals.webp",
    description:
      "Build resonant classical phrasing through Bandishes, Swara exercises, and Ragas with proper voice projection and emotional nuance.",
  },
  {
    name: "Bollywood Vocals",
    cardImg: "/HomeSection4/cards/bollywood%20vocals.webp",
    bgImg: "/HomeSection4/backgrounds/bollywood%20vocals.webp",
    description:
      "Sing iconic Bollywood melodies with industry-ready playback microphone techniques, expressive ornamentation, and versatile stylistic delivery.",
  },
];

const DANCE_COURSES: CourseItem[] = [
  {
    name: "Bharatanatyam",
    cardImg: "/HomeSection4/cards/bharatanatyam.webp",
    bgImg: "/HomeSection4/backgrounds/bharatanatyam.webp",
    description:
      "Graceful storytelling through Natya, intricate footwork (Adavus), expressive eye movements (Abhinaya), and sacred hand gestures (Mudras).",
  },
  {
    name: "Kathak",
    cardImg: "/HomeSection4/cards/kathak.webp",
    bgImg: "/HomeSection4/backgrounds/kathak.webp",
    description:
      "Master swift spins (Chakkars), rhythmic Ghungroo footwork (Tatkar), and poetic storytelling of North Indian classical Kathak.",
  },
  {
    name: "Bollywood Dance",
    cardImg: "/HomeSection4/cards/bollywood%20dance.webp",
    bgImg: "/HomeSection4/backgrounds/bollywood%20dance.webp",
    description:
      "High-energy choreography combining modern film dance, hip-hop, folk, and Indian classical steps for stage confidence and joyful fitness.",
  },
];

type Category = "instruments" | "singing" | "dancing";

export function CourseShowcase() {
  const [activeCategory, setActiveCategory] = useState<Category>("instruments");
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(0);

  const currentList =
    activeCategory === "instruments"
      ? INSTRUMENT_COURSES
      : activeCategory === "singing"
      ? SINGING_COURSES
      : DANCE_COURSES;

  const currentCourse =
    currentList[selectedCourseIndex] ||
    currentList[0] ||
    INSTRUMENT_COURSES[0];

  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
    setSelectedCourseIndex(0);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Category Tab Selector */}
      <div className="w-full bg-[#FCCEE8]/60 flex flex-row justify-between items-center rounded-xl p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => handleCategoryChange("instruments")}
          aria-label="Select Instruments"
          className={`py-4 md:py-5 w-full text-center font-semibold text-sm md:text-base rounded-lg transition-all ${
            activeCategory === "instruments"
              ? "text-[#FF7703] bg-white shadow-md"
              : "text-black hover:text-[#FF7703] hover:bg-white/50"
          }`}
        >
          Instruments
        </button>
        <button
          type="button"
          onClick={() => handleCategoryChange("singing")}
          aria-label="Select Singing"
          className={`py-4 md:py-5 w-full text-center font-semibold text-sm md:text-base rounded-lg transition-all ${
            activeCategory === "singing"
              ? "text-[#FF7703] bg-white shadow-md"
              : "text-black hover:text-[#FF7703] hover:bg-white/50"
          }`}
        >
          Singing
        </button>
        <button
          type="button"
          onClick={() => handleCategoryChange("dancing")}
          aria-label="Select Dancing"
          className={`py-4 md:py-5 w-full text-center font-semibold text-sm md:text-base rounded-lg transition-all ${
            activeCategory === "dancing"
              ? "text-[#FF7703] bg-white shadow-md"
              : "text-black hover:text-[#FF7703] hover:bg-white/50"
          }`}
        >
          Dancing
        </button>
      </div>

      {/* Interactive Spotlight Hero Card */}
      <div className="relative text-white rounded-2xl overflow-hidden min-h-[46rem] md:min-h-[48rem] shadow-2xl bg-[#0C041C]">
        {/* Full-bleed Authentic Background Image */}
        <div className="absolute inset-0 z-10 overflow-hidden">
          <Image
            key={currentCourse?.bgImg || "fallback"}
            src={currentCourse?.bgImg || "/HomeSection4/backgrounds/piano.webp"}
            alt={currentCourse?.name || "Music Course"}
            fill
            sizes="100vw"
            priority
            className="object-cover transition-opacity duration-700 opacity-90 scale-100"
          />
          {/* Subtle directional gradient overlay to guarantee text legibility without darkening the artwork */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />
        </div>

        {/* Content Container */}
        <div className="relative z-20 h-full w-full px-6 sm:px-10 md:px-16 lg:px-24 pt-20 md:pt-28 pb-16 flex flex-col justify-between">
          {/* Top text block */}
          <div className="space-y-6 max-w-2xl">
            <h3 className="text-3xl md:text-5xl font-medium custom-font-2 tracking-wide text-white drop-shadow-md">
              {currentCourse?.name || "Music Course"}
            </h3>
            <p className="text-white/95 text-base md:text-lg leading-relaxed font-light drop-shadow-sm">
              {currentCourse?.description || "Explore personalized 1-on-1 online music and dance lessons."}
            </p>
            <div>
              <Link
                href="/courses"
                className="inline-block px-8 py-3.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm md:text-base transition-all shadow-lg shadow-purple-900/50 btn-tactile"
              >
                See Courses
              </Link>
            </div>
          </div>

          {/* Bottom Thumbnails Strip */}
          <div className="pt-12">
            <div className="flex flex-row gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-none items-center">
              {currentList.map((course, idx) => {
                const isSelected = idx === selectedCourseIndex;
                return (
                  <button
                    key={course.name}
                    type="button"
                    onClick={() => setSelectedCourseIndex(idx)}
                    className={`shrink-0 h-28 w-44 md:h-32 md:w-52 rounded-xl overflow-hidden relative cursor-pointer transition-all duration-200 text-left border-2 ${
                      isSelected
                        ? "scale-105 border-[#FF7703] shadow-xl shadow-black/60 ring-2 ring-[#FF7703]/50"
                        : "border-transparent opacity-85 hover:opacity-100 hover:scale-102"
                    }`}
                  >
                    <Image
                      src={course.cardImg}
                      alt={course.name}
                      fill
                      sizes="(max-width: 768px) 176px, 208px"
                      className="object-cover"
                    />
                    <div className="text-black font-semibold text-xs md:text-sm absolute w-full bottom-0 bg-white/90 backdrop-blur-xs py-1.5 text-center shadow-xs">
                      {course.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
