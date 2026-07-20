import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack doesn't get confused
  // by lockfiles elsewhere in the home directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
