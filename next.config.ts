import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    mapbox_token: process.env.mapbox_token || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "",
  },
};

export default nextConfig;
