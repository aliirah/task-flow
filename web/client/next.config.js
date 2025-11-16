/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['use-sidecar', 'react-remove-scroll'],
  turbopack: {},
}

module.exports = nextConfig
