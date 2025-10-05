const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { domains: ["localhost"] },
  webpack: (config) => {
    // Ensure @ points to the app root of the frontend package
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
    };
    return config;
  },
};

module.exports = nextConfig;
