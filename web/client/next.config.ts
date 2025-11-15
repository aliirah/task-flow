import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['use-sidecar', 'react-remove-scroll'],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
    };
    return config;
  },
};

export default nextConfig;
