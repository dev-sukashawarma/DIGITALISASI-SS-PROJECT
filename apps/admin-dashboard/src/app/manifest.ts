import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Admin Dashboard — Sukashawarma',
    short_name: 'Admin',
    description: 'Dashboard admin untuk kelola user, menu, outlet & laporan',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff7ed',
    theme_color: '#0a7d2c',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
