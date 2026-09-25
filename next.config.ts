import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Photos de profil Instagram publiques servies par l'API Centurie.
    remotePatterns: [{ protocol: "https", hostname: "api.centuriegrowth.com", pathname: "/instagram/pdp/**" }],
  },
};

export default nextConfig;
