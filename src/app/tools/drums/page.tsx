import { Metadata } from "next";
import Link from "next/link";
import React from "react";

export const metadata: Metadata = {
  title: "Free Online Drums| Gandharva School Of Music",
  description:
    "Practice drumming online with Gandharva School of Music's virtual drums, designed to help you maintain a consistent tempo and synchronize seamlessly with other musicians.",
  alternates: {
    canonical: "/tools/drums/",
  },
};

function ToolPage() {
  return (
    <div>
      <section className="bg-[#1A022D] w-full h-[50vh] md:h-[60vh] bg-no-repeat bg-top bg-cover flex flex-col items-start justify-center py-10 px-4">
        <div className="md:px-[10%] py-5 md:p-[10%] px-1 md:w-[67%]">
          <h1
            className="text-[32px] w-full  text-left md:text-[54px] text-white mb-6 mt-12 md:mt-28 "
            style={{
              fontFamily: "var(--font-vidaloka)",
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            Virtual Drums
          </h1>
        </div>
      </section>
      <section className=" py-10 ">
        <div className="flex items-center justify-center mt-8 mx-3">
          <div className="w-full max-w-[1180px] ">
            <iframe
              src="https://4four.io/embed/frum"
              title="Online drums"
              style={{
                width: "100%",
                height: "500px",
                border: "none",
                borderRadius: "4px",
              }}
              allowFullScreen
            />
          </div>
        </div>

        <div className="p-10 md:p-30">
          <h2
            className="text-[#1A022D] text-[20px] md:text-[40px] text-center mb-7 md:px-80"
            style={{
              fontFamily: "var(--font-vidaloka)",
              fontWeight: 500,
            }}
          >
            What is the role of a Drums when practicing music?
          </h2>
          <p
            className="text-[#424242] text-[16px]  text-center "
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
          >
            When playing drums, especially in a band or recording session,
            maintaining a consistent tempo is vital to ensure synchronization
            with other musicians. Even if each player performs flawlessly,
            differing tempos can create chaos. A steady beat is crucial, and a
            metronome helps drummers stay on track, providing a unified rhythm
            for the entire group. This online metronome is a fantastic tool for
            building and maintaining a stable tempo, which is essential when
            learning to play drums or collaborating with other musicians. It is
            versatile and supports drummers in coordinating seamlessly with
            other instruments, such as guitars, keyboards, bass, and more.
          </p>
        </div>
      </section>
      <section className="bg-[url(/Untitled-design-3-scaled.avif)] w-full h-[100vh] md:h-[80vh] bg-no-repeat  bg-cover flex flex-col items-center justify-center py-10 px-4 text-center text-white bg-[#3c096c]">
        <h3
          className="text-[26px] md:text-[40px] text-[#1A020D] mb-4"
          style={{
            fontFamily: "var(--font-vidaloka)",
            fontWeight: 500,
          }}
        >
          Learn Music Easily in Just{" "}
          <span className="text-[#FF7703]">3 Simple Steps</span>
        </h3>
        <div className="flex flex-col md:flex-row justify-between  gap-8 md:gap-16">
          <div>
            <h4
              className="text-[26px] md:text-[34px] text-[#1A022D]"
              style={{
                fontFamily: "var(--font-vidaloka)",
                fontWeight: 400,
              }}
            >
              1. Book
            </h4>
            <p
              className="text-[#424242] text-[17px]"
              style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
            >
              Book a free demo, and we’ll reach out to you promptly.
            </p>
          </div>
          <div>
            <h4
              className="text-[26px] md:text-[34px] text-[#1A022D]"
              style={{
                fontFamily: "var(--font-vidaloka)",
                fontWeight: 400,
              }}
            >
              2. Experience
            </h4>
            <p
              className="text-[#424242] text-[17px]"
              style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
            >
              Experience unparalleled learning with guidance from industry
              professionals.
            </p>
          </div>
          <div>
            <h4
              className="text-[26px] md:text-[34px] text-[#1A022D]"
              style={{
                fontFamily: "var(--font-vidaloka)",
                fontWeight: 400,
              }}
            >
              3. Start
            </h4>
            <p
              className="text-[#424242] text-[17px]"
              style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
            >
              Join us today and begin your musical journey!
            </p>
          </div>
        </div>
        <Link href="/book-trial" aria-label="Book a free trial now">
          <button
            aria-label="Book a free trial now"
            className="bg-[#FF9E00] px-8 py-3 rounded-lg mt-3 md:mt-15 text-[16px] cursor-pointer hover:bg-[#e08b00] transition-colors"
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
          >
            Book a free trial now
          </button>
        </Link>
      </section>
      <div>
        <p
          className="bg-[#FF9E00]  py-5 rounded-lg text-white text-[19px] md:text-[24px] text-center "
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
        >
          24/7 Dedicated Customer Support
        </p>
      </div>
    </div>
  );
}

export default ToolPage;
