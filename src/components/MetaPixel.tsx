"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Pixel = ((...args: unknown[]) => void) & {
  queue: unknown[][];
  callMethod?: (...args: unknown[]) => void;
  push?: Pixel;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window { fbq?: Pixel; _fbq?: Pixel }
}

export function MetaPixel({ id }: { id: string }) {
  const path = usePathname();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (!path || !/^\/(?:$|(?:courses|blog|faq|book-trial|thank-you|teach-with-us)(?:\/|$))/.test(path)) {
      previous.current = null;
      return;
    }
    if (previous.current === path) return;
    if (!window.fbq) {
      const pixel: Pixel = Object.assign((...args: unknown[]) => {
        if (pixel.callMethod) pixel.callMethod(...args);
        else pixel.queue.push(args);
      }, { queue: [] as unknown[][], loaded: true, version: "2.0" });
      pixel.push = pixel;
      window.fbq = window._fbq = pixel;
      pixel("set", "autoConfig", false, id);
      pixel("init", id);
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    window.fbq("trackSingle", id, "PageView");
    previous.current = path;
  }, [id, path]);
  return null;
}
