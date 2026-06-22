// Konfigurasi channel order eksternal (GoFood, ShopeeFood, dll).
// Dipakai bersama oleh halaman input order manual & badge di papan Order.
//
// Catatan: warna memakai brand color masing-masing channel. "Logo" dirender
// sebagai mark/inisial berstilir (lihat ChannelBadge) agar tidak perlu
// menyimpan aset gambar berhak cipta. Bisa diganti PNG asli kapan saja
// dengan menaruh file di /public dan menyetel `logo` di sini.

export interface ChannelConfig {
  id: string
  label: string
  // Warna latar utama (brand color) & warna teks kontras
  bg: string
  fg: string
  // Mark singkat (inisial) untuk badge bulat
  mark: string
}

export const CHANNELS: ChannelConfig[] = [
  { id: 'gofood',     label: 'GoFood',     bg: '#EE2737', fg: '#FFFFFF', mark: 'G' },
  { id: 'shopeefood', label: 'ShopeeFood', bg: '#EE4D2D', fg: '#FFFFFF', mark: 'S' },
  { id: 'grabfood',   label: 'GrabFood',   bg: '#00B14F', fg: '#FFFFFF', mark: 'Gr' },
  { id: 'tiktokgo',   label: 'TikTok Go',  bg: '#111111', fg: '#FFFFFF', mark: 'T' },
]

export function getChannel(id: string | null | undefined): ChannelConfig | null {
  if (!id) return null
  return CHANNELS.find((c) => c.id === id) ?? null
}
