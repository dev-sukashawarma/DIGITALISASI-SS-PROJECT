# Transfer Antar-Outlet Suggestion — Design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)
**Backlog ref:** CLAUDE.md → Next Features #2

## Tujuan

Secara otomatis menyarankan transfer stok antar-outlet: ketika satu outlet
**surplus** dan outlet lain **kritis** pada item (bahan baku) yang sama, sistem
menampilkan saran "kirim N unit dari A → B". SPV melihat dan memutuskan; fitur
ini **murni saran** — eksekusi transfer nyata tetap lewat `TransferModal` yang
sudah ada (saat ini masih mock, di luar scope ini).

## Non-Goals (scope batas)

- **Bukan** eksekusi transfer ke `ledger_stok` (transfer_keluar/masuk). Itu
  perbaikan `TransferModal.handleTransferConfirm` yang masih mock — pekerjaan
  terpisah.
- **Bukan** perubahan database (tidak ada view/migration baru).
- **Bukan** menampilkan saran di papan monitoring-live (papan sengaja
  minimalis & read-only per design rationale).

## Arsitektur

Semua dihitung **client-side** dari data `monitoring_view_spv` yang **sudah
di-fetch** oleh SPV Dashboard via `fetchSPVMonitoringData()`. Tidak ada query
tambahan, tidak ada perubahan DB.

Sumber data: `MonitoringItem[]` (lihat `apps/stok/src/lib/types/monitoring.ts`).
Field relevan per outlet/item: `current_qty`, `threshold` (= reorder point),
`status` (`below` | `warning` | `ok`), `bahan_baku_id`, `outlet_id`,
`outlet_name`, `item_name`, `satuan`.

## Logika Inti — Fungsi Murni

Lokasi: `apps/stok/src/lib/stok/transferSuggestion.ts`

```ts
export interface TransferSuggestion {
  bahan_baku_id: string;
  item_name: string;
  satuan: string;
  donorOutletId: string;
  donorOutletName: string;
  recipientOutletId: string;
  recipientOutletName: string;
  qty: number;
  recipientStatus: 'below' | 'warning';
}

export function computeTransferSuggestions(
  items: MonitoringItem[]
): TransferSuggestion[];
```

Algoritma:

1. Kelompokkan `items` per `bahan_baku_id` (hanya item yang sama dipasangkan).
2. Untuk tiap grup:
   - **Penerima** = outlet dengan `status` ∈ {`below`, `warning`}.
     Kebutuhan = `threshold − current_qty` (selalu > 0 untuk kedua status).
   - **Donor** = outlet dengan `current_qty > threshold`.
     Surplus = `current_qty − threshold`.
3. Urutkan penerima berdasar keparahan: `below` sebelum `warning`; dalam tiap
   tingkat, defisit terbesar dulu.
4. Urutkan donor berdasar surplus terbesar dulu.
5. **Alokasi greedy:** untuk tiap penerima, ambil dari donor surplus terbesar
   yang masih tersisa. `qty = min(kebutuhan penerima, sisa surplus donor)`.
   Kurangi sisa surplus donor; bila penerima belum terpenuhi dan masih ada
   donor lain, lanjut ke donor berikutnya (boleh hasilkan >1 saran per
   penerima). **Invarian: donor tak pernah turun di bawah threshold-nya.**
6. Abaikan qty = 0 (tidak hasilkan saran kosong).
7. Kembalikan daftar `TransferSuggestion` (urut: keparahan penerima, lalu item).

## UI — `TransferSuggestionPanel`

Lokasi: `apps/stok/src/components/monitoring/TransferSuggestionPanel.tsx`,
dirender di dalam `SPVDashboard`.

- Tiap saran = kartu: "Kirim **{qty} {satuan} {item}** dari **{donor}** →
  **{penerima}**" + badge status penerima (merah `below` / kuning `warning`).
- Tombol **Transfer** membuka `TransferModal` yang sudah ada, pre-filled dengan
  item penerima + donor sebagai sumber + qty saran (lewat handler yang sudah
  ada `setTransferItem`, ditambah penyaluran source/qty awal).
- Empty state bila tidak ada saran: "Semua stok seimbang ✅".
- Gunakan design token `suka-*` (konsisten dengan refactor design-system).

## Error Handling

Fungsi murni tidak melempar; input kosong / tanpa donor menghasilkan array
kosong. Panel menampilkan empty state. Tidak ada I/O baru → tidak ada jalur
error jaringan tambahan.

## Testing (TDD)

Unit test `transferSuggestion.test.ts` menutup:

- Tanpa donor (semua outlet ≤ threshold) → array kosong.
- Satu donor memasok beberapa penerima sampai surplus habis.
- Proteksi donor: qty tak pernah membuat donor < threshold.
- Urutan keparahan: `below` diprioritaskan sebelum `warning`.
- Hanya item dengan `bahan_baku_id` sama yang dipasangkan.
- qty = min(kebutuhan, surplus) terhitung benar.

Smoke test manual: SPV Dashboard menampilkan panel & kartu saran.
