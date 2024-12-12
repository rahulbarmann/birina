import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    env: {
        PINATA_API_KEY: process.env.PINATA_API_KEY,
        PINATA_SECRET_KEY: process.env.PINATA_SECRET_KEY,
    },
};

export default nextConfig;
