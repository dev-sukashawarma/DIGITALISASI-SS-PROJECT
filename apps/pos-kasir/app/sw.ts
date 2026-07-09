import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig, RuntimeCaching } from 'serwist';
import { Serwist, NetworkFirst, StaleWhileRevalidate, ExpirationPlugin } from 'serwist';

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
