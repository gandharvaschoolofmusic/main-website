import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress response payloads (HTML, JSON, RSC) via Gzip / Brotli
  compress: true,
  poweredByHeader: false,
  // Allow Cloudflare Tunnel domains for Dev HMR and asset serving
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.cloudflare.com",
    "localhost:3000",
  ],
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "date-fns-tz",
      "react-icons",
      "react-select",
      "framer-motion",
      "motion/react",
      "clsx",
      "tailwind-merge",
      "@prisma/client",
    ],
    serverActions: {
      bodySizeLimit: "25mb",
      allowedOrigins: [
        "*.trycloudflare.com",
        "*.cloudflare.com",
        "localhost:3000",
      ],
    },
  },
  async redirects() {
    return [
      {
        source: "/book-your-free-trial",
        destination: "/book-trial",
        permanent: true,
      },
      {
        source: "/book-your-free-trial/:path*",
        destination: "/book-trial",
        permanent: true,
      },
      {
        source: "/teachers",
        destination: "/courses",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
