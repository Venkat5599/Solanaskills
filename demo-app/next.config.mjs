/** @type {import('next').NextConfig} */
const nextConfig = {
  // The agent's tools import the skill's real engine from ../lib (outside this
  // app dir). externalDir lets Next transpile and bundle that source.
  experimental: { externalDir: true },
  // Pin the workspace root to this app so stray parent lockfiles don't confuse
  // Next's file tracing.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
