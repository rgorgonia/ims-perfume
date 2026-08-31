import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Keep Turbopack from picking up the stray package-lock.json in ~/
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

