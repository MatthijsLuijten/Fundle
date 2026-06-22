import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.funda.nl" },
      { protocol: "https", hostname: "**.funda.io" },
    ],
  },
};

export default nextConfig;
