/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  // Ensure proper module resolution
  experimental: {
    esmExternals: 'loose',
  },
  // Webpack configuration for better path resolution
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Ensure proper path resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, '.'),
    }
    return config
  },
}

module.exports = nextConfig
