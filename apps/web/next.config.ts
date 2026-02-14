import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@focus-reader/shared",
    "@focus-reader/db",
    "@focus-reader/api",
    "@focus-reader/parser",
  ],
};

export default nextConfig;
