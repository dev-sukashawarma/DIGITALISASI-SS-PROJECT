import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig, RuntimeCaching } from 'serwist';
import { Serwist, NetworkFirst, StaleWhileRevalidate, ExpirationPlugin, CacheableResponsePlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

// Diinjeksi saat bundling (scripts/build-sw.mjs) — memaksa precache
// /~offline diperbarui setiap build baru.
declare const __SW_BUILD_REV__: string;

const customCache: RuntimeCaching[] = [
  // ── Navigasi App Router (dokumen + RSC) same-origin ──────────────────────
  // INI kunci offline: online → tembus ke server (SSR normal) & simpan salinan;
  // offline → sajikan salinan halaman terakhir supaya kasir tetap bisa pindah
  // halaman. Ditaruh PALING ATAS agar menang atas defaultCache.
  // NetworkFirst tanpa filter Cache-Control → halaman `force-dynamic`
  // (Cache-Control: no-store) TETAP tersimpan (kita hanya batasi status 200).
  {
    matcher: ({ url, request, sameOrigin }) =>
      sameOrigin &&
      request.method === 'GET' &&
      !url.pathname.startsWith('/api/') &&
      (request.mode === 'navigate' ||
        request.headers.has('RSC') ||
        url.searchParams.has('_rsc')),
    handler: new NetworkFirst({
      cacheName: 'pages-offline',
      networkTimeoutSeconds: 10,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 hari
        }),
      ],
    }),
  },
  // Supabase REST (GET) — semua pembacaan data (orders, menu, settings, dll.)
  // tersimpan di cache; saat offline halaman tetap menampilkan data terakhir.
  {
    matcher: ({ url, request }) =>
      url.hostname.endsWith('.supabase.co') &&
      url.pathname.startsWith('/rest/v1/') &&
      request.method === 'GET',
    handler: new NetworkFirst({
      cacheName: 'supabase-rest',
      networkTimeoutSeconds: 8,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 300,
          maxAgeSeconds: 3 * 24 * 60 * 60, // 3 hari
        }),
      ],
    }),
  },
  // Gambar menu dari Supabase Storage — cache-first agar tampil saat offline
  {
    matcher: ({ url, request }) =>
      url.hostname.endsWith('.supabase.co') &&
      url.pathname.startsWith('/storage/v1/object/public/') &&
      request.method === 'GET',
    // SWR (bukan CacheFirst) karena request <img> lintas-origin menghasilkan
    // respons opaque — CacheFirst menolak meng-cache-nya, SWR tidak.
    handler: new StaleWhileRevalidate({
      cacheName: 'supabase-storage-images',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 300,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  // Cache RSC payloads (App Router navigations)
  {
    matcher: ({ url }) => url.searchParams.has('_rsc'),
    handler: new NetworkFirst({
      cacheName: 'rsc-payloads',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 Day
        }),
      ],
    }),
  },
  // API requests
  {
    matcher: ({ url }) => url.pathname.startsWith('/api/'),
    handler: new NetworkFirst({
      cacheName: 'apis',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 Day
        }),
      ],
    }),
  },
  // Static assets (Next.js chunks, CSS, etc.) that are missed by the empty precache manifest
  {
    matcher: ({ url }) => url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image/'),
    handler: new StaleWhileRevalidate({
      cacheName: 'next-static-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  // Bundling dilakukan manual via esbuild (Turbopack tidak menjalankan plugin
  // webpack @serwist/next), jadi __SW_MANIFEST kosong — precache minimal berisi
  // halaman fallback /~offline agar tetap tersedia saat offline total.
  precacheEntries: [
    ...(self.__SW_MANIFEST ?? []),
    { url: '/~offline', revision: __SW_BUILD_REV__ },
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: customCache,
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();
