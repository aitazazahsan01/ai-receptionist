import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal production image for Docker (Phase 8) -- copies only the files
  // next start actually needs instead of the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
