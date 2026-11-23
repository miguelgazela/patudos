import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // O browser deve verificar sempre se há uma versão nova do service worker.
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
  // Fotos já reduzidas no cliente (≤ 1,5 MB) vão no corpo da Server Action.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // O PDF lê fontes e imagens com `fs` (a Vercel só leva para a função o que o rastreio vê).
  outputFileTracingIncludes: {
    "/animais/[id]/pdf/ficha": [
      "./src/lib/pdf/fonts/**/*",
      "./src/lib/pdf/assets/**/*",
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Sourcemaps só são enviados se `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT` estiverem
// definidos (na Vercel); sem eles o build corre na mesma, sem Sentry.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
