import { Metadata } from "next";
import Link from "next/link";
import React from "react";

export const metadata: Metadata = {
  title: "Free Online Musical Instruments Tools | Gandharva School Of Music",
  description:
    "Explore free online music tools like a guitar tuner, metronome, virtual piano, and drums at Gandharva School of Music to perfect your skills!",
  alternates: {
    canonical: "/tools/",
  },
};

const tools = [
  {
    imageSrc: "/Untitled-500-x-250-px-1.avif",
    title: "Guitar",
    url: "/tools/guitar/",
    description:
      "Use a guitar tuner to hone your skills and stay perfectly in tune.",
  },
  {
    imageSrc: "/metronome.avif",
    title: "Metronome",
    description: "Practice with a Metronome and always stay in perfect rhythm.",
    url: "/tools/metronome/",
  },
  {
    imageSrc: "/Untitled-500-x-250-px-2.avif",
    title: "Piano",
    description:
      "You can stay sharp and in tune with consistent practice on a Virtual Piano.",
    url: "/tools/piano-tools/",
  },
  {
    imageSrc: "/Untitled-500-x-250-px-3.avif",
    title: "Drums",
    description:
      "Use our online Drums to refine your skills and hit every beat perfectly.",
    url: "/tools/drums/",
  },
];

function ToolsPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-[url(/tool-photos.avif)] w-full h-[75vh] md:h-[75vh] bg-no-repeat bg-top bg-cover flex flex-col items-start justify-center py-10 px-4">
        <div className="md:px-[10%] py-5 md:p-[10%] px-1 md:w-[67%]">
          <h1
            className="text-[32px] w-full md:w-2/3 text-left md:text-[48px] text-white mb-6 mt-12 md:mt-28 "
            style={{
              fontFamily: "var(--font-vidaloka)",
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            Online Tools
          </h1>
          <div className="mt-8">
            <span
              className="text-[16px] md:text-[17px] text-white"
              style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
            >
              Welcome to Gandharva&apos;s Free Tools! Enhance your skills with
              our smart resources, guiding you to mastery beyond your sessions.
            </span>
          </div>
        </div>
      </section>
      {/* <section className="md:px-[10%] mt-20 px-1 ">
        <div className="w-full">
          <h2
            className="
                  text-[26px] md:text-[46px]
                  text-[#1A022D] text-center
                  "
            style={{ fontFamily: "var(--font-vidaloka)", fontWeight: 500 }}
          >
            Gandharva&apos;s{" "}
            <span className="text-[#FF7703]">Online Tools</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-5 mx-auto border-2 w-full">
            {tools.map((tool, index) => (
              <ToolCard key={index} {...tool} />
            ))}
          </div>
        </div>
      </section> */}
      <section className="md:px-[10%] mt-20 px-4">
        <div className="w-full">
          <h2
            className="text-[26px] md:text-[46px] text-[#1A022D] text-center mb-8"
            style={{ fontFamily: "var(--font-vidaloka)", fontWeight: 500 }}
          >
            Gandharva&apos;s{" "}
            <span className="text-[#FF7703]">Online Tools</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-screen-xl mx-auto px-4">
            {tools.map((tool, index) => (
              <ToolCard key={index} {...tool} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[url(/Untitled-design-3-scaled.avif)] w-full h-[100vh] md:h-[70vh] bg-no-repeat bg-cover flex flex-col items-center justify-center py-10 px-4 text-center mt-20 text-white bg-[#3c096c]">
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
        <div className="flex flex-col md:flex-row justify-between mt-10  gap-8 md:gap-16">
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
        <Link
          href={"/book-trial"}
          className="mt-10"
          aria-label="Book a free trial now"
        >
          <button
            aria-label="Book a free trial now"
            className="bg-[#FF9E00] px-8 py-3 rounded-lg mt-3 md:mt-15 text-[16px] "
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

type TooCardProp = {
  imageSrc?: string;
  imageSrcMobile?: string;
  title: string;
  description: string;
  url: string;
};

const ToolCard = ({
  imageSrc,
  imageSrcMobile,
  title,
  url,
  description,
}: TooCardProp) => {
  return (
    <div className="max-w-xs rounded-2xl shadow-lg overflow-hidden bg-[#F5F5F5] ">
      <Link href={url} aria-label="Click to explore the tool">
        <div className="relative">
          <img
            src={imageSrc}
            srcSet={`${imageSrcMobile} 480w, ${imageSrc} 1024w`}
            alt={title}
            className="w-full h-48 object-cover"
          />
          <h2
            className="absolute bottom-5  text-white text-center text-2xl w-full"
            style={{
              fontFamily: "var(--font-vidaloka)",
              fontWeight: 500,
            }}
          >
            {title}
          </h2>
        </div>
        <div
          className="p-5 text-gray-600 text-center"
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
        >
          {description}
        </div>
      </Link>
    </div>
  );
};

export default ToolsPage;
