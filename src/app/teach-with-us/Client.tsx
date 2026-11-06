"use client";
import FAQSection from "@/components/FAQSection";
import HarmonyMusic from "@/components/HarmonyMusic";
import QuoteIcon from "@/components/QuoteIcon";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useState, useEffect, useRef } from "react";

const section3data = [
  {
    title: "Competitive Salary",
    desc: [
      "We appreciate our teachers.",
      "That’s why we offer the fairest compensation.",
      "Plus, top performers earn well-deserved bonuses.",
    ],
    img: "money-bag-with-dollars-gold-coin-stack-flat-vector-illustration-background_951964-6390.webp",
  },
  {
    title: "Work Life Balance",
    desc: [
      "You set your preferred time zone, choose your time slots, and create your own schedule.",
      "Students will be matched according to your availability.",
    ],
    img: "girl-using-laptop-and-drinking-coffee-3d-character-illustration-for-e-learning-and-freelancing-png.webp",
  },
  {
    title: "Growth Opportunities",
    desc: [
      "We want you to grow alongside us.",
      "That’s why we offer a 5-level growth plan for our teachers, leading to Subject Matter Expert status, along with bonuses and additional opportunities.",
    ],
    img: "infographic-chart-concept-illustration_958800-80224.webp",
  },
];

const section5data = [
  {
    name: "Saanvi Paul",
    skill: "Piano",
    img: "medium-shot-teacher-playing-piano_23-2149613748-e1730339018836.jpg",
    testimony:
      "Love the way things are set up at Gandharva. Everything is so organized and systematic. Both the teachers and customers are handled very well. I mainly like the way classes are arranged and both the parties are and problems get solved immediately. There is always a dedicated staff to help us & guide us.",
  },
  {
    name: "Kavya Mehta",
    img: "beautiful-indian-woman-saree-singing-playing-harmonium-white-background_1048944-14347035-e1730339078227-150x150-1.jpg",
    skill: "Carnatic Vocals",
    testimony:
      "My 2-year journey at Gandharva School of Music as a Guitar and Indian Classical Music Vocalist has been truly wonderful. The online platform's well-structured sessions, incentives, and curriculum make work very smooth. The team is also very supportive and responds quickly. I'm thoroughly enjoying my time at Gandharva and plan to continue for a long time.",
  },
  {
    name: "Devraj Pillai",
    img: "indian-man-city-male-traditional-turban-hinduist-summer-city-scaled-e1730338882321.jpg",
    skill: "Carnatic Classical",
    testimony:
      "The best change that happened to me after joining Gandharva is that I started waking up early to teach my students in different time zones. Gandharva helps me connect globally and spread the joy of Carnatic Classical Vocals. I also love working as an SME for regional exams to groom future musicians. I thoroughly enjoyed the opportunity to conduct a Masterclass on compositions for students across geographies and age groups.",
  },
  {
    name: "Nisha Iyer",
    img: "student-with-goth-style-school-scaled-e1730338956118.jpg",
    skill: "Western Vocals",
    testimony:
      "I have been teaching Western Vocals at Gandharva for a year, and it has been amazing. All the sessions are conducted professionally, and it’s very easy for us teachers to track each student’s progress on the portal. We also get a fair amount of creative freedom with the syllabus to ensure that the sessions are fun for both student and teacher.",
  },
  {
    name: "Rohanel Max",
    img: "guitar-music-outdoors-scaled-e1730338823279.jpg",
    skill: "Acoustic Guitar",
    testimony:
      "Since joining Gandharva, the transformative change for me has been developing global connections and sharing the joy of learning and playing the acoustic guitar. As an SME, I take pride in grooming future musicians and contributing to making music education accessible to all. Conducting a Masterclass for acoustic guitar students has been one of the most rewarding experiences for me because of the enthusiasm and curiosity of the kids.",
  },
];

function TeachWithUs() {
  return (
    <div>
      {/* Section 1 - Landing  */}
      <section className="bg-[url(/DCFVNN.avif)] w-full h-[70vh] md:h-[90vh] bg-no-repeat bg-top bg-cover flex flex-col py-10 px-4">
        <div className="md:px-[10%] px-1 md:w-[70%] mt-20 md:mt-30">
          <h1
            className="text-[26px] md:text-[52px] w-full text-left  text-white mb-6"
            style={{
              fontFamily: "var(--font-vidaloka)",
              fontWeight: 500,
            }}
          >
            Be more than a teacher—be an inspiration.
          </h1>
          <div className="my-8 w-max-[70%]">
            <span
              className="text-[16px] md:text-[17px] text-white"
              style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
            >
              At Gandharva, we believe music sparks creativity and builds
              confidence. If you’re passionate about teaching, motivating
              students, and boosting their confidence, you’re exactly who we
              need!
            </span>
          </div>
          <div className="flex gap-5">
            <Link
              href={"/teach-with-us/job-application/"}
              aria-label="apply-now"
            >
              <button
                aria-label="apply-now"
                className="text-[14px] md:text-[16px] text-white bg-[#9506EE] py-3 md:py-4 px-4 md:px-8 rounded-sm cursor-pointer"
                style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
              >
                Apply Now
              </button>
            </Link>
            <Link
              href={"/teach-with-us/job-details/"}
              aria-label="view-details"
            >
              <button
                aria-label="view-details"
                className="text-[14px] md:text-[16px] text-white bg-orange-500 py-3 md:py-4 px-4 md:px-8 rounded-sm cursor-pointer"
                style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
              >
                View details
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Section 2 - Online experience */}
      <section className="px-5 md:px-40 py-5 md:py-28 flex flex-col md:flex-row justify-between items-center">
        <div className="w-full md:w-[61%]">
          <h2 className="text-indigo-950  text-[30px] md:text-[42px] custom-font-2 flex flex-col gap-3 w-full md:w-fit text-left">
            <div className="text-indigo-950 ">Seamless</div>
            <div className="text-orange-500">Online Experience.</div>
          </h2>

          <div className="tracking-wide text-[#54595F] text-[17px] custom-font-1 flex flex-col gap-5 mt-8">
            <span>Teach students worldwide from the comfort of your home.</span>
            <span>
              Our one-click digital platform allows you to easily schedule,
              conduct, and manage classes. Track student progress, organize
              lessons, and conduct sessions—all in one convenient, hassle-free
              place.
            </span>
          </div>
        </div>
        <div className="rounded-full overflow-hidden size-64 md:size-84 mt-12 md:mt-0">
          <img
            src="/man-playing-guitar-looking-laptop-scaled-1.webp"
            alt="guitar man"
            className=""
          />
        </div>
      </section>

      {/* Section 3 - Your happiness */}
      <section className="px-5 md:px-40 pt-6 md:pt-4 pb-6 md:pb-24 flex flex-col justify-between items-center">
        <SectionHeading
          textIndigo="Your Happiness Is"
          textOrange="What Matters Most To Us."
        />
        <div className="flex flex-col md:flex-row justify-center items-start gap-8 mt-20 h-full">
          {section3data.map((item, index) => (
            <Section3card
              key={index}
              title={item.title}
              desc={item.desc}
              img={item.img}
            />
          ))}
        </div>
      </section>

      {/* Section 4 - Recruitment process  */}
      <section className="relative px-5 md:px-40 py-10 mt-10 md:mt-20 md:py-24 bg-pink-200/50 flex flex-col justify-between items-center">
        <div className="absolute -z-1 left-0 top-0 h-full w-full opacity-10">
          <Image
            src="/top-view-earbuds-with-musical-notes-removebg-preview.png"
            alt="bg"
            fill
            className="object-cover"
            priority
          />
        </div>
        <SectionHeading textIndigo="Our" textOrange="Recruitment Process" />
        <div className="flex flex-col md:flex-row gap-16 mt-24">
          <Section4card
            title="Apply Online"
            img="hands-hold-smartphone-top-view-cartoon-character-reading-mail-phone-online-communication-device-screen-with-text-application-vector-gadget-isolated-minimal-illustration_176516-6541.jpg"
          />
          <Section4card
            title="Get Shortlisted"
            img="man-holding-pointing-button-with-check-mark-3d-vector-people-character-cartoon-minimal-style_365941-1183.jpg"
          />
          <Section4card
            title="Video Interview"
            img="pngtree-girl-studying-at-online-school-from-home-vector-illustration-vector-png-image_12864333-1.png"
          />
          <Section4card
            title="Get Trained"
            img="Covers-Vertical-4-removebg-preview.png"
          />
          <Section4card
            title="Start Teaching"
            img="3d-online-meeting-with-the-marketing-team-illustration-png.webp"
            last={true}
          />
        </div>
        <Link
          href={"/teach-with-us/job-application/"}
          aria-label="apply-online-teacher"
        >
          <button
            aria-label="apply-online-teacher"
            className="mt-6 md:mt-10 px-7 py-3 bg-orange-500 text-white rounded-lg cursor-pointer"
          >
            Apply for online teacher
          </button>
        </Link>
      </section>

      {/* Section 5 - Meet our teachers  */}
      <section className="w-full flex flex-col items-center justify-center pt-10 md:pt-24 pb-12 md:pb-28 px-5 md:px-52">
        <SectionHeading textIndigo="Meet our" textOrange="Teachers" />
        <Section5TeachersCarousel />
      </section>

      {/* Section 6 - FAQ ........ */}
      <FAQSection />
      <HarmonyMusic />
    </div>
  );
}

function SectionHeading({
  textIndigo,
  textOrange,
}: {
  textIndigo: string;
  textOrange: string;
}) {
  return (
    <div className="text-indigo-950 text-3xl/12 md:text-4xl font-medium custom-font-2 text-center">
      {textIndigo} <span className="text-orange-500">{textOrange}</span>
    </div>
  );
}

function Section3card({
  title,
  desc,
  img,
}: {
  title: string;
  desc: string[];
  img: string;
}) {
  return (
    <div
      className="w-full md:w-[30%] bg-white shadow-sm md:shadow-lg rounded-lg p-4 flex flex-col gap-4 tracking-wide "
      style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
    >
      <div className="object-cover w-full flex justify-center items-center">
        <img src={`/${img}`} alt="icon" className="h-36 md:h-48" />
      </div>
      <h2 className="text-indigo-950 text-lg md:text-xl font-semibold w-full text-left">
        {title}
      </h2>
      <ul className="grow text-gray-700 text-[15px]/7 md:text-[17px]/7 custom-font-1 list-disc mx-2 h-36 md:h-44 px-2">
        {desc.map((item, index) => {
          return (
            <li key={index} className="">
              {item}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Section4card({
  title,
  last = false,
  img,
}: {
  title: string;
  last?: boolean;
  img: string;
}) {
  return (
    <div className="relative size-44 flex flex-col gap-4">
      <div className="absolute -z-1 w-full h-full -top-16 -left-16 m-8 rounded-2xl">
        <div className="border-8 border-purple-700/70 w-full h-full rounded-2xl"></div>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="object-cover w-full flex justify-center items-center">
          <img src={`/${img}`} alt="icon" className="size-32" />
        </div>
        <div className="text-indigo-950 text-base font-semibold w-full text-center my-2">
          {title}
        </div>
      </div>
      {!last && (
        <div className="opacity-0 md:opacity-100 absolute top-20 left-20 -z-2 w-full border-2 border-dashed border-purple-700/70"></div>
      )}
    </div>
  );
}

function Section5TeachersCarousel() {
  const [current, setCurrent] = useState(0);
  const total = section5data.length;
  const intervalRef = useRef(setInterval(() => {}, 100));

  useEffect(() => {
    startAutoSlide();
    return () => clearInterval(intervalRef.current);
  }, []);

  const startAutoSlide = () => {
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % total);
    }, 6000);
  };

  const handleBubbleClick = (index: number) => {
    clearInterval(intervalRef.current);
    setCurrent(index);
    startAutoSlide();
  };

  return (
    <div className="w-full">
      <div className="mt-16 md:mt-20 w-full overflow-hidden">
        {/* Slider Row */}
        <div className="w-full relative rounded-3xl">
          <div
            className="flex h-full w-full transition-transform duration-500"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {section5data.map((item, index) => (
              <div
                key={index}
                className="min-w-full flex flex-col lg:flex-row gap-6 justify-center items-center h-full p-4"
              >
                {/* Profile & Details */}
                <div className="w-full max-w-xs md:max-w-sm lg:max-w-xs relative text-white flex flex-col justify-center items-center">
                  <img
                    src={`/${item.img}`}
                    className="aspect-square w-44 md:w-52 rounded-xl object-cover shadow-md mb-2"
                    alt={item.name}
                  />
                  <div className="relative w-full flex pt-2 pb-12 flex-col justify-center items-center bg-white text-lg text-black rounded-b-xl shadow-lg">
                    <div className="border border-gray-700/20 absolute -z-10 -top-24 w-full h-40 bg-white rounded-xl"></div>
                    <div className="border-x border-b border-gray-700/20 absolute z-10 top-0 left-0 w-full h-full rounded-b-xl"></div>
                    <div className="z-20 font-medium mb-1 custom-font-2 text-center">
                      {item.name}
                    </div>
                    <div className="z-20 mb-4 font-medium text-base md:text-lg custom-font-2 text-center">
                      {item.skill}
                    </div>
                  </div>
                </div>

                {/* Testimony */}
                <div className="relative text-orange-500 px-4  w-full max-w-xl m-2 md:m-5">
                  <QuoteIcon className="absolute z-10 -top-6 md:-top-10 left-6 size-8 md:size-14 opacity-60" />
                  <QuoteIcon className="absolute rotate-180 z-10 -bottom-6 md:-bottom-10 right-6 size-8 md:size-14 opacity-60" />
                  <div className="bg-purple-950 text-white rounded-2xl px-6 py-8 md:px-12 md:py-10 shadow-md text-center">
                    <p className="text-base md:text-xl leading-relaxed custom-font-2">
                      &quot;{item.testimony}&quot;
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Bubbles */}
        <div className="flex gap-2 mt-6 md:mt-8 justify-center">
          {section5data.map((_, index) => (
            <button
              key={index}
              className={`size-2.5 md:size-3 rounded-full transition-colors bg-black ${
                index === current ? "opacity-100" : "opacity-40"
              }`}
              onClick={() => handleBubbleClick(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default TeachWithUs;
