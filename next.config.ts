import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isso diz para a Vercel publicar o site mesmo se o ESLint reclamar de algo
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;