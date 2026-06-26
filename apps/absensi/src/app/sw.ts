import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, ExpirationPlugin } from "serwist";

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
      matcher: ({ url }) => url.pathname.startsWith('/models/'),
      handler: new CacheFirst({
        cacheName: 'face-models',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 20,
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
        // Here we just notify the client to do the actual flushing,
        // since the API logic lives in the React app.
        // Or if we have a generic flush endpoint we could call it here.
        // For simplicity, we can postMessage to clients to trigger flush.
        const clients = await self.clients.matchAll()
        for (const client of clients) {
          client.postMessage({ type: 'FLUSH_QUEUE', storageKey })
        }
      })
    )
  }
})
