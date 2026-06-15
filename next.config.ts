import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  typedRoutes: false,
  outputFileTracingRoot: path.join(process.cwd()),
  images: {
    unoptimized: true
  }
};

export default nextConfig;
