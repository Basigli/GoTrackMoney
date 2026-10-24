import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The default development indicator covers the Home tab on mobile.
  devIndicators: false,
  async headers() {
    return [{ source: '/ocr/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  },
};

export default nextConfig;
