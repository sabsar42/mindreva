import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@mindreva/types",
    "@mindreva/ui",
    "@mindreva/auth",
    "@mindreva/database",
    "@mindreva/asr",
    "@mindreva/llm",
  ],
};

export default nextConfig;
