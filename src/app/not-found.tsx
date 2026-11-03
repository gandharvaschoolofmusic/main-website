import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 overflow-hidden">
      {/* Warm stage background glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, #d4a373 0%, rgba(20, 20, 20, 0) 70%)",
        }}
      />

      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Official Brand Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/" className="inline-block transition-opacity hover:opacity-90">
            <Image
              src="/cropped-Add-a-subheading-5-png-scaled.webp"
              alt="Gandharva School of Music"
              width={160}
              height={50}
              className="h-11 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Decorative Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium uppercase tracking-widest mb-6">
          <span>Error 404</span>
          <span className="w-1 h-1 rounded-full bg-amber-400" />
          <span>Out of Tune</span>
        </div>

        {/* Serif Heading */}
        <h1 className="font-serif text-4xl sm:text-5xl font-normal text-text-primary tracking-tight mb-4">
          Lost in the Sound
        </h1>

        <p className="text-text-secondary text-base sm:text-lg mb-8 leading-relaxed max-w-md mx-auto">
          We couldn&apos;t find the stage, lesson, or profile you were looking for.
          The link may have moved or was mistyped.
        </p>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#9506ee] hover:bg-[#8200da] text-white font-medium text-sm transition-all shadow-lg shadow-purple-950/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            Back to Home
          </Link>
          <Link
            href="/courses"
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-surface-3 hover:border-amber-500/40 bg-surface-1 hover:bg-surface-2 text-text-primary font-medium text-sm transition-all"
          >
            Explore Courses
          </Link>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-surface-3 hover:border-surface-4 bg-surface-1/60 text-text-secondary hover:text-text-primary font-medium text-sm transition-all"
          >
            Dashboard
          </Link>
        </div>

        {/* Visual Instrument Detail */}
        <div className="mt-12 pt-8 border-t border-surface-2 text-text-tertiary text-xs flex items-center justify-center gap-3">
          <span>Gandharva School of Music</span>
          <span>•</span>
          <span>Studio Audio Platform</span>
        </div>
      </div>
    </div>
  );
}
