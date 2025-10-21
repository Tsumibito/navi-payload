import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    // Не блокировать production билд из-за ESLint ошибок
    // Линтинг выполняется на этапе разработки
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Не блокировать production билд из-за TypeScript ошибок
    // Проверка типов выполняется на этапе разработки
    ignoreBuildErrors: true,
  },
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
