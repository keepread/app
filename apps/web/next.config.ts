import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev({
  persist: { path: "../../.wrangler/state/v3" },
});

const nextConfig: NextConfig = {
  transpilePackages: [
    "@focus-reader/shared",
    "@focus-reader/db",
    "@focus-reader/api",
    "@focus-reader/parser",
  ],
};

export default nextConfig;
