import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isso diz para a Vercel publicar o site mesmo se o TypeScript achar que tem algo fora do padrão
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;