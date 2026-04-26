import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
    serverExternalPackages: ['@huggingface/inference'],
}

module.exports = nextConfig