/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Allow the Emscripten-generated forml.js to load forml.wasm from /public/wasm/
  // The WASM binary is fetched at runtime by the JS glue code — no webpack config needed.
  headers: async () => [
    {
      source: "/wasm/:path*",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      ],
    },
  ],
}

export default nextConfig
