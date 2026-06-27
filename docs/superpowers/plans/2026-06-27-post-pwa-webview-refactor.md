# Rencana Refactoring (Dikoreksi) — Post-PWA, WebView-Native

**Tanggal:** 2026-06-27
**Status:** Plan tertulis — belum dieksekusi.
**Konteks:** Pasca commit `56a1eb3` (hapus PWA, init mobile Superapp). Rencana ini
mengoreksi draft awal ("Rencana Refactoring Code") setelah verifikasi terhadap
kode nyata.

---

## Koreksi premis (baca dulu)

Draft awal bertumpu pada dua asumsi yang dibantah oleh kode:

1. **"Offline queue bergantung pada Service Worker Background Sync."** Hanya
   sebagian benar. Konsumen nyata (`useAttendanceQueue`, `useOpname`) flush lewat
   jalur **in-component**, bukan SW. Penghapusan SW **tidak** merusak proteksi
   duplikasi (itu ditangani client UUID stabil + server `upsert ignoreDuplicates`);
   yang rusak adalah **auto-flush saat reconnect ketika komponen masih mounted**.
   Bug berbeda, fix berbeda.
2. **"Order POS Kasir = test case offline yang bagus."** POS Kasir **tidak** pakai
   queue ini sama sekali (`OnlineOrderSync` cuma menarik order online masuk, bukan
   antre order offline keluar). Test harus menargetkan **clock-in absensi offline**.

### Temuan kunci yang sudah diverifikasi
- **Idempotensi absensi nyata:** `id = crypto.randomUUID()` dibuat sekali di
  `doSubmit` (`useClockKiosk.ts:212`), di-persist ke IndexedDB, dan dikirim ulang
  apa adanya tiap retry; edge function `upsert onConflict:"id" ignoreDuplicates`
  (`submit-attendance/index.ts:83`). Jadi re-flush = no-op server-side.
- **Poison-pill nyata:** late clock-in → baris ditulis (`index.ts:70`) lalu server
  balas `ok:false / terlambat_alpha` (`index.ts:87`); loop client `throw` saat
  `!res.ok` (`useAttendanceQueue.ts:39`); `flush()` hanya `storage.clear()` setelah
  seluruh batch sukses (`useOfflineQueue.ts:114`) → item nyangkut selamanya,
  re-upload tiap reconnect.
- **WebView bridge mati:** `App.tsx` set `injectedJavaScript` tapi **tanpa**
  `onMessage`. Docs resmi react-native-webview: `window.ReactNativeWebView.postMessage`
  **tidak di-inject** tanpa `onMessage`, dan `injectedJavaScript` pun "requires an
  onMessage handler". Jadi `__SUKASHAWARMA_NATIVE_APP__` flag yang sudah ter-ship
  pun rapuh.
- **serwist sudah bersih** dari semua `package.json`; sisa hanya di lockfile +
  `fix-serwist.js` + aturan `.gitignore`.

---

## Task 1 — Tulis ulang `@suka/offline-queue` dengan flush contract yang benar ✅ DONE (2026-06-27)

> Verifikasi: `type-check` bersih (package + absensi + stok); absensi vitest 41/41 pass.
> Catatan: `package.json` `exports` paket ini menunjuk `./src` langsung (bukan `dist/`),
> jadi edit `src` langsung efektif — gotcha rebuild-dist tak berlaku di sini.

Task pemikul beban. `flush()` saat ini (`useOfflineQueue.ts:101`) pakai desain
**batch-clear-only-on-full-success** → poison-pill wedge (lihat di atas).

**Fix — per-item ack dengan tiga outcome:**

```ts
type FlushOutcome = 'done' | 'drop' | 'retry';
// done  = server menerima → hapus item
// drop  = penolakan bisnis terminal (alpha, validasi) → hapus, jangan retry
// retry = transport/5xx/offline → simpan, hentikan batch (jaga urutan)

async function flush(submitFn: (data, item) => Promise<FlushOutcome>) {
  for (const item of await storage.get()) {
    const outcome = await submitFn(item.data, item);
    if (outcome === 'retry') break;       // stop, sisanya tetap di queue
    await storage.removeItem(item.id);     // ack ATAU terminal-drop
  }
}
```

- Tambah `storage.removeItem(id)` ke `storage.ts` (sekarang hanya ada `clear()`).
- **Hapus kode SW mati:** `src/sw.ts` (`handleSyncEvent`), `registerSync()` + listener
  `navigator.serviceWorker` `FLUSH_QUEUE` di `useOfflineQueue.ts`, dan re-export
  `handleSyncEvent` di `index.ts:3`.
- **Rebuild `dist/`** — konsumen impor build, bukan `src/` (gotcha terdokumentasi).

## Task 2 — Auto-flush saat reconnect ✅ DONE (2026-06-27)

**Keputusan: BATALKAN `OfflineQueueProvider`/registry — over-engineering untuk 2 konsumen.**

Penemuan saat eksekusi: `apps/stok` `useOpname.ts:65` **sudah** auto-flush saat
reconnect via efek `isOnline` (`isOnline` flip pada window `online` event di dalam
`useOfflineQueue`). Jadi regresi hanya di **absensi** — `useAttendanceQueue` tak punya
efek setara, cuma flush saat mount. Fix yang konsisten dengan kode = beri absensi efek
`isOnline` yang sama, bukan abstraksi provider baru.

**Yang dikerjakan:**
- `useAttendanceQueue.ts` — tambah `useEffect(() => { if (isOnline) flushQueue("") }, [isOnline])`,
  menyamai pola stok. Clock-in offline kini tersinkron saat reconnect tanpa reload.
- Outcome mapping (`terlambat_alpha`/4xx → `'drop'`, 5xx/network → `'retry'`, ok → `'done'`)
  sudah masuk di Task 1.

**Provider/registry ditunda** sampai konsumen ketiga yang benar-benar baru muncul
(mis. order offline POS) — saat itu barulah abstraksi terbayar. YAGNI.

## Task 3 — Gate reachability (jangan percaya `navigator.onLine`)

`navigator.onLine === true` cuma berarti ada interface, bukan Supabase reachable.
Dengan kontrak Task 1 ini sudah aman (item → `'retry'`, tetap di queue), tapi untuk
hindari thrash: debounce flush + bounded backoff di provider, jangan fire tiap raw
`online` event.

## Task 4 — WebView bridge: tambah `onMessage` dulu (keystone)

Docs react-native-webview (`^14.0.1`): `postMessage` tak di-inject tanpa `onMessage`;
`injectedJavaScript` pun butuh `onMessage`. `App.tsx` sekarang tak punya keduanya.

1. **Tambah `onMessage={handleBridgeMessage}`** ke `<WebView>` — meng-inject bridge,
   menstabilkan injected flag, memberi native channel untuk bereaksi (sound/haptic).
2. **Pindah `__SUKASHAWARMA_NATIVE_APP__` ke `injectedJavaScriptBeforeContentLoaded`**
   agar ada sebelum hydration (hindari render-flash).

## Task 5 — Deteksi WebView dipisah per use case (matikan risiko hydration)

- **Layout gating** (sembunyikan header portal, safe-area) → **UA sniff server-side**
  pada `applicationNameForUserAgent="SukashawarmaApp/1.0"` (`App.tsx:181`).
  Terbaca server di byte pertama → **tanpa hydration mismatch**, tanpa `useEffect`
  gate, tanpa flash. Lebih baik daripada `window.ReactNativeWebView` untuk layout.
- **Bridge runtime** → `window.ReactNativeWebView?.postMessage(...)` (kini terdefinisi
  berkat Task 4), di-guard.
- `pt-safe`/`pb-safe`: pastikan `<meta viewport-fit=cover>` masih ter-emit pasca-PWA
  & utilitas ada di Tailwind config; waspada double-inset (App.tsx sudah `SafeAreaView`
  + `translucent={false}`).

## Task 6 — Pembersihan dependensi (lebih kecil dari draft)

`serwist`/`@serwist` **sudah tidak ada** di semua `package.json`. Jadi: `yarn install`
untuk prune lockfile, lalu hapus `fix-serwist.js` (root) + aturan `sw.js` di
`.gitignore`. Tak perlu edit manifest app.

## Task 7 — Rencana verifikasi (dikoreksi)

- **Test sync offline → pakai clock-in absensi, BUKAN order POS.** Airplane mode →
  clock in (enqueue) → reconnect → provider auto-flush **tanpa reload**, `pending`
  kembali 0.
- **Regresi poison-pill:** antre late clock-in offline → reconnect → diterima, dihapus
  dari queue, **tidak** re-upload di `online` event berikutnya.
- **Bridge WebView:** di build Expo, `onMessage` fire & `postMessage` dari web memicu
  handler native (sound/haptic).
- Offline-order POS = **fitur baru** (wire POS ke queue: client order-id stabil +
  server upsert), bukan sesuatu yang refactor ini verifikasi gratis.

---

## Sequencing

**1 → 2** (kontrak sebelum provider) → **3** → **4 → 5** (onMessage sebelum bridge/
deteksi) → **6** → **7**. Task 1–3 memperbaiki regresi offline live, dahulukan; 4–5
lapisan native-feel.
