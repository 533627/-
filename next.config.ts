import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  reactStrictMode: true,
};

export default nextConfig;
