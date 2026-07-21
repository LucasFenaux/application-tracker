import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@xenova/transformers'],
  serverExternalPackages: ['onnxruntime-node'],
};

export default nextConfig;
