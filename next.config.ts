import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep craft screenshots and the marketing surface free of the corner badge.
  devIndicators: false,
  transpilePackages: ["@closing-bell/fairness"],
};

export default nextConfig;
