import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
    // Allow blob URLs for local previews
    dangerouslyAllowSVG: true,
    unoptimized: true,
  },
};

export default nextConfig;
