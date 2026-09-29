# 06 — Sisi Frontend (Next.js + React Query)

## Hook daftar

```ts
useQuery({
  queryKey: ['entitas', filters, page, pageSize],   // filter & halaman masuk key
  enabled: !!directory && enabled,                  // tunggu dependensi; tab tak aktif = off
  staleTime: 30_000,
  refetchInterval: 60_000,                          // cadangan realtime, bukan sumber utama
  placeholderData: keepPreviousData,                // pindah halaman tidak berkedip
  queryFn: () => fetchPage(dir, filters, pageSize, (page - 1) * pageSize),
})
```

- Pencarian di database → **debounce 300–400 ms** (`useDebouncedValue`).
- Filter berubah → **kembali ke halaman 1**; halaman melebihi total → **clamp**.
- Kartu ringkasan dari RPC (seluruh data), **bukan** dihitung dari 50 baris halaman.
- Hanya tab yang sedang dibuka yang di-query (`enabled`).

## Realtime

```ts
const channelId = useId()                               // nama channel unik per mount
.channel(`nama-${channelId}`)
.on('postgres_changes', { table: 'attendance' }, (payload) => {
  if (diLuarRentangYangDilihat(payload)) return         // sadar filter
  if (timer) return
  timer = setTimeout(() => { timer = null; qc.invalidateQueries({ queryKey: ['entitas'] }) }, 3000)
})
```

- **Debounce 3 detik**: jam masuk ramai = 1 refetch, bukan 100.
- Abaikan event di luar rentang yang sedang dilihat.
- Jangan subscribe tabel yang tidak memengaruhi query (contoh: payroll dulu ikut refetch
  tiap clock-in di outlet mana pun).
- Polling ≤ 15 detik + realtime = boros. Pilih realtime + cadangan ≥ 60 detik.

## Export

`fetchAllPages(fetchPage, key, batch)` — ambil semua baris sesuai filter per batch sampai
`total`, dedup per kunci. Excel berwarna: `exceljs` dimuat **dinamis** (`await import('exceljs')`)
supaya tidak membebani halaman. Referensi: `apps/HR/src/lib/exportAbsensiExcel.ts`.

## Daftar id di query

- ≤ ±50 id → `.in('col', ids)` masih aman.
- Lebih dari itu atau bisa tumbuh → kirim lewat **RPC body**, atau pecah per 50 (`inChunks`).

## Waktu

- "Hari ini" = `toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })`,
  **bukan** `new Date().toISOString()` (UTC → salah sebelum 07.00 WIB).
- Tampilkan jam dengan `timeZone: 'Asia/Jakarta'`.

## Error

Jangan telan error menjadi `[]` (data kosong palsu). `if (error) throw error` → UI
menampilkan galat, bukan "tidak ada data". supabase-js **mengembalikan** `{ error }`, tidak
melempar — `try/catch` saja tidak cukup.

Template: [`templates/paging.ts`](templates/paging.ts), [`templates/Pagination.tsx`](templates/Pagination.tsx),
[`templates/useDebouncedValue.ts`](templates/useDebouncedValue.ts).
