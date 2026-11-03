"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import HarmonyMusic from "@/components/HarmonyMusic";
import Testimonial from "@/components/Testimonial";
import WhyGradeCertificate from "@/components/WhyGradeCertificate";
import FAQSection from "@/components/FAQSection";
import SectionHeading from "@/components/SectionHeading";
import Com247 from "@/components/Com247";
import { FaWhatsapp } from "react-icons/fa";
import BookFreeTrial from "@/components/BookFreeTrial";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCurrency } from "@/context/CurrencyContext";
import { getCourseTierPricing } from "@/lib/pricing-tiers";

type Category = "Foundation" | "Beginner" | "Intermediate" | "Advanced";

type CourseLevel = {
  keyFeatures: string[];
  performOpportunity: string[];
  competeOpportunity: boolean;
  composeOpportunity: boolean;
  teachOpportunity: boolean;
};
type Price = {
  INR: number;
  USD: number;
};

type CourseDetails = {
  title: string;

  description: string;
  duration: string;
  certificate: string;
  masterClass: string;
  price: Price;
  discountedPrice: Price;
  href: string;
};
export type CourseDataAllType = {
  title: string;
  pic: string;
  tableData: Record<Category, CourseLevel>;
} & Record<Category, CourseDetails[]>;

function CoursePage({ params }: { params: { courseData: CourseDataAllType } }) {
  const { currency } = useCurrency();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. Get the level from the URL directly (The Single Source of Truth)
  const levelParam = searchParams.get("level")?.toLowerCase() || "foundation";

  // 2. Derive the currentCategory for your UI (Capitalize it to match your types)
  const currentCategory = (levelParam.charAt(0).toUpperCase() + levelParam.slice(1)) as Category;

  // 3. Remove the useState for currentCategory entirely!

  // 4. Update the handler to only touch the URL
  const handleTabChange = (category: Category) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("level", category.toLowerCase());
    
    // This pushes a new state to the browser history
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // const [currentCategory, setCurrentCategory] =
  //   useState<Category>("Foundation");
  //   const unwrappedParams = use(params);
  //   const course = unwrappedParams.course;
  //   console.log(course);
  //   if (!course) {
  //     return NotFound();
  //   }

  const courseInfo: CourseDataAllType = params.courseData;
  if (!courseInfo) {
    return notFound();
  }
  // console.log(courseInfo);
  const categories: Category[] = [
    "Foundation",
    "Beginner",
    "Intermediate",
    "Advanced",
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section
        className="w-full h-[50vh] md:h-[80vh] flex flex-col items-start justify-start px-4"
        style={{
          backgroundImage: `url('/${courseInfo.pic}')`,
          backgroundSize: "cover",
          backgroundPosition: "top",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="md:px-[10%] w-full pt-25">        
          <div className="py-5 px-1 md:mt-10">
            <h1
              className="text-[26px] w-full md:w-2/3 text-left md:text-[52px] text-white mb-6 mt-12 md:mt-28 "
              style={{
                fontFamily: "var(--font-vidaloka)",
                fontWeight: 500,
                lineHeight: 1,
              }}
            >
              Yes, You Can Learn {courseInfo.title} Online!
            </h1>
            <div className="mt-8">
              <Link
                href="/courses/"
                aria-label="Explore Courses"
                className="inline-block bg-[#9506EE]  text-white font-medium py-2 px-4 md:py-3.5 md:px-8.5 rounded-md "
              >
                <span
                  className="font-bold"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
                >
                  Explore Courses
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      {/* Courses Section */}
      <section className="md:px-[10%] py-5 mt-8 md:mt-20 px-1 ">
        <div>
          <h2
            className="
                  text-[24px] md:text-[38px]
                  text-[#1A022D] text-center
                  "
            style={{ fontFamily: "var(--font-vidaloka)", fontWeight: 500 }}
          >
            {courseInfo.title} <span className="text-[#FF7703]">Courses</span>
          </h2>

          <div
            className="bg-[#FFD8F2] flex flex-wrap justify-between mt-5 md:mt-10"
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
          >
            {categories.map((category) => (
              <button
                key={category}
                aria-label="Select Category"
                // onClick={() => setCurrentCategory(category)}
                onClick={() => handleTabChange(category)}
                className={`w-1/2 cursor-pointer  md:flex-1 py-4 text-[14px] md:text-[16px] ${
                  currentCategory === category
                    ? "border-6 border-[#FFD8F2] bg-white text-[#FF7703]"
                    : "text-[#1A022D]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-6 justify-start mt-5 md:mt-10 p-6 md:p-0 ">
            {courseInfo &&
            courseInfo[currentCategory] &&
            courseInfo[currentCategory].length > 0 ? (
              courseInfo[currentCategory].map((course) => (
                <CourseInfoCard
                  key={course.title}
                  title={course.title}
                  duration={course.duration}
                  shortDes={course.description}
                  masterClass={course.masterClass}
                  certification={course.certificate}
                  // href={course.href}
                  href={`${course.href}?level=${currentCategory.toLowerCase()}`}
                  price={course.price}
                  discountedPrice={course.discountedPrice}
                  currency={currency}
                  category={currentCategory}
                />
              ))
            ) : (
              <p>No courses available for this category.</p>
            )}
          </div>
        </div>
      </section>
      {/* Book a free trial section */}
      <section className="bg-[url(/blue-red-wiggly-curvy-line-pattern-white-background_1017-55410-removebg-preview.png)] w-full h-[45vh]  bg-center flex flex-col items-center justify-center  px-4 text-center text-white bg-[#3c096c] mt-5 md:mt-10 py-10 ">
        <h2
          className="text-[26px] md:text-[38px] text-white mb-4"
          style={{
            fontFamily: "var(--font-vidaloka)",
            fontWeight: 500,
          }}
        >
          Book a free trial now
        </h2>

        <p
          className=" mb-6 text-[16px] md:text-[17px]"
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
        >
          Experience our free demo and see firsthand if our platform meets your
          needs. We’re confident you’ll find it worth your while!
        </p>

        <p
          className="mb-4 text-[18px]"
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}
        >
          Not Sure About Enrolling?
        </p>

        <div
          className="flex items-center gap-4"
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
        >
          <Link href={"/book-trial"} aria-label="Book a free trial">
            <button
              className="bg-[#9506EE]  text-white md:py-4 md:px-6 rounded-lg text-[15px] px-3 py-2 cursor-pointer"
              aria-label="Book a free trial"
            >
              Book a free trial now
            </button>
          </Link>

          <span className=" md:text-[20px] md:text-lg md:font-semibold">
            OR
          </span>
          <Link href={"https://wa.me/918092621301"} aria-label="Chat with us">
            <button
              className="bg-[#9506EE] text-white md:py-4 md:px-6 rounded-lg flex items-center gap-2 text-[15px] px-3 py-2 cursor-pointer"
              aria-label="Chat with us"
            >
              <FaWhatsapp />
              Chat With Us
            </button>
          </Link>
        </div>
      </section>
      {/* Course Table section */}
      <section className="hidden md:block md:px-[10%] py-5 mt-10 md:mt-10 px-1 ">
        <h2
          className="
                  text-[20px] md:text-[38px]
                  text-[#1A022D] text-center
                  "
          style={{ fontFamily: "var(--font-vidaloka)", fontWeight: 500 }}
        >
          Your{" "}
          <span className="text-[#FF7703]">Musical Journey With Gandharva</span>
        </h2>
        <div className=" overflow-x-auto p-4 mt-5 md:mt-10">
          <table className="min-w-full border-collapse border border-[#EAEAEA]">
            <thead
              style={{
                fontFamily: "var(--font-vidaloka)",
                fontWeight: 100,
              }}
              className="text-[22px] text-[#240046]"
            >
              <tr className="">
                <th
                  className="px-4 border border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-vidaloka)",
                    fontWeight: 100,
                  }}
                >
                  Course Details
                </th>
                <th
                  className="px-4 border border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-vidaloka)",
                    fontWeight: 100,
                  }}
                >
                  Foundation
                </th>
                <th
                  className="px-4 border border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-vidaloka)",
                    fontWeight: 100,
                  }}
                >
                  Beginner
                </th>
                <th
                  className="px-4 border border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-vidaloka)",
                    fontWeight: 100,
                  }}
                >
                  Intermediate
                </th>
                <th
                  className="px-4 border border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-vidaloka)",
                    fontWeight: 100,
                  }}
                >
                  Advance
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  className="p-4 border text-[18px] text-[#240046] border-[#EAEAEA]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  Courses Offered
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo["Foundation"] &&
                    courseInfo["Foundation"].length > 0 && (
                      <ul className="list-disc px-4">
                        {courseInfo["Foundation"].map((course) => (
                          <li key={course.title}>{course.title}</li>
                        ))}
                      </ul>
                    )}
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo["Beginner"] &&
                    courseInfo["Beginner"].length > 0 && (
                      <ul className="list-disc px-4">
                        {courseInfo["Beginner"].map((course) => (
                          <li key={course.title}>{course.title}</li>
                        ))}
                      </ul>
                    )}
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo["Intermediate"] &&
                    courseInfo["Intermediate"].length > 0 && (
                      <ul className="list-disc px-4">
                        {courseInfo["Intermediate"].map((course) => (
                          <li key={course.title}>{course.title}</li>
                        ))}
                      </ul>
                    )}
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo["Advanced"] &&
                    courseInfo["Advanced"].length > 0 && (
                      <ul className="list-disc px-4">
                        {courseInfo["Advanced"].map((course) => (
                          <li key={course.title}>{course.title}</li>
                        ))}
                      </ul>
                    )}
                </td>
              </tr>
              <tr>
                <td
                  className="p-4 border text-[18px] text-[#240046] border-[#EAEAEA] bg-[#FFF2FE]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  Key Features
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA] bg-[#FFF2FE]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo.tableData &&
                    courseInfo.tableData["Foundation"] &&
                    courseInfo.tableData["Foundation"].keyFeatures.length >
                      0 && (
                      <ul className="list-disc px-4">
                        {courseInfo.tableData["Foundation"].keyFeatures.map(
                          (feature, index) => (
                            <li key={index}>{feature}</li>
                          )
                        )}
                      </ul>
                    )}{" "}
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA] bg-[#FFF2FE]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo.tableData &&
                    courseInfo.tableData["Beginner"] &&
                    courseInfo.tableData["Beginner"].keyFeatures.length > 0 && (
                      <ul className="list-disc px-4">
                        {courseInfo.tableData["Beginner"].keyFeatures.map(
                          (feature, index) => (
                            <li key={index}>{feature}</li>
                          )
                        )}
                      </ul>
                    )}{" "}
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA] bg-[#FFF2FE]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo.tableData &&
                    courseInfo.tableData["Intermediate"] &&
                    courseInfo.tableData["Intermediate"].keyFeatures.length >
                      0 && (
                      <ul className="list-disc px-4">
                        {courseInfo.tableData["Intermediate"].keyFeatures.map(
                          (feature, index) => (
                            <li key={index}>{feature}</li>
                          )
                        )}
                      </ul>
                    )}{" "}
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA] bg-[#FFF2FE]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo.tableData &&
                    courseInfo.tableData["Advanced"] &&
                    courseInfo.tableData["Advanced"].keyFeatures.length > 0 && (
                      <ul className="list-disc px-4">
                        {courseInfo.tableData["Advanced"].keyFeatures.map(
                          (feature, index) => (
                            <li key={index}>{feature}</li>
                          )
                        )}
                      </ul>
                    )}{" "}
                </td>
              </tr>
              <tr>
                <td
                  className="p-4 border text-[18px] text-[#240046] border-[#EAEAEA]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  Opportunity to perform (Gandharva digital stage)
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo.tableData &&
                    courseInfo.tableData["Foundation"] &&
                    courseInfo.tableData["Foundation"].performOpportunity
                      .length > 0 && (
                      <ul className="list-disc px-4">
                        {courseInfo.tableData[
                          "Foundation"
                        ].performOpportunity.map((feature, index) => (
                          <li key={index}>{feature}</li>
                        ))}
                      </ul>
                    )}
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo.tableData &&
                    courseInfo.tableData["Beginner"] &&
                    courseInfo.tableData["Beginner"].performOpportunity.length >
                      0 && (
                      <ul className="list-disc px-4">
                        {courseInfo.tableData[
                          "Beginner"
                        ].performOpportunity.map((feature, index) => (
                          <li key={index}>{feature}</li>
                        ))}
                      </ul>
                    )}
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo.tableData &&
                    courseInfo.tableData["Intermediate"] &&
                    courseInfo.tableData["Intermediate"].performOpportunity
                      .length > 0 && (
                      <ul className="list-disc px-4">
                        {courseInfo.tableData[
                          "Intermediate"
                        ].performOpportunity.map((feature, index) => (
                          <li key={index}>{feature}</li>
                        ))}
                      </ul>
                    )}
                </td>

                <td
                  className="p-4 border text-[16px] text-[#54595F] border-[#EAEAEA]"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontWeight: 300,
                  }}
                >
                  {courseInfo.tableData &&
                    courseInfo.tableData["Advanced"] &&
                    courseInfo.tableData["Advanced"].performOpportunity.length >
                      0 && (
                      <ul className="list-disc px-4">
                        {courseInfo.tableData[
                          "Advanced"
                        ].performOpportunity.map((feature, index) => (
                          <li key={index}>{feature}</li>
                        ))}
                      </ul>
                    )}
                </td>
              </tr>
              <tr>
                <td
                  className="p-4 border text-[18px] text-[#240046] border-[#EAEAEA] bg-[#FFF2FE]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  Opportunity to compete (Gandharva idol)
                </td>

                <td className=" p-4 bg-[#FFF2FE]">
                  <div className="flex items-center justify-center ">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Foundation"] &&
                    courseInfo.tableData["Foundation"].competeOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>

                <td className=" p-4 border border-[#EAEAEA] bg-[#FFF2FE]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Beginner"] &&
                    courseInfo.tableData["Beginner"].competeOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>

                <td className=" p-4 border border-[#EAEAEA] bg-[#FFF2FE]  ">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Intermediate"] &&
                    courseInfo.tableData["Intermediate"].competeOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>
                <td className=" p-4 border border-[#EAEAEA] bg-[#FFF2FE]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Advanced"] &&
                    courseInfo.tableData["Advanced"].competeOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>
              </tr>
              <tr>
                <td
                  className="p-4 border text-[18px] text-[#240046] border-[#EAEAEA]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  Opportunity to compose your own music (Gandharva originals)
                </td>

                <td className=" p-4 border border-[#EAEAEA]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Foundation"] &&
                    courseInfo.tableData["Foundation"].composeOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>

                <td className=" p-4 border border-[#EAEAEA]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Beginner"] &&
                    courseInfo.tableData["Beginner"].composeOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>

                <td className=" p-4 border border-[#EAEAEA]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Intermediate"] &&
                    courseInfo.tableData["Intermediate"].composeOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>
                <td className=" p-4 border border-[#EAEAEA]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Advanced"] &&
                    courseInfo.tableData["Advanced"].composeOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>
              </tr>
              <tr>
                <td
                  className="p-4 border text-[18px] text-[#240046] border-[#EAEAEA] bg-[#FFF2FE]"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  Opportunity to teach (Gandharva certified music teacher)
                </td>

                <td className=" p-4 border border-[#EAEAEA] bg-[#FFF2FE]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Foundation"] &&
                    courseInfo.tableData["Foundation"].teachOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>

                <td className=" p-4 border border-[#EAEAEA] bg-[#FFF2FE]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Beginner"] &&
                    courseInfo.tableData["Beginner"].teachOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>

                <td className=" p-4 border border-[#EAEAEA] bg-[#FFF2FE]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Intermediate"] &&
                    courseInfo.tableData["Intermediate"].teachOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>
                <td className=" p-4 border border-[#EAEAEA] bg-[#FFF2FE]">
                  <div className="flex items-center justify-center">
                    {courseInfo.tableData &&
                    courseInfo.tableData["Advanced"] &&
                    courseInfo.tableData["Advanced"].teachOpportunity ? (
                      // ✅ Checkmark Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#94d82d"
                          d="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z"
                        />
                      </svg>
                    ) : (
                      // ❌ Cross Icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="#ff6b6b"
                          d="M18.3 5.71l-1.42-1.42L12 9.17 7.12 4.29 5.71 5.71 10.59 10.6 5.71 15.47l1.41 1.42L12 12.83l4.88 4.88 1.42-1.41-4.88-4.89z"
                        />
                      </svg>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      {/* why Grades Certifications section */}
      <WhyGradeCertificate />
      {/* FAQs Section */}
      <FAQSection />
      {/* Testimonial Section */}
      <section className="flex flex-col items-center justify-center pt-4 md:pt-24 pb-20 md:pb-28">
        <div className="pb-16 px-5 md:px-40 flex flex-col gap-4 items-center justify-center">
          <SectionHeading textIndigo="" textOrange="See What Our" />
          <SectionHeading textIndigo="Students Say" textOrange="About Us." />
        </div>
        <Testimonial />
      </section>
      <HarmonyMusic />
      <Com247 />
      <div className="fixed bottom-0 w-full ">
        <BookFreeTrial />
      </div>
    </div>
  );
}

interface CourseInfoCardProps {
  title: string;
  shortDes: string;
  duration: string;
  certification: string;
  masterClass: string;
  href: string;
  price: Price;
  discountedPrice: Price;
  currency: string;
  category?: Category;
}

const CourseInfoCard: React.FC<CourseInfoCardProps> = ({
  title,
  shortDes,
  duration,
  certification,
  masterClass,
  href,
  price,
  discountedPrice,
  currency,
  category = "Beginner",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const pricing = getCourseTierPricing({
    level: category,
    sessionCount: 1,
    currency: currency as any,
  });

  return (
    <div className="bg-white shadow-md rounded-md flex flex-col h-full w-full max-w-md border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl group">
      <div className="p-6 flex flex-col flex-grow">
        
        {/* Title: Tightened leading and reduced bottom margin to pull desc up */}
        <div className="min-h-[60px] mb-1">
          <h4
            className="text-[#FF7703] text-[24px] leading-[1.1]"
            style={{
              fontFamily: "var(--font-vidaloka)",
              fontWeight: 500,
            }}
          >
            {title}
          </h4>
        </div>

        <div className="flex-grow">
          {/* Description: Tightened line height */}
          <p
            className={`text-[#2D2D2D] mb-2 text-[16px] leading-snug transition-all duration-300 ${
              !isExpanded ? "line-clamp-3" : ""
            }`}
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
          >
            {shortDes}
          </p>
          
          {shortDes.length > 110 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#9506EE] text-[13px] font-bold mb-3 hover:underline cursor-pointer"
            >
              {isExpanded ? "Show Less" : "Read More..."}
            </button>
          )}

          {/* Details list: Vertical stacking but with more horizontal width */}
          <ul
            className="text-[#2D2D2D] mb-4 list-disc pl-5 text-[15px] space-y-1"
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
          >
            <li>Course Duration: <span className="font-bold">{duration}</span></li>
            
            {/* Expanded width usually allows this to fit in one line now */}
            <li className="leading-tight">
              Certification: <span className="font-bold">{certification}</span>
            </li>
            
            <li>Masterclass: <span className="font-bold">{masterClass}</span></li>
          </ul>
        </div>

        {/* Price & Button: Pinned to bottom */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span
                suppressHydrationWarning
                className="relative inline-block text-[#1A022D] text-[15px] font-bold"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {pricing.formattedOriginalPerSession}
                <span className="absolute left-0 top-1/2 w-full h-[1.5px] bg-[#1A022D] -translate-y-1/2"></span>
              </span>

              <span
                suppressHydrationWarning
                className="text-red-700 text-[13px] font-extrabold uppercase tracking-tight"
              >
                {pricing.discountPercent}% OFF
              </span>
            </div>
            
            <p
              suppressHydrationWarning
              className="text-[#107C10] text-[20px] font-bold leading-tight"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {pricing.formattedPerSession}
              <span className="text-[12px] text-[#1A022D] font-normal ml-1">/Session</span>
            </p>
          </div>

          <Link href={href} aria-label="Know More">
            <button
              className="bg-purple-600 text-white rounded-lg px-6 py-2.5 text-[15px] transition-all hover:bg-purple-700 active:scale-95 shadow-sm cursor-pointer"
              style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
            >
              Know More
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CoursePage;
