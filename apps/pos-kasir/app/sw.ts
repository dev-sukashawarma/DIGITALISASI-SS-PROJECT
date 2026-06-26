import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, StaleWhileRevalidate, ExpirationPlugin, CacheFirst } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      urlPattern: /\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: 'supabase-images',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) => url.pathname.endsWith('sound-pesanan.mp3'),
      handler: new CacheFirst({
        cacheName: 'audio-assets',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 5,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// Listen for Background Sync events
import { handleSyncEvent } from '@suka/offline-queue/sw'

self.addEventListener('sync', (event: any) => {
  if (event.tag.startsWith('sync-')) {
    const storageKey = event.tag.replace('sync-', '')
    event.waitUntil(
      handleSyncEvent(storageKey, async (items) => {
        const clients = await self.clients.matchAll()
        for (const client of clients) {
          client.postMessage({ type: 'FLUSH_QUEUE', storageKey })
        }
      })
    )
  }
})
