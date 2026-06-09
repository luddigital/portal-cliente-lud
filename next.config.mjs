/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '500mb' },
    // Reduz refetch no client quando navega entre páginas dinâmicas:
    //   pages dinâmicas: cache de 30s (default 0 — refetch a cada nav)
    //   pages estáticas: cache de 5 min
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default nextConfig;
