import Link from "next/link";
import React from "react";

function BookFreeTrial() {
  return (
    <div className="fixed bottom-0 z-50 w-full bg-[#3C096C] flex items-center justify-center h-12 md:hidden">
      <Link
        className="text-[15px] text-white font-bold"
        href={"/book-trial"}
        aria-label="Book a Free Trial"
      >
        Book a Free Trial Now
      </Link>
    </div>
  );
}

export default BookFreeTrial;
