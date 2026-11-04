import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.erewhon.com" },
      {
        protocol: "https",
        hostname: "erewhonappsftp.s3.us-west-2.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
