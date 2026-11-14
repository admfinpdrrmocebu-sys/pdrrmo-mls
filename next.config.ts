import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    inlineCss: true,
    optimizePackageImports: ["lucide-react", "motion"],
  },
  env: {
    mapbox_token: process.env.mapbox_token || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:
      (
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        "BIJ6Vz8cnZyFe76hVZqoHsGExgQIivB__UoW5eCjGgcWSbJzbJSDP6LIRloRYIlK--NIywmN_iVDR4VG8yqlbjc"
      )
        .replace(/^["']|["']$/g, "")
        .trim(),
  },
};

export default nextConfig;
