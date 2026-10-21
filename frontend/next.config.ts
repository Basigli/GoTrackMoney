import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The default development indicator covers the Home tab on mobile.
  devIndicators: false,
};

export default nextConfig;
