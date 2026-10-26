import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Photos de profil Instagram publiques servies par l'API Centurie.
    remotePatterns: [{ protocol: "https", hostname: "api.centuriegrowth.com", pathname: "/instagram/pdp/**" }],
  },
  // Le cours et la banque d'examen sont lus sur disque (content/academy) : on les embarque dans les fonctions serveur.
  outputFileTracingIncludes: {
    "/academy": ["./content/academy/**/*"],
    "/academy/**": ["./content/academy/**/*"],
    "/admin/academy": ["./content/academy/**/*"],
  },
};

export default nextConfig;
