"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Mic2, Gift, X } from "lucide-react";

interface PopupProps {
  onClose: () => void;
}

export default function ValentineSpecialOfferPopup({ onClose }: PopupProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      onClose(); // 🔥 inform parent
    }, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Popup */}
      <div className="relative w-full max-w-[95%] md:max-w-4xl max-h-[98vh] overflow-hidden rounded-3xl shadow-2xl bg-white grid grid-cols-1 md:grid-cols-12 animate-scaleIn">

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition z-50 cursor-pointer"
        >
          <X size={20} className="text-rose-600" />
        </button>

        {/* LEFT SIDE */}
       <div className="md:col-span-7 relative flex flex-col items-center justify-center p-4 md:p-12 bg-gradient-to-br from-rose-600 via-pink-600 to-red-700 text-white overflow-hidden">

          <Heart className="absolute top-10 left-10 w-16 h-16 text-yellow-300 opacity-80 animate-pulse" />
          <Heart className="absolute bottom-16 right-16 w-20 h-20 text-yellow-400 opacity-70 animate-pulse" />
          <Heart className="absolute top-1/3 right-10 w-12 h-12 text-yellow-200 opacity-60 animate-pulse" />

          <div className="relative text-center max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Valentine Season Offer 💖
            </h1>

            <p className="text-xl md:text-2xl font-medium mb-6">
              Surprise Your Love with a Romantic Music
            </p>

            <div className="flex items-center justify-center gap-3 mb-6">
              <Mic2 className="text-yellow-300" />
              <p className="text-lg md:text-xl">
                Feel the emotion where you and your partner sing your favourite romantic
                song together in a beautiful rose-themed musical evening.
              </p>
            </div>

            <div className="mt-8 mx-auto w-fit bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-lg font-semibold py-2 px-6 rounded-full shadow-lg text-center">
              ❤️ Flat 20% OFF on Joining the Course ❤️
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="md:col-span-5 bg-white flex flex-col justify-center p-4 md:p-10 text-center">

          <div className="text-center mb-6">
            <Gift className="mx-auto text-rose-500 mb-2" size={32} />
            <h2 className="text-2xl font-bold text-rose-600">
              Gift Music to Your Love
            </h2>
          </div>

          <ul className="space-y-4 text-gray-700 text-sm">
            <li>🎤 Present your favourite song to your partner.</li>
            <li>🎁 Gift this romantic music course.</li>
            <li>💘 Only 5 special sessions.</li>
            <li>🔥 Exclusive 20% Valentine Discount.</li>
          </ul>

          
          <button
            onClick={() => router.push("/book-trial")}
            className="mt-8 w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-blue-500 hover:to-indigo-600 text-white py-3 rounded-2xl font-semibold shadow-lg transition-all duration-300 ease-in-out cursor-pointer"
          >
            Book Free Trial 💕
          </button>

          <div className="mt-6 flex items-center justify-center">
            <div className="inline-flex bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-black font-bold text-sm px-6 py-3 rounded-full shadow-lg animate-pulse whitespace-nowrap">
              LIMITED TIME OFFER
            </div>
          </div>

        </div>
      </div>

      <style jsx>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
