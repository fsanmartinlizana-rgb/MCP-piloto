import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // La ingesta usa dns/net para el guard anti-SSRF: nada de esto corre en edge.
  serverExternalPackages: [],
};

export default nextConfig;
