import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@huggingface/inference'],
  },
}

module.exports = nextConfig
