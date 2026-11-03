"use client";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { GiHamburgerMenu } from "react-icons/gi";
import { IoClose } from "react-icons/io5";
import { FaAngleUp, FaAngleDown } from "react-icons/fa6";

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showCourses, setShowCourses] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showResouces, setShowResouces] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  // Add scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [scrolled]);

  return (
    <header className="">
      {/* Desktop Header */}
      <div
        className={` hidden lg:block fixed top-0 left-0 right-0 z-50 w-ful  transition-all duration-300 ${
          scrolled ? " md:block bg-[#3c096c] shadow-md" : "bg-transparent"
        }`}
        style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <div className="flex-shrink-0">
              {/* Logo - Left Section */}
              <Link
                href="/"
                className="flex items-center"
                aria-label="Gandharva School Of Music"
              >
                <Image
                  src="/cropped-Add-a-subheading-5-png-scaled.avif"
                  aria-label="Gandharva School Of Music"
                  alt="Gandharva School Of Music"
                  width={150}
                  height={50}
                  className="h-12 w-auto"
                />
              </Link>
            </div>

            {/* Navigation - Center Section */}
            <nav className="flex-1 flex justify-center text-white  text-[15px]  px-20 ">
              <ul className="w-full flex space-x-6 justify-evenly ">
                <li className="relative group hover:text-black hover:bg-white  p-3  rounded-t-xl cursor-pointer">
                  <p className=" flex items-start gap-0.5 ">
                    Courses{" "}
                    <FaAngleDown size={12} className="relative top-1 left-1" />
                  </p>
                  <ul className=" absolute left-0 mt-1  bg-white text-black rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity delay-75 duration-200 flex justify-between p-4 gap-28">
                    {/* Instruments Column */}

                    <div>
                      <p className="px-4 py-2 font-bold text-[16px]">
                        INSTRUMENTS
                      </p>
                      <ul>
                        {[
                          { name: "Piano", href: "/courses/piano/" },
                          {
                            name: "Electronic Keyboard",
                            href: "/courses/electronic-keyboard/",
                          },
                          {
                            name: "Acoustic Guitar",
                            href: "/courses/acoustic-guitar/",
                          },
                          {
                            name: "Electric Guitar",
                            href: "/courses/electric-guitar/",
                          },
                          { name: "Ukulele", href: "/courses/ukulele/" },
                          { name: "Violin", href: "/courses/violin/" },
                          { name: "Flute", href: "/courses/flute/" },
                          { name: "Tabla", href: "/courses/tabla/" },
                        ].map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              aria-label={`${item.name} Courses`}
                              className="block px-4 py-2 hover:font-bold text-nowrap min-w-[200px] cursor-pointer hover:bg-[#D8D1E8] rounded-sm"
                            >
                              {item.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Singing Column */}

                    <div>
                      <p className="px-4 py-2 font-bold text-[16px]">SINGING</p>
                      <ul>
                        {[
                          {
                            name: "Western Vocals",
                            href: "/courses/western-vocals/",
                          },
                          {
                            name: "Carnatic Vocals",
                            href: "/courses/carnatic-vocals/",
                          },
                          {
                            name: "Hindustani Vocals",
                            href: "/courses/hindustani-vocals/",
                          },
                          {
                            name: "Bollywood Vocals",
                            href: "/courses/bollywood-vocals/",
                          },
                          {
                            name: "Kannada Music",
                            href: "/courses/kannada-music/",
                          },
                          {
                            name: "Malayalam Music",
                            href: "/courses/malayalam-music/",
                          },
                          {
                            name: "Tamil Music",
                            href: "/courses/tamil-music/",
                          },
                          {
                            name: "Telugu Music",
                            href: "/courses/telugu-music/",
                          },
                        ].map((course) => (
                          <li key={course.href}>
                            <Link
                              href={course.href}
                              aria-label={`${course.name} Courses`}
                              className="block px-4 py-2 hover:font-bold text-nowrap min-w-[200px] cursor-pointer hover:bg-[#D8D1E8] rounded-sm"
                            >
                              {course.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Dancing Column */}

                    <div>
                      <p className="px-4 py-2 font-bold text-[16px]">DANCING</p>
                      <ul>
                        {[
                          {
                            name: "Bharatanatyam",
                            href: "/courses/bharatanatyam/",
                          },
                          { name: "Kathak", href: "/courses/kathak/" },
                          {
                            name: "Bollywood Dance",
                            href: "/courses/bollywood-dance/",
                          },
                        ].map((course) => (
                          <li key={course.href}>
                            <Link
                              href={course.href}
                              aria-label={`${course.name} Courses`}
                              className="block px-4 py-2 hover:font-bold text-nowrap min-w-[200px] cursor-pointer hover:bg-[#D8D1E8] rounded-sm"
                            >
                              {course.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </ul>
                </li>

                <li className=" relative group hover:text-black hover:bg-white p-3 cursor-pointer  rounded-t-xl">
                  <p className=" flex items-start gap-0.5 ">
                    About{" "}
                    <FaAngleDown size={12} className="relative top-1 left-1" />
                  </p>
                  <ul className="absolute left-0 mt-1 w-40  bg-white text-black rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity delay-75 duration-200 border-8  border-white">
                    <Link href={"/company/"} aria-label="Company">
                      <li className="px-4 py-2 hover:bg-[#D8D1E8]   rounded-tr-xl">
                        Company
                      </li>
                    </Link>
                    <Link href={"/policy/"} aria-label="Policy">
                      <li className="px-4 py-2 hover:bg-[#D8D1E8] rounded-b-xl">
                        Policy
                      </li>
                    </Link>
                  </ul>
                </li>
                <li className=" relative group hover:text-black hover:bg-white p-3  cursor-pointer rounded-t-xl">
                  <p className=" flex items-start gap-0.5 ">
                    Resources{" "}
                    <FaAngleDown size={12} className="relative top-1 left-1" />
                  </p>
                  <ul className="absolute left-0 mt-1 w-40  bg-white text-black rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity delay-75 duration-200 border-8  border-white">
                    <Link href={"/blog/"} aria-label="Blog">
                      <li className="px-4 py-2 hover:bg-[#D8D1E8]   rounded-tr-xl">
                        Blog
                      </li>
                    </Link>
                    <Link href={"/tools/"} aria-label="Tools">
                      <li className="px-4 py-2 hover:bg-[#D8D1E8] rounded-b-xl">
                        Tools
                      </li>
                    </Link>
                  </ul>
                </li>
                <li className=" relative group hover:text-black hover:bg-white p-3  cursor-pointer rounded-t-xl">
                  <p className=" flex items-start gap-0.5 ">
                    Support{" "}
                    <FaAngleDown size={12} className="relative top-1 left-1" />
                  </p>
                  <ul className="absolute left-0 mt-0 w-40  bg-white text-black rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity delay-75 duration-200 border-8  border-white">
                    <Link href={"/faq/"} aria-label="FAQ">
                      <li className="px-4 py-2 hover:bg-[#D8D1E8]   rounded-tr-xl">
                        FAQ
                      </li>
                    </Link>
                    <Link href={"/contact-us/"} aria-label="Contact Us">
                      <li className="px-4 py-2 hover:bg-[#D8D1E8] rounded-b-xl">
                        Contact Us
                      </li>
                    </Link>
                  </ul>
                </li>
                <Link href={"/teach-with-us/"} aria-label="Teach With Us">
                  <li className=" p-3  hover:text-black hover:bg-white  rounded-xl">
                    Teach With Us
                  </li>
                </Link>

                <Link
                  href={"/become-our-affiliate/"}
                  aria-label="Become Our Affiliate"
                >
                  <li className=" p-3  hover:text-black hover:bg-white  rounded-xl">
                    {" "}
                    Become Our Affiliate
                  </li>
                </Link>
              </ul>
            </nav>
            {/* Book a trial - Right Section */}
            <div className="flex-shrink-0">
              <Link
                href="/book-trial"
                aria-label="Book a Free Trial"
                target="_blank"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-purple-600 hover:bg-purple-700"
              >
                Book a free trial
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Display */}
      <div
        className={`lg:hidden fixed w-full z-50 top-0 ${
          scrolled ? " md:block bg-[#3c096c] shadow-md" : "bg-transparent"
        }`}
      >
        <div className="flex justify-between items-center p-4 pr-8">
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="flex items-center"
              aria-label="Gandharva School Of Music"
            >
              <Image
                src="/cropped-Add-a-subheading-5-png-scaled.avif"
                alt="Gandharva School Of Music"
                width={120}
                height={40}
                className="h-12 w-auto"
              />
            </Link>
          </div>
          <button onClick={() => setIsOpen(true)} aria-label="Menu">
            <GiHamburgerMenu size={26} color="white" />
          </button>
        </div>
        {/* Side Drawer */}
        {/* <div
          className={`fixed top-0 right-0 h-full w-3/4 bg-[#3c096c] text-white transform ${
            isOpen ? "translate-x-0" : "translate-x-full"
          } transition-transform duration-300 ease-in-out shadow-lg overflow-y-auto`}
        >
          <div className="flex justify-between items-center p-4 border-b border-gray-600">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button onClick={() => setIsOpen(false)}>
              <IoClose size={28} />
            </button>
          </div>
          <nav className="flex flex-col p-4 space-y-4">
            <Link href="/home" className="hover:text-gray-300">
              Home
            </Link>
            <Link href="/about" className="hover:text-gray-300">
              About Us
            </Link>
            <Link href="/courses" className="hover:text-gray-300">
              Courses
            </Link>
            <Link href="/contact" className="hover:text-gray-300">
              Contact
            </Link>
          </nav>
        </div> */}
        {/* Side Drawer */}
        <div
          className={`fixed top-0 right-0 h-full w-3/4 bg-[#FFF] pr-4 text-black transform ${
            isOpen ? "translate-x-0" : "translate-x-full"
          } transition-transform duration-300 ease-in-out shadow-lg overflow-y-auto`}
        >
          <div className="flex justify-end items-center">
            <button
              className="p-2"
              onClick={() => setIsOpen(false)}
              aria-label="Close Menu"
            >
              <IoClose color="#FF7703" size={28} />
            </button>
          </div>
          <nav className="flex flex-col p-4 space-y-4">
            <div>
              <button
                aria-label="Courses"
                className="flex justify-between items-center w-full text-[#24105EFE] text-[16px]"
                onClick={() => setShowCourses(!showCourses)}
              >
                Courses {showCourses ? <FaAngleUp /> : <FaAngleDown />}
              </button>
              {showCourses && (
                <div
                  className="ml-4 mt-2 space-y-2"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  <div className="mt-6">
                    <Link
                      href={"/courses/"}
                      onClick={() => setIsOpen(false)}
                      aria-label="Courses"
                    >
                      <p
                        className="text-[15px] text-[#120342] mb-2 active:bg-[#D8D1E8] active:p-1 active:pl-2  rounded-sm active:scale-[0.98] transition duration-100"
                        style={{ fontWeight: 600 }}
                      >
                        INSTRUMENTS
                      </p>
                    </Link>
                    <Link
                      aria-label="Piano Courses"
                      href="/courses/piano/"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Piano
                    </Link>
                    <Link
                      href="/courses/electronic-keyboard/"
                      aria-label="Electronic Keyboard Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Electronic Keyboard
                    </Link>
                    <Link
                      href="/courses/acoustic-guitar/"
                      aria-label="Acoustic Guitar Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Acoustic Guitar
                    </Link>
                    <Link
                      href="/courses/electric-guitar/"
                      aria-label="Electric Guitar Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Electric Guitar
                    </Link>
                    <Link
                      href="/courses/ukulele/"
                      aria-label="Ukulele Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Ukulele
                    </Link>
                    <Link
                      href="/courses/violin/"
                      aria-label="Violin Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Violin
                    </Link>
                    <Link
                      href="/courses/flute/"
                      aria-label="Flute Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Flute
                    </Link>
                    <Link
                      href="/courses/tabla/"
                      aria-label="Tabla Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Tabla
                    </Link>
                  </div>
                  <div className="mt-6">
                    <Link
                      href={"/courses/"}
                      aria-label="Courses"
                      onClick={() => setIsOpen(false)}
                    >
                      <p
                        className="text-[15px] text-[#120342] mb-2 active:bg-[#D8D1E8] active:p-1 active:pl-2  rounded-sm active:scale-[0.98] transition duration-100"
                        style={{ fontWeight: 600 }}
                      >
                        SINGING
                      </p>
                    </Link>
                    <Link
                      href="/courses/western-vocals/"
                      aria-label="Western Vocals Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Western Vocals
                    </Link>
                    <Link
                      href="/courses/carnatic-vocals/"
                      aria-label="Carnatic Vocals Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Carnatic Vocals
                    </Link>
                    <Link
                      href="/courses/hindustani-vocals/"
                      aria-label="Hindustani Vocals Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Hindustani Vocals
                    </Link>
                    <Link
                      href="/courses/bollywood-vocals/"
                      aria-label="Bollywood Vocals Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Bollywood Vocals
                    </Link>
                    <Link
                      href="/courses/kannada-music/"
                      aria-label="Kannada Music Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Kannada Music
                    </Link>
                    <Link
                      href="/courses/malayalam-music/"
                      aria-label="Malayalam Music Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Malayalam Music
                    </Link>
                    <Link
                      href="/courses/tamil-music/"
                      aria-label="Tamil Music Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Tamil Music
                    </Link>
                    <Link
                      href="/courses/telugu-music/"
                      aria-label="Telugu Music Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Telugu Music
                    </Link>
                  </div>
                  <div className="mt-6">
                    <Link
                      href={"/courses/"}
                      aria-label="Courses"
                      onClick={() => setIsOpen(false)}
                    >
                      <p
                        className="text-[15px] text-[#120342] mb-2 active:bg-[#D8D1E8] active:p-1 active:pl-2  rounded-sm active:scale-[0.98] transition duration-100"
                        style={{ fontWeight: 600 }}
                      >
                        DANCING
                      </p>
                    </Link>
                    <Link
                      href="/courses/bharatanatyam/"
                      aria-label="Bharatanatyam Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Bharatanatyam
                    </Link>
                    <Link
                      href="/courses/kathak/"
                      aria-label="Kathak Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Kathak
                    </Link>
                    <Link
                      href="/courses/bollywood-dance/"
                      aria-label="Bollywood Dance Courses"
                      onClick={() => setIsOpen(false)}
                      className="block text-[15px] text-[#130139] py-1 hover:font-bold active:bg-[#D8D1E8] pl-2 rounded-sm active:scale-[0.98] transition duration-100"
                    >
                      Bollywood Dance
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <div>
              <button
                className="flex justify-between items-center w-full text-[#24105EFE] text-[16px]  "
                aria-label="About"
                onClick={() => setShowAbout(!showAbout)}
              >
                About {showAbout ? <FaAngleUp /> : <FaAngleDown />}
              </button>
              {showAbout && (
                <div
                  className="ml-4 mt-2 space-y-2"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  <div className="mt-3">
                    <Link
                      href={"/company"}
                      onClick={() => setIsOpen(false)}
                      aria-label="Company"
                    >
                      <p
                        className="text-[15px] text-[#24105EFE] mb-2"
                        style={{ fontWeight: 400 }}
                      >
                        Company
                      </p>
                    </Link>
                    <Link
                      href={"/policy"}
                      aria-label="Policy"
                      onClick={() => setIsOpen(false)}
                    >
                      <p
                        className="text-[15px] text-[#24105EFE] mb-2"
                        style={{ fontWeight: 400 }}
                      >
                        Policy
                      </p>
                    </Link>
                  </div>
                </div>
              )}
              <button
                className="flex justify-between items-center w-full text-[#24105EFE] text-[16px] mt-4"
                aria-label="Resources"
                onClick={() => setShowResouces(!showResouces)}
              >
                Resources {showResouces ? <FaAngleUp /> : <FaAngleDown />}
              </button>
              {showResouces && (
                <div
                  className="ml-4 mt-2 space-y-2"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  <div className="mt-3">
                    <Link
                      href={"/blog"}
                      onClick={() => setIsOpen(false)}
                      aria-label="Blog"
                    >
                      <p
                        className="text-[15px] text-[#24105EFE] mb-2 active:bg-[#D8D1E8] px-2 py-1 rounded-sm active:scale-[0.98] transition duration-100"
                        style={{ fontWeight: 400 }}
                      >
                        Blog
                      </p>
                    </Link>
                    <Link
                      href={"/tools"}
                      onClick={() => setIsOpen(false)}
                      aria-label="Tools"
                    >
                      <p
                        className="text-[15px] text-[#24105EFE] mb-2 active:bg-[#D8D1E8] px-2 py-1 rounded-sm active:scale-[0.98] transition duration-100"
                        style={{ fontWeight: 400 }}
                      >
                        Tools
                      </p>
                    </Link>
                  </div>
                </div>
              )}
              <button
                className="flex justify-between items-center w-full text-[#24105EFE] text-[16px] mt-4"
                onClick={() => setShowSupport(!showSupport)}
                aria-label="Support"
              >
                Support {showSupport ? <FaAngleUp /> : <FaAngleDown />}
              </button>
              {showSupport && (
                <div
                  className="ml-4 mt-2 space-y-2"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  <div className="mt-3">
                    <Link
                      href={"/faq"}
                      onClick={() => setIsOpen(false)}
                      aria-label="FAQ"
                    >
                      <p
                        className="text-[15px] text-[#24105EFE] mb-2 active:bg-[#D8D1E8] px-2 py-1 rounded-sm active:scale-[0.98] transition duration-100"
                        style={{ fontWeight: 400 }}
                      >
                        FAQ
                      </p>
                    </Link>
                    <Link
                      href={"/contact-us"}
                      onClick={() => setIsOpen(false)}
                      aria-label="Contact Us"
                    >
                      <p
                        className="text-[15px] text-[#24105EFE] mb-2 active:bg-[#D8D1E8] px-2 py-1 rounded-sm active:scale-[0.98] transition duration-100"
                        style={{ fontWeight: 400 }}
                      >
                        Contact us
                      </p>
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <Link
              href="/teach-with-us/"
              aria-label="Teach With Us"
              onClick={() => setIsOpen(false)}
              className="text-[#24105EFE] text-[16px] active:bg-[#D8D1E8] active:p-1 active:pl-2  rounded-sm active:scale-[0.98] transition duration-100"
            >
              Teach With Us
            </Link>
            <Link
              href="/become-our-affiliate/"
              aria-label="Become Our Affiliate"
              onClick={() => setIsOpen(false)}
              className="text-[#24105EFE] text-[16px] active:bg-[#D8D1E8] active:p-1 active:pl-2   rounded-sm active:scale-[0.98] transition duration-100"
            >
              Become Our Affiliate
            </Link>
          </nav>
          <div className="lg:hidden w-fit bg-[#9506EE] flex items-center justify-center rounded-md  ml-4 mt-12 ">
            <Link
              className="text-[13px] text-white font-bold px-3 py-3 "
              href={"/book-trial"}
              aria-label="Book a Free Trial"
              onClick={() => setIsOpen(false)}
            >
              Book a Free Trial
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
