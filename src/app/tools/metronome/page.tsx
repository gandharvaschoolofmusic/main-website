import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import React from "react";

export const metadata: Metadata = {
  title: "Free Online Metronome | Gandharva School Of Music",
  description:
    "Practice music online with Gandharva School of Music's virtual metronome, designed to help you maintain a consistent tempo and synchronize seamlessly with other musicians.",
  alternates: {
    canonical: "/tools/metronome/",
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
            Online Metronome
          </h1>
        </div>
      </section>
      <section className=" py-10 ">
        <div className="flex flex-col md:flex-row justify-evenly items-center">
          <div>
            <Image
              src={"/Online-Metronome.avif"}
              width={400}
              height={400}
              alt="Metronome"
            />
          </div>
          <div>
            <iframe
              src="https://guitarapp.com/metronome.html?embed=true&tempo=120&timeSignature=2&pattern=1&theme=light"
              title="Online Metronome"
              style={{
                width: "360px",
                height: "520px",
                border: "none",
                borderRadius: "4px",
              }}
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
            What is the role of a metronome when practicing music?
          </h2>
          <p
            className="text-[#424242] text-[16px]  text-center "
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
          >
            When playing in a band or recording a song, multiple musicians are
            involved, making it crucial to maintain a consistent tempo, beat, or
            speed across all players. If each musician performs perfectly but at
            varying tempos, the result would be chaotic. To avoid this, a shared
            tempo is essential, and a metronome ensures that everyone stays
            synchronized. This online metronome is an excellent tool for
            developing a steady tempo and is especially helpful when learning to
            play an instrument or collaborating with other musicians. It is
            versatile and can be used with any instrument, including keyboards,
            guitars, drums, pianos, saxophones, violins, ukuleles, and more.
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
