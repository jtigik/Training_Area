import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone para a imagem Docker enxuta (ver Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
};

export default nextConfig;
