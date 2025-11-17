const fs = require('fs')
const path = require('path')

const fallbackEnvPath = path.resolve(__dirname, '../.env')

if (!process.env.NEXT_PUBLIC_API_URL && fs.existsSync(fallbackEnvPath)) {
  const fileContents = fs.readFileSync(fallbackEnvPath, 'utf-8')
  fileContents.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      return
    }

    const separatorIdx = trimmed.indexOf('=')
    if (separatorIdx === -1) {
      return
    }

    const key = trimmed.slice(0, separatorIdx).trim()
    const value = trimmed.slice(separatorIdx + 1).trim()

    if (key && !(key in process.env)) {
      process.env[key] = value
    }
  })
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['use-sidecar', 'react-remove-scroll'],
  turbopack: {},
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
}

module.exports = nextConfig
