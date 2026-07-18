import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: process.env.VERCEL ? undefined : "standalone",
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // lucide-react is imported broadly across components as named imports;
  // without this Next.js bundles the whole icon set into shared chunks
  // instead of tree-shaking to just the icons actually used per route.
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  webpack(config) {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /node_modules\/jose\/dist\/webapi\/lib\/deflate\.js/,
        message: /A Node\.js API is used/,
      },
    ];
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" }
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; connect-src 'self' https: wss: ws:; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
          { key: "X-XSS-Protection", value: "0" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ]
      },
      {
        // Content-hashed build output — safe to cache forever; overrides the
        // no-store rule above so repeat page loads/navigations don't re-fetch
        // unchanged JS/CSS chunks.
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ]
      },
      {
        source: "/_next/image(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ]
      }
    ];
  }
};

export default withBundleAnalyzer(nextConfig);
