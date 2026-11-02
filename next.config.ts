import type { NextConfig } from "next";

/** En-têtes de sécurité sur toutes les pages : pas d'affichage dans une iframe d'un autre site, pas d'indexation. */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  // Pas de form-action : Chrome l'applique aussi aux redirections (connexion Google, paiement Stripe).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Espace client privé : rien à indexer dans les moteurs de recherche.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  headers: () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
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
