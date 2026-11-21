import type { NextConfig } from "next";

import { buildSecurityHeaders } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Gera .next/standalone para a imagem Docker enxuta (ver Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Headers de segurança em todas as rotas (TA-033).
  async headers() {
    return [{ source: "/:path*", headers: buildSecurityHeaders({ isDev }) }];
  },
};

export default nextConfig;
