import Image from "next/image";
import Link from "next/link";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CourseShowcase } from "@/components/home/CourseShowcase";
import { TestimonialsCarousel } from "@/components/home/TestimonialsCarousel";
import { InstructorsCarousel } from "@/components/home/InstructorsCarousel";
import { LandingFooter } from "@/components/home/LandingFooter";
import { SectionErrorBoundary } from "@/components/common/SectionErrorBoundary";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-[#54595F] font-sans selection:bg-[#FF7703] selection:text-white pb-12 md:pb-0">
      {/* ─── Section 1: Hero Carousel ──────────────────────────────────── */}
      <SectionErrorBoundary name="HeroSlider">
        <HeroSlider />
      </SectionErrorBoundary>

      {/* ─── Section 2: 24/7 Support Banner & Four Pillars ─────────────── */}
      <section className="px-5 relative md:px-10 lg:px-32">
        {/* Floating Orange Ribbon */}
        <div className="relative bg-[#FF7703] py-4 px-4 md:px-12 rounded-lg flex items-center justify-end transform -translate-y-1/2 shadow-xl shadow-orange-950/20 max-w-6xl mx-auto">
          <div className="absolute ml-4 md:ml-10 -bottom-2 left-0 w-24 h-24 md:w-32 md:h-32">
            <Image
              src="/24-7-logo.png"
              alt="24/7 Logo"
              fill
              sizes="(max-width: 768px) 96px, 128px"
              className="object-contain"
            />
          </div>
          <div className="w-60 md:w-full text-right text-sm md:text-xl font-medium text-white tracking-wide">
            24/7 dedicated customer support team
          </div>
        </div>

        {/* Four Pillars Layout */}
        <div className="flex w-full flex-col lg:flex-row gap-8 lg:gap-12 justify-between items-center md:px-3 lg:px-7 pt-6 md:pt-12 lg:pt-20 md:pb-8 lg:pb-20 max-w-6xl mx-auto">
          {/* Left Text Block */}
          <div className="flex flex-col gap-4 lg:gap-6 w-full lg:max-w-md">
            <h2 className="text-[#1E1A4D] text-[28px] md:text-[42px] font-medium text-left custom-font-2 leading-tight">
              Exclusively At <span className="text-[#FF7703]">Gandharva!</span>
            </h2>
            <p className="text-[#54595F] text-[15px] md:text-[16px] leading-relaxed">
              Discover music and dance at your own pace with a personalized adaptive learning model
              tailored to your interests and growth. Benefit from a trusted, results-driven curriculum
              designed by industry experts to enhance your learning experience. Plus, enjoy numerous
              performance opportunities to build your confidence and sharpen your technical skills!
            </p>
          </div>

          {/* Right 2x2 Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full lg:max-w-2xl">
            {/* Pillar 1 */}
            <div className="w-full min-w-0 flex flex-row justify-between items-center border border-gray-200 rounded-2xl p-5 bg-white shadow-md hover:shadow-lg transition-shadow">
              <div className="min-w-0 pr-2">
                <div className="text-[#FF7703] font-semibold text-base">One-on-One</div>
                <div className="text-[#54595F] text-[13px] font-light">Live online sessions</div>
              </div>
              <div className="w-16 h-16 shrink-0 relative">
                <Image
                  src="/HomeSection2/1on1.webp"
                  alt="One on One"
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="w-full min-w-0 flex flex-row justify-between items-center border border-gray-200 rounded-2xl p-5 bg-white shadow-md hover:shadow-lg transition-shadow">
              <div className="min-w-0 pr-2">
                <div className="text-[#FF7703] font-semibold text-base">Customized</div>
                <div className="text-[#54595F] text-[13px] font-light">Results-Driven Curriculum</div>
              </div>
              <div className="w-16 h-16 shrink-0 relative">
                <Image
                  src="/HomeSection2/customized.png"
                  alt="Customized"
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="w-full min-w-0 flex flex-row justify-between items-center border border-gray-200 rounded-2xl p-5 bg-white shadow-md hover:shadow-lg transition-shadow">
              <div className="min-w-0 pr-2">
                <div className="text-[#FF7703] font-semibold text-base">Showcase</div>
                <div className="text-[#54595F] text-[13px] font-light">Your talent</div>
              </div>
              <div className="w-16 h-16 shrink-0 relative">
                <Image
                  src="/HomeSection2/showcase.webp"
                  alt="Showcase"
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="w-full min-w-0 flex flex-row justify-between items-center border border-gray-200 rounded-2xl p-5 bg-white shadow-md hover:shadow-lg transition-shadow">
              <div className="min-w-0 pr-2">
                <div className="text-[#FF7703] font-semibold text-base">Structured</div>
                <div className="text-[#54595F] text-[13px] font-light">Courses</div>
              </div>
              <div className="w-16 h-16 shrink-0 relative">
                <Image
                  src="/HomeSection2/structured.png"
                  alt="Structured"
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 3: Platform Key Features ───────────────────────────── */}
      <section className="flex flex-col items-center justify-center gap-10 pt-16 md:pt-20 md:pb-16 px-5 md:px-10 lg:px-24 max-w-7xl mx-auto">
        <h2 className="text-[#1E1A4D] text-[28px] md:text-[42px] font-medium text-center custom-font-2">
          Platform <span className="text-[#FF7703]">Key Features</span>
        </h2>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Feature 1 */}
          <div className="flex flex-col items-center bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <div className="h-52 w-full bg-[#FCCEE8]/30 flex justify-center items-center p-4 relative">
              <div className="relative w-44 h-40">
                <Image
                  src="/HomeSection3/img1.webp"
                  alt="Foundation Books"
                  fill
                  sizes="176px"
                  className="object-contain"
                />
              </div>
            </div>
            <div className="text-[#54595F] text-[15px] text-center font-normal px-5 py-6 leading-relaxed">
              Establish a Solid Foundation with Gandharva Books and Practice Videos!
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col items-center bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <div className="h-52 w-full bg-[#FCCEE8]/30 flex justify-center items-center p-4 relative">
              <div className="relative w-44 h-40">
                <Image
                  src="/HomeSection3/img2.webp"
                  alt="Adaptive Learning"
                  fill
                  sizes="176px"
                  className="object-contain"
                />
              </div>
            </div>
            <div className="text-[#54595F] text-[15px] text-center font-normal px-5 py-6 leading-relaxed">
              Progress at Your Own Speed with an Adaptive Learning Approach
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex flex-col items-center bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <div className="h-52 w-full bg-[#FCCEE8]/30 flex justify-center items-center p-4 relative">
              <div className="relative w-44 h-40">
                <Image
                  src="/HomeSection3/img3.webp"
                  alt="Musical Tools"
                  fill
                  sizes="176px"
                  className="object-contain"
                />
              </div>
            </div>
            <div className="text-[#54595F] text-[15px] text-center font-normal px-5 py-6 leading-relaxed">
              Practice Anytime with Musical Tools to Sharpen Your Skills
            </div>
          </div>

          {/* Feature 4 */}
          <div className="flex flex-col items-center bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <div className="h-52 w-full bg-[#FCCEE8]/30 flex justify-center items-center p-4 relative">
              <div className="relative w-44 h-40">
                <Image
                  src="/HomeSection3/img4.webp"
                  alt="Virtual Studio"
                  fill
                  sizes="176px"
                  className="object-contain"
                />
              </div>
            </div>
            <div className="text-[#54595F] text-[15px] text-center font-normal px-5 py-6 leading-relaxed">
              Unleash Your Creativity by Recording Your Own Songs in Gandharva’s Virtual Studio!
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 4: Stats Ribbon & Courses Showcase ──────────────────── */}
      <section className="bg-[#FCCEE8]/30 pb-16 pt-12 md:pt-16 mt-12 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Saffron Stats Bar */}
          <div className="py-8 md:py-6 px-6 md:px-16 mx-auto mb-12 items-center justify-around text-white bg-[#FF9E00] rounded-2xl shadow-xl flex flex-col md:flex-row gap-6 md:gap-0 max-w-5xl">
            <div className="flex flex-col items-center justify-center">
              <div className="text-3xl md:text-4xl font-bold tracking-wider">0+</div>
              <div className="text-sm md:text-base font-medium">Online Learners</div>
            </div>
            <div className="hidden md:block w-px h-12 bg-white/40" />
            <div className="w-32 h-px bg-white/30 md:hidden" />
            <div className="flex flex-col items-center justify-center">
              <div className="text-3xl md:text-4xl font-bold tracking-wider">0+</div>
              <div className="text-sm md:text-base font-medium">Countries</div>
            </div>
            <div className="hidden md:block w-px h-12 bg-white/40" />
            <div className="w-32 h-px bg-white/30 md:hidden" />
            <div className="flex flex-col items-center justify-center">
              <div className="text-3xl md:text-4xl font-bold tracking-wider">0+</div>
              <div className="text-sm md:text-base font-medium">Teachers</div>
            </div>
          </div>

          {/* Section Title */}
          <div className="text-center mb-8">
            <h2 className="text-[#1E1A4D] text-[28px] md:text-[42px] font-medium custom-font-2">
              Our <span className="text-[#FF7703]">Courses</span>
            </h2>
          </div>

          {/* Interactive Showcase Tabs & Cards */}
          <SectionErrorBoundary name="CourseShowcase">
            <CourseShowcase />
          </SectionErrorBoundary>
        </div>
      </section>

      {/* ─── Section 5: Testimonials Carousel ──────────────────────────── */}
      <section className="flex flex-col items-center justify-center pt-16 md:pt-24 pb-16 lg:pb-24 px-4 bg-white">
        <div className="pb-12 text-center">
          <h2 className="text-[#1E1A4D] text-[28px] md:text-[42px] font-medium custom-font-2">
            <span className="text-[#FF7703]">See What Our</span> Students Say{" "}
            <span className="text-[#FF7703]">About Us.</span>
          </h2>
        </div>
        <SectionErrorBoundary name="TestimonialsCarousel">
          <TestimonialsCarousel />
        </SectionErrorBoundary>
      </section>

      {/* ─── Section 6: Meet Our Instructors ────────────────────────────── */}
      <section className="flex flex-col bg-[#FCCEE8]/35 items-center justify-center pt-14 md:pt-20 pb-16 md:pb-24 px-4">
        <div className="pb-8 text-center">
          <h2 className="text-[#1E1A4D] text-[28px] md:text-[42px] font-medium custom-font-2">
            <span className="text-[#FF7703]">Meet Our</span> Talented{" "}
            <span className="text-[#FF7703]">Instructors</span>
          </h2>
        </div>
        <SectionErrorBoundary name="InstructorsCarousel">
          <InstructorsCarousel />
        </SectionErrorBoundary>
      </section>

      {/* ─── Section 7: Journey @ Gandharva ─────────────────────────────── */}
      <section className="flex flex-col items-center justify-center gap-10 pt-16 md:pt-24 pb-16 px-5 md:px-12 lg:px-24 max-w-6xl mx-auto">
        <h2 className="text-[#1E1A4D] text-[28px] md:text-[42px] font-medium text-center custom-font-2">
          Journey @ <span className="text-[#FF7703]">Gandharva!</span>
        </h2>

        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 mt-4">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center max-w-xs">
            <div className="w-56 h-32 rounded-full bg-[#FCCEE8]/50 flex justify-center items-center overflow-hidden relative shadow-sm">
              <Image
                src="/HomeSection7/img1.webp"
                alt="Enroll"
                fill
                sizes="224px"
                className="object-contain p-3"
              />
            </div>
            <h3 className="text-2xl font-medium mt-4 custom-font-2 text-[#24105E]">
              Enroll
            </h3>
            <p className="text-gray-600 text-sm md:text-base font-light mt-1 px-4">
              Enroll in a course that suits your passion.
            </p>
          </div>

          {/* Doodle Arrow 1 */}
          <div className="w-20 md:w-28 h-auto relative hidden md:block">
            <Image
              src="/HomeSection7/doodle.webp"
              alt="Arrow"
              width={112}
              height={40}
              className="w-full h-auto object-contain filter hue-rotate-[55deg]"
            />
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center max-w-xs">
            <div className="w-56 h-32 rounded-full bg-[#FCCEE8]/50 flex justify-center items-center overflow-hidden relative shadow-sm">
              <Image
                src="/HomeSection7/img2.webp"
                alt="Get Trained"
                fill
                sizes="224px"
                className="object-contain p-3"
              />
            </div>
            <h3 className="text-2xl font-medium mt-4 custom-font-2 text-[#24105E]">
              Get Trained
            </h3>
            <p className="text-gray-600 text-sm md:text-base font-light mt-1 px-4">
              Personalized one-on-one live sessions.
            </p>
          </div>

          {/* Doodle Arrow 2 */}
          <div className="w-20 md:w-28 h-auto relative hidden md:block">
            <Image
              src="/HomeSection7/doodle.webp"
              alt="Arrow"
              width={112}
              height={40}
              className="w-full h-auto object-contain filter hue-rotate-[55deg]"
            />
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center max-w-xs">
            <div className="w-56 h-32 rounded-full bg-[#FCCEE8]/50 flex justify-center items-center overflow-hidden relative shadow-sm">
              <Image
                src="/HomeSection7/img3.webp"
                alt="Certification"
                fill
                sizes="224px"
                className="object-contain p-3"
              />
            </div>
            <h3 className="text-2xl font-medium mt-4 custom-font-2 text-[#24105E]">
              Certification
            </h3>
            <p className="text-gray-600 text-sm md:text-base font-light mt-1 px-4">
              Submit a skill evaluation video for certification.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Section 8: Why Grades Certifications ──────────────────────── */}
      <section className="py-16 md:py-24 px-4 max-w-7xl mx-auto">
        <h2 className="text-[28px] md:text-[40px] text-[#1A022D] text-center custom-font-2 mb-12">
          Why Grades <span className="text-[#FF7703]">Certifications</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-center">
          {/* Card 1 */}
          <div className="p-6 flex flex-col items-center bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-full bg-[#FFECFE] rounded-xl flex items-center justify-center p-4 h-48 relative">
              <Image
                src="/3d-education-concept-icon-globe-planet-earth-in-mortarboard-school-tourism-travel-concept-3d-render-illustration-png.webp"
                alt="Internationally Recognized"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                className="object-contain p-2"
              />
            </div>
            <p className="text-[16px] font-medium text-[#54595F] pt-4 text-center">
              Internationally Recognized
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 flex flex-col items-center bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-full bg-[#FFECFE] rounded-xl flex items-center justify-center p-4 h-48 relative">
              <Image
                src="/gerente-proyecto-agencia-negocios-startup-3d_66255-1990-removebg-preview.webp"
                alt="Milestones in your Musical Journey"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                className="object-contain p-2"
              />
            </div>
            <p className="text-[16px] font-medium text-[#54595F] pt-4 text-center">
              Milestones in your Musical Journey
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 flex flex-col items-center bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-full bg-[#FFECFE] rounded-xl flex items-center justify-center p-4 h-48 relative">
              <Image
                src="/uploads-sohpia-is-playing-a-guitar-512.webp"
                alt="Builds Rigour & Practice Discipline"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                className="object-contain p-2"
              />
            </div>
            <p className="text-[16px] font-medium text-[#54595F] pt-4 text-center">
              Builds Rigour & Practice Discipline
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 flex flex-col items-center bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-full bg-[#FFECFE] rounded-xl flex items-center justify-center p-4 h-48 relative">
              <Image
                src="/estatuilla-hombre-tocando-guitarra_1187092-198781-removebg-preview.webp"
                alt="Remove Performance Fear"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                className="object-contain p-2"
              />
            </div>
            <p className="text-[16px] font-medium text-[#54595F] pt-4 text-center">
              Remove Performance Fear
            </p>
          </div>
        </div>
      </section>

      {/* ─── Section 9: SEO & Educational Two-Column Article Block ──────── */}
      <section className="bg-gradient-to-b from-[#24105E] via-[#3C096C] to-[#24105E] text-white py-16 px-4 sm:px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {/* Left Column Card */}
          <div className="rounded-3xl bg-white/[0.04] p-6 sm:p-8 backdrop-blur-xs shadow-2xl space-y-5 transition-all">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FF7703]/20 text-[#FF9E00] tracking-wide uppercase">
              Academy Insights
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
              Gandharva School of Music : Virtual Music Lessons for All Skill Levels
            </h3>
            <div className="space-y-3 text-xs sm:text-[13px] leading-relaxed text-purple-100/85">
              <p>
                If you’re a beginner to music or simply interested in learning a musical instrument,
                you’ve likely come across various online music lessons. If you’ve been searching for
                the right program without success, you might want to explore the courses offered by
                Gandharva School of Music. These lessons cover the fundamentals of music and teach you
                how to play different instruments. The great thing about virtual music classes is that
                you can enjoy learning from the comfort of your home.
              </p>
              <p>
                There are several choices for online music lessons, and trial classes are an excellent
                way to understand the format before committing. At Gandharva School of Music, we offer
                free trial sessions to help you evaluate the instructor’s expertise. Additionally, we
                provide structured music certification courses, perfect for those seeking a more
                synchronized learning experience. There are numerous reasons why enrolling in
                Gandharva’s music classes is beneficial.
              </p>
              <p>
                One of the main advantages of online music lessons is affordability. Pre-recorded or
                text-based materials can reduce costs since they don’t demand a teacher’s physical
                presence. The lessons are accessible 24/7, allowing you to fit them into your personal
                schedule. Plus, you have the flexibility to set the lesson duration according to your
                convenience.
              </p>
            </div>

            <div className="pt-2">
              <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight pb-2">
                Fantastic Courses to Master Musical Instruments
              </h4>
              <p className="text-xs sm:text-[13px] leading-relaxed text-purple-100/85">
                The components of music are the instruments that bring it to life, making each melody
                distinctive and captivating. You can explore learning a range of instruments online,
                including the electric keyboard, acoustic guitar, and piano. These are essential tools
                for any composer looking to craft a musical masterpiece. Whether you’re a beginner or
                aiming for advanced proficiency, there are courses tailored for all levels. Popular
                instruments like the guitar, piano, and keyboard are widely used across Western, pop,
                and Indian music genres.
              </p>
            </div>

            <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-medium text-purple-200">
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.07] flex items-center gap-1">
                <span className="text-accent font-bold">✓</span> 1:1 Live Lessons
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.07] flex items-center gap-1">
                <span className="text-accent font-bold">✓</span> Global Certifications
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.07] flex items-center gap-1">
                <span className="text-accent font-bold">✓</span> Flexible 24/7 Scheduling
              </span>
            </div>
          </div>

          {/* Right Column Card */}
          <div className="rounded-3xl bg-white/[0.04] p-6 sm:p-8 backdrop-blur-xs shadow-2xl space-y-5 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#9506EE]/30 text-purple-200 tracking-wide uppercase">
                Educational Benefits
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                The Future and Advantages of Learning Music Online
              </h3>
              <div className="space-y-3 text-xs sm:text-[13px] leading-relaxed text-purple-100/85">
                <p>
                  Whether it’s classical or modern, music has a profound impact on our thinking. It
                  allows us to understand ourselves better and deepens our learning experience. The
                  power of a musical instrument is so immense that it can even aid in healing various
                  ailments. Listening to and practicing music enhances focus, making it a remarkable
                  educational tool.
                </p>
                <p>
                  In addition to honing aural abilities, musical training strengthens language processing
                  skills. It helps in distinguishing different sounds and improving speech and language
                  abilities, contributing significantly to cognitive development. For children, music is
                  an essential part of their educational journey, unlike many other traditional subjects.
                </p>
                <p>
                  One of the major advantages of online music learning is the flexibility it offers.
                  Whether you’re working full-time, studying during your lunch break, or taking classes on
                  weekends, you can tailor the schedule to your needs. With online music classes, there’s
                  no pressure to attend at specific times, making it ideal for those juggling multiple
                  responsibilities.
                </p>
                <p>
                  Additionally, online classes eliminate the costs associated with transportation and
                  studio fees. You can connect to your lessons anytime, anywhere, without the
                  distractions of a noisy classroom. With fewer interruptions and the ability to focus
                  solely on the material, online learning offers a more personalized and effective
                  approach to mastering music. Plus, listening to music while studying enhances
                  concentration and retention.
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap gap-2 text-[11px] font-medium text-purple-200 mt-4">
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.07] flex items-center gap-1">
                <span className="text-[#FF9E00] font-bold">✓</span> Zero Commute & Studio Fees
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.07] flex items-center gap-1">
                <span className="text-[#FF9E00] font-bold">✓</span> Cognitive & Aural Training
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.07] flex items-center gap-1">
                <span className="text-[#FF9E00] font-bold">✓</span> Learn at Your Own Pace
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 10: 24/7 Dedicated Support Strip ──────────────────── */}
      <div>
        <p className="bg-[#FF9E00] py-4 md:py-5 text-white text-[18px] md:text-[22px] text-center font-medium tracking-wide">
          24/7 Dedicated Customer Support
        </p>
      </div>

      {/* ─── Section 11: Floating WhatsApp Button ──────────────────────── */}
      <a
        href="https://wa.me/918092621301"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact on WhatsApp"
        className="fixed bottom-16 md:bottom-6 right-6 z-40 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full w-14 h-14 md:w-16 md:h-16 flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95"
      >
        <svg
          stroke="currentColor"
          fill="currentColor"
          viewBox="0 0 448 512"
          className="w-7 h-7 md:w-8 md:h-8"
        >
          <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
        </svg>
      </a>

      {/* ─── Section 12: Mobile Fixed Bottom CTA Bar ────────────────────── */}
      <div className="fixed bottom-0 z-40 w-full bg-[#3C096C] flex items-center justify-center h-12 md:hidden shadow-lg">
        <Link
          href="/book-trial"
          className="text-[15px] text-white font-bold tracking-wide hover:text-purple-200 transition-colors"
        >
          Book a Free Trial Now
        </Link>
      </div>

      {/* ─── Section 13: Landing Footer ─────────────────────────────────── */}
      <LandingFooter />
    </div>
  );
}
