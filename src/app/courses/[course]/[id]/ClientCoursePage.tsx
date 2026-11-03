"use client";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { FaMicrophoneLines } from "react-icons/fa6";
import { MdPeople } from "react-icons/md";
import { BsStack } from "react-icons/bs";
import { MdOutlineComputer } from "react-icons/md";
import { PiCertificateBold } from "react-icons/pi";
import { FaCalendarDay } from "react-icons/fa6";
import Link from "next/link";
import { FaRegCheckCircle } from "react-icons/fa";
import { FaWhatsapp } from "react-icons/fa";
import { notFound } from "next/navigation";
import FAQSection from "@/components/FAQSection";
import WhyGradeCertificate from "@/components/WhyGradeCertificate";
import OurTutorWebHome from "@/components/OurTutorsWebHome";
import OurTutorsMobileHome from "@/components/OurTutorsMobileHome";
import Testimonial from "@/components/Testimonial";
import Com247 from "@/components/Com247";
import SectionHeading from "@/components/SectionHeading";
import BookFreeTrial from "@/components/BookFreeTrial";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type LinkType = {
  name: string;
  url: string;
};
type Price = {
  INR: number;
  USD: number;
};
type PackageType = {
  duration: string;
  sessions: number;
  price: Price;
  discountedPrice: Price;
};
export type CourseType = {
  title: string;
  pic: string;
  type: "Foundation" | "Beginner" | "Intermediate" | "Advanced"; // Course levels
  duration: string;
  description?: string;
  descriptions?: string[];
  prerequisites?: string[];
  topics?: string[];
  outcomes?: string[];
  exams?: string[];
  performancePieces?: string[];
  examDuration?: string[];
  features?: string[];
  links: LinkType[];
  packages: PackageType[];
};
//type CourseDataType = Record<string, CourseType>;

function CourseDetails({ params }: { params: { courseData: CourseType } }) {

  const searchParams = useSearchParams();
  
  // Get the level from the URL so you can highlight it or use it for "Related Courses"
  const activeLevel = searchParams.get("level") || "foundation";

  // 1. Change your initial state to check localStorage first
const [currency, setCurrency] = useState(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("user-currency") || "USD";
  }
  return "USD";
});

useEffect(() => {
  // 2. If we already have the currency in storage, don't fetch again
  const savedCurrency = localStorage.getItem("user-currency");
  if (savedCurrency) return;

  const detectLocation = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      
      const detected = (data.country_code === "IN" || data.country === "IN") ? "INR" : "USD";
      
      // 3. Save to state AND localStorage
      setCurrency(detected);
      localStorage.setItem("user-currency", detected);
    } catch (err) {
      // Fallback to Timezone if API fails
      const isIndia = Intl.DateTimeFormat().resolvedOptions().timeZone.includes("Calcutta") || 
                      Intl.DateTimeFormat().resolvedOptions().timeZone.includes("Kolkata");
      const fallback = isIndia ? "INR" : "USD";
      setCurrency(fallback);
      localStorage.setItem("user-currency", fallback);
    }
  };

  detectLocation();
}, []);

  const courseInfo: CourseType = params.courseData;
  if (!courseInfo) {
    return notFound(); // ✅ Redirects to Next.js' default 404 page
  }
  // console.log(courseInfo);
  return (
    <div className="overflow-hidden">
      <section className="bg-[#3C096C] w-full bg-no-repeat bg-top bg-cover flex flex-col items-start justify-center py-10 px-4"></section>

      <section className="  lg:px-[10%] ">
        <h1
          className="text-[24px] md:text-[42px] mt-4 mb-2 pl-6"
          style={{ fontFamily: "var(--font-vidaloka)", fontWeight: 500 }}
        >
          {courseInfo.title}
        </h1>
        <div className="flex items-start">
          <div className="md:w-[70%] p-6 pt-0 ">
            <div className="relative w-full aspect-[20/9] mb-10">
              <Image
                src={`/${courseInfo.pic}`}
                alt={courseInfo.title}
                fill
                className="object-cover rounded-lg"
                priority={true}
              />
            </div>

            <div>
              <p
                className="text-[22px] md:text-[24px] text-[#1A022D]  mb-4 md:mb-10"
                style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}
              >
                About The Course
              </p>
              <div
                className="text-[16px] md:text-[18px] text-[#424242]"
                style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
              >
                {courseInfo.description && (
                  <p className="mb-6">{courseInfo.description}</p>
                )}
                {courseInfo.descriptions &&
                  courseInfo.descriptions.map((des, idx) => (
                    <p className="mb-6" key={idx}>
                      {des}
                    </p>
                  ))}
              </div>
            </div>
            {courseInfo.prerequisites && (
              <div className="mt-10">
                <p
                  className="text-[22px] md:text-[24px] text-[#1A022D]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
                >
                  Prerequisites
                </p>

                <ul
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  {courseInfo.prerequisites.map((prerequisite, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2.5 items-start text-[16px] md:text-[18px] my-2"
                    >
                      <span className="flex-shrink-0 mt-1">
                        <FaRegCheckCircle size={20} color="#FF9100" />
                      </span>
                      {prerequisite}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {courseInfo.topics && (
              <div className="mt-10">
                <p
                  className="text-[22px] md:text-[24px] text-[#1A022D]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
                >
                  Topics Covered
                </p>

                <ul
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  {courseInfo.topics.map((topic, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2.5 items-start text-[16px] md:text-[18px] my-2"
                    >
                      <span className="flex-shrink-0 mt-1">
                        <FaRegCheckCircle size={20} color="#FF9100" />
                      </span>
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {courseInfo.outcomes && (
              <div className="mt-10">
                <p
                  className="text-[22px] md:text-[24px] text-[#1A022D]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
                >
                  Learning Outcomes You Can Expect
                </p>

                <ul
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  {courseInfo.outcomes.map((outcome, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2.5 items-start text-[16px] md:text-[18px] my-2"
                    >
                      <span className="flex-shrink-0 mt-1">
                        <FaRegCheckCircle size={20} color="#FF9100" />
                      </span>
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {courseInfo.exams && (
              <div className="mt-10">
                <p
                  className="text-[22px] md:text-[24px] text-[#1A022D]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
                >
                  Types Of Exams Available
                </p>

                <ul
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  {courseInfo.exams.map((exam, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2.5 items-start text-[16px] md:text-[18px] my-2"
                    >
                      <span className="flex-shrink-0 mt-1">
                        <FaRegCheckCircle size={20} color="#FF9100" />
                      </span>
                      {exam}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {courseInfo.examDuration && (
              <div className="mt-10">
                <p
                  className="text-[22px] md:text-[24px] text-[#1A022D]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
                >
                  Exam Duration
                </p>

                <ul
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  {courseInfo.examDuration.map((dur, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2.5 items-start text-[16px] md:text-[18px] my-2"
                    >
                      <span className="flex-shrink-0 mt-1">
                        <FaRegCheckCircle size={20} color="#FF9100" />
                      </span>
                      {dur}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {courseInfo.performancePieces && (
              <div className="mt-10">
                <p
                  className="text-[22px] md:text-[24px] text-[#1A022D]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
                >
                  Performance Pieces
                </p>

                <ul
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  {courseInfo.performancePieces.map((pp, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2.5 items-start text-[16px] md:text-[18px] my-2"
                    >
                      <span className="flex-shrink-0 mt-1">
                        <FaRegCheckCircle size={20} color="#FF9100" />
                      </span>
                      {pp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {courseInfo.features && (
              <div className="mt-10">
                <p
                  className="text-[22px] md:text-[24px] text-[#1A022D]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
                >
                  Key Features
                </p>

                <ul
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  {courseInfo.features.map((feature, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2.5 items-start text-[16px] md:text-[18px] my-2"
                    >
                      <span className="flex-shrink-0 mt-1">
                        <FaRegCheckCircle size={20} color="#FF9100" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div
            className="hidden md:flex flex-col gap-12  p-4 pt-0"
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
          >
            <div
              className="flex flex-col gap-3 rounded-xl max-w-sm p-4
            bg-[url(/664c5dec47cac5e5b02a070c_Small-Business-Percentage-_1_-removebg-preview-1-1.png)]
        bg-no-repeat bg-right bg-contain bg-[#FFECFE]
            "
            >
              <p className="text-[18px] text-[#424242] flex gap-4">
                <FaMicrophoneLines size={24} color="#3C096C" />
                English
              </p>
              <p className="text-[18px] text-[#424242] flex gap-4">
                <MdPeople size={24} color="#3C096C" />
                Format - 1:1 lesson with Teacher
              </p>
              <p className="text-[18px] text-[#424242] flex gap-4">
                <BsStack size={24} color="#3C096C" />
                {courseInfo.type}
              </p>
              <p className="text-[18px] text-[#424242] flex gap-4">
                <MdOutlineComputer size={24} color="#3C096C" />
                Mobile & Desktop Access
              </p>
              <p className="text-[18px] text-[#424242] flex gap-4">
                <PiCertificateBold size={24} color="#3C096C" />
                Certificate on completion
              </p>
              <p className="text-[18px] text-[#424242] flex gap-4">
                <FaCalendarDay size={24} color="#3C096C" />
                Duration: {courseInfo.duration} months
              </p>
              <button
                aria-label="See Packages"
                onClick={() =>
                  document
                    .getElementById("packages")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="border-1 py-2 rounded-md border-[#FF9100] text-[17px] text-[#FF9100] cursor-pointer"
              >
                See Packages
              </button>
              <Link
                className=" py-2 rounded-md bg-[#9506EE] text-[17px] text-[#FFF] cursor-pointer"
                href={"/book-trial"}
                aria-label="Book a Free Trial"
              >
                <button
                  aria-label="Book a Free Trial"
                  className=" w-full cursor-pointer"
                >
                  Book Now
                </button>
              </Link>
            </div>
            <div className="flex flex-col gap-3 rounded-xl max-w-sm p-4 border border-gray-300">
              <p className="text-[24px] text-[#1A022D] font-medium">
                Related Courses
              </p>
              {courseInfo.links.map((link, index) => (
                <Link
                  aria-label="Related Courses"
                  key={index}
                  href={`${link.url}?level=${activeLevel}`}
                  className="text-[18px] text-[#424242] flex gap-4"
                >
                  <BsStack size={24} color="#3C096C" />
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className=" w-full " id="packages">
        <h2
          className="text-[26px] md:text-[42px] text-[#240046]  text-center lg:text-nowrap mb-6 mt-10 md:mt-20"
          style={{
            fontFamily: "var(--font-vidaloka)",
            fontWeight: 500,
          }}
        >
          Select Your <span className="text-[#FF7703]">Package</span>
        </h2>
        <div className="flex flex-col md:flex-row justify-evenly md:w-[80%] mx-auto p-4 gap-4">
          {courseInfo.packages.map((p, index) => (
            <CoursePackageCard
              key={index}
              duration={p.duration}
              sessions={p.sessions}
              price={p.price}
              discountedPrice={p.discountedPrice}
              currency={currency}
            />
          ))}
        </div>
      </section>
      {/* why Grades Certifications section */}
      <WhyGradeCertificate />
      {/* FAQs Section */}
      <FAQSection />
      <section className="flex flex-col bg-pink-200/50 items-center justify-center pt-8 md:pt-24 pb-10 md:pb-20 mt-10">
        <div className="pb-10 md:pb-16 px-5 md:px-40 flex flex-col gap-4 items-center justify-center">
          <SectionHeading textIndigo="" textOrange="Meet Our" />
          <SectionHeading textIndigo="Talented" textOrange="Instructors" />
        </div>
        <div className="hidden md:block w-full">
          <OurTutorWebHome />
        </div>
        <div className="block md:hidden w-full">
          <OurTutorsMobileHome />
        </div>
      </section>
      {/* Section 5 - testimonials */}
      <section className="flex flex-col items-center justify-center pt-8 md:pt-24 pb-20 md:pb-28">
        <div className="pb-16 px-5 md:px-40 flex flex-col items-center justify-center">
          <SectionHeading textIndigo="" textOrange="See What Our" />
          <SectionHeading textIndigo="Students Say" textOrange="About Us." />
        </div>
        <Testimonial />
      </section>
      <Com247 />
      <div className="fixed bottom-0 w-full ">
        <BookFreeTrial />
      </div>
    </div>
  );
}

interface Package {
  duration: string;
  sessions: number;
  price: Price;
  discountedPrice: Price;
  currency: string;
}

const CoursePackageCard: React.FC<Package> = ({
  duration,
  sessions,
  price,
  discountedPrice,
  currency,
}) => {
  return (
    <div
      className="w-full max-w-sm  bg-[url(/664c5dec47cac5e5b02a070c_Small-Business-Percentage-_1_-removebg-preview-1-1.png)]
        bg-no-repeat bg-right bg-contain bg-[#FFECFE] rounded-2xl p-6 shadow-md border border-[#F8DAFF]"
      style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
    >
      
      {/* Header */}
      <div
        className="bg-[#590080] text-white px-4 py-2 rounded-full inline-block text-[16px] "
        style={{ fontWeight: 500 }}
      >
        {duration} Months
      </div>

      {/* Details */}
      <ul className="text-[#424242] text-[16px] mt-4 space-y-2">
        <li>• Session duration: 60 Minutes each</li>
        <li>• No. of sessions: {sessions}</li>
        <li>• Format: 1:1 with Teacher</li>
      </ul>

      {/* <div className="flex items-center justify-between mt-5"> */}
        {/* Pricing */}
        {/* <div className="mt-4">
          <p className="text-[#04002B] text-[16px]">
            {currency === "INR" ? `INR ${price.INR}` : `USD ${price.USD}`}
            /Session
          </p>
          <p className="text-[#04002B] text-[20px]" style={{ fontWeight: 500 }}>
            {currency === "INR"
              ? `INR ${Number(sessions) * Number(price.INR)}/-`
              : `USD ${Number(sessions) * Number(price.USD)}/-`}
          </p>
        </div> */}

        {/* Buttons */}
        {/* <div className="mt-4 flex flex-col gap-2">
          <Link href={"/book-trial"} aria-label="Book a Free Trial">
            <button
              className="bg-[#9506EE] text-white px-4 py-2 rounded-lg text-[14px] cursor-pointer"
              aria-label="Book a Free Trial"
            >
              Book a Free Trial
            </button>
          </Link>
          <Link
            href={"https://wa.me/918092621301"}
            aria-label="Chat with us on WhatsApp"
          >
            <button
              aria-label="Chat with us on WhatsApp"
              className="bg-[#9506EE] text-white px-4 py-2 rounded-lg text-[14px] flex items-center justify-center gap-2 cursor-pointer hover:bg-[#6A0080] transition"
            >
              <span>
                <FaWhatsapp />
              </span>{" "}
              Chat With Us
            </button>
          </Link>
        </div>
      </div> */}

      <div className="mt-5 mb-6 ">
        {/* Strikethrough Original Total & % Off */}
        <div className="flex items-center gap-2 mb-0">
          <p className="text-gray-400 line-through text-[14px]">
            {currency === "INR"
              ? `INR ${Number(sessions) * Number(price.INR)}/-`
              : `USD ${Number(sessions) * Number(price.USD)}/-`}
          </p>
          
          {/* Dynamic % Off Rate */}
          <span className="text-red-600 text-[14px] font-bold">
            {currency === "INR" 
              ? Math.round(((price.INR - discountedPrice.INR) / price.INR) * 100)
              : Math.round(((price.USD - discountedPrice.USD) / price.USD) * 100)}
            % OFF
          </span>
        </div>

        {/* Large Discounted Total */}
        <p className="text-[#15803d] text-[32px] font-bold leading-tight">
          {currency === "INR"
            ? `INR ${Number(sessions) * Number(discountedPrice.INR)}/-`
            : `USD ${Number(sessions) * Number(discountedPrice.USD)}/-`}
        </p>

        {/* Discounted Per Session Rate */}
        {/* <p className="text-[#9506EE] text-[15px] font-medium">
          {currency === "INR" 
            ? `INR ${discountedPrice.INR}` 
            : `USD ${discountedPrice.USD}`} /Session
        </p> */}
      </div>

      {/* Buttons Section */}
      <div className="flex flex-col gap-3 mt-6">
        <Link href={"/book-trial"} className="w-full">
          <button
            className="w-full bg-[#9506EE] text-white border-2 border-[#9506EE] py-3 rounded-xl text-[16px] font-bold cursor-pointer 
            hover:bg-[#FFD700] hover:border-[#FFD700] hover:text-[#04002B] transition-all duration-300"
          >
            Book a Free Trial
          </button>
        </Link>
  
        <Link
          href={"https://wa.me/918092621301"}
          className="w-full"
        >
          <button
            className="w-full border-2 border-[#9506EE] text-[#9506EE] bg-white py-2 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 cursor-pointer 
            hover:bg-[#FFD700] hover:border-[#FFD700] hover:text-[#04002B] transition-all duration-300"
          >
            <FaWhatsapp size={20} />
            Chat With Us
          </button>
        </Link>
      </div>      
    </div>
  );
};

export default CourseDetails;
