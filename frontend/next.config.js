/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // La URL del backend. En producción, configura NEXT_PUBLIC_API_URL en tu host.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
};
module.exports = nextConfig;
