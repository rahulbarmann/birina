/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        PINATA_API_KEY: process.env.PINATA_API_KEY,
        PINATA_SECRET_KEY: process.env.PINATA_SECRET_KEY,
    },
};

module.exports = nextConfig;
