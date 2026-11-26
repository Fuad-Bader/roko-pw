import type { NextConfig } from 'next'

// The landing site is plain static files (out/) that can be hosted anywhere.
const nextConfig: NextConfig = {
  output: 'export',
  // Shared design system lives in packages/ui as TypeScript source.
  transpilePackages: ['@roko/ui'],
  images: { unoptimized: true },
}

export default nextConfig
