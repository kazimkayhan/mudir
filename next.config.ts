import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "dist",
  images: {
    unoptimized: true,
  },
  output: "export",
  reactCompiler: true,
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
