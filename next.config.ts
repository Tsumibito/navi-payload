import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-c14094474319495887321b74b5186100.r2.dev',
      },
    ],
  },
};

export default withPayload(nextConfig);
