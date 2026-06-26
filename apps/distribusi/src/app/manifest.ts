import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Distribusi — Sukashawarma',
    short_name: 'Distribusi',
    description: 'Distribusi & verifikasi penerimaan bahan baku outlet',
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
