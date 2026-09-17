/**
 * Gerbang konfirmasi untuk form "terima barang PO".
 *
 * Latar (16 September 2026): dua salah input penerimaan ditemukan dalam satu
 * hari, dan keduanya hanya bisa diperbaiki manual di database -- karena
 * `verifikasi_terima_po` menghitung `GREATEST(0, qty_baru - qty_lama)`, jadi
 * form terima TIDAK PERNAH bisa mengurangi. Setiap kelebihan input jadi
 * pekerjaan koreksi tangan.
 *
 *   - KULIT 32, PO/KITCHEN/20260914/0001: 77 Pack diinput padahal barang yang
 *     datang KULIT 25 (sudah tercatat benar di PO lain pada menit yang sama).
 *     Stok gudang saat itu 2 Pack -> yang masuk 38x stok berjalan.
 *   - TEPUNG, PO/KITCHEN/20260907/0005: 100 Kg diinput dua kali (8 & 11 Sep)
 *     padahal pesanannya cuma 100 Kg. Stoknya 136 Kg, jadi TIDAK tampak
 *     melompat -- yang janggal justru akumulasinya melewati qty pesan.
 *
 * Satu aturan tidak cukup: masing-masing kejadian hanya tertangkap oleh satu
 * aturan yang berbeda. Keduanya ada di sini, dan dua-duanya ada di berkas tes.
 *
 * Akar yang sebenarnya lebih sederhana dari kedua aturan itu: form terima tidak
 * pernah menunjukkan AKIBATNYA ke stok. `stokSetelahTerima` dipakai untuk itu,
 * dan sengaja ditampilkan selalu -- bukan cuma saat curiga. Pelajaran yang sama
 * dengan perbaikan ManualEntryForm 8 September 2026.
 *
 * Modul ini tidak tahu apa-apa soal React maupun Supabase supaya bisa diuji
 * sebagai aritmetika biasa.
 */

/**
 * Berapa kali lipat stok berjalan sebelum sebuah penerimaan dianggap melompat.
 *
 * 10x dipilih supaya jauh di atas irama restock normal (gudang menipis lalu
 * diisi 2-5x stok sisa) tapi masih menangkap KULIT 32 yang 38x. Peringatan yang
 * terlalu sering muncul akan berubah jadi klik refleks, dan itu lebih buruk
 * daripada tidak ada peringatan.
 */
export const AMBANG_LOMPATAN_STOK = 10

/**
 * Toleransi pembulatan float saat membandingkan akumulasi terima dengan qty
 * pesan. 0,001 satuan besar jauh di bawah apa pun yang bisa diketik orang,
 * tapi cukup untuk menyerap 0.1 + 0.2 !== 0.3.
 */
const TOLERANSI_FLOAT = 0.001

export interface TerimaGuardInput {
  /** Qty yang baru datang kali ini, dalam satuan besar. */
  qtyDatang: number
  /** Qty pesan pada baris PO, satuan besar. */
  qtyPesan: number
  /** Qty yang sudah pernah diterima pada baris PO ini, satuan besar. */
  qtyTerimaSebelumnya: number
  /**
   * Stok berjalan bahan ini di Gudang Pusat, satuan besar.
   * `null` berarti BELUM DIKETAHUI (query belum selesai / baris belum ada) --
   * aturan lompatan dilewati, bukan ditebak sebagai 0.
   */
  stokGudangBesar: number | null
}

export type TerimaWarning =
  | { jenis: 'lompatan_stok'; rasio: number; stokSebelum: number }
  | { jenis: 'melebihi_pesanan'; kelebihan: number }

/**
 * Peringatan yang perlu dikonfirmasi ulang sebelum penerimaan disimpan.
 * Daftar kosong = jalur mayoritas, form tidak boleh mengganggu.
 */
export function cekTerima(i: TerimaGuardInput): TerimaWarning[] {
  const out: TerimaWarning[] = []
  if (!(i.qtyDatang > 0)) return out

  // Terima PERSIS sejumlah sisa pesanan = apa yang menurut PO-nya memang harus
  // datang. Itu penerimaan paling normal yang ada, dan aturan rasio-stok di
  // bawah akan SELALU menyala untuknya tiap kali barang habis diisi ulang penuh
  // (smoke test 17 Sep 2026: KULIT 32, 300 dari 300, gudang sisa 2 Pack ->
  // "150x"). Peringatan sesering itu berubah jadi klik refleks, dan itu lebih
  // buruk daripada tidak ada peringatan.
  //
  // Pengecualian ini sengaja SEMPIT: hanya membungkam aturan rasio-stok, hanya
  // saat jumlahnya sama persis dengan sisa pesanan. Kelebihan pesanan tetap
  // diperingatkan, dan angka yang MELESET dari sisa pesanan -- termasuk 77 dari
  // sisa 300 yang jadi asal-usul gerbang ini -- tetap tertangkap.
  const sisaPesanan = i.qtyPesan - i.qtyTerimaSebelumnya
  const sesuaiSisaPesanan =
    sisaPesanan > 0 && Math.abs(i.qtyDatang - sisaPesanan) <= TOLERANSI_FLOAT

  const stok = i.stokGudangBesar
  if (!sesuaiSisaPesanan && stok !== null && Number.isFinite(stok) && stok > 0) {
    const rasio = i.qtyDatang / stok
    if (rasio > AMBANG_LOMPATAN_STOK) {
      out.push({ jenis: 'lompatan_stok', rasio, stokSebelum: stok })
    }
  }

  const akumulasi = i.qtyTerimaSebelumnya + i.qtyDatang
  const kelebihan = akumulasi - i.qtyPesan
  if (kelebihan > TOLERANSI_FLOAT) {
    out.push({ jenis: 'melebihi_pesanan', kelebihan })
  }

  return out
}

/** Stok gudang setelah penerimaan ini disimpan. `null` tetap `null`. */
export function stokSetelahTerima(stokGudangBesar: number | null, qtyDatang: number): number | null {
  if (stokGudangBesar === null || !Number.isFinite(stokGudangBesar)) return null
  return stokGudangBesar + (Number.isFinite(qtyDatang) ? qtyDatang : 0)
}

/** Kalimat siap tampil untuk sebuah peringatan. */
export function pesanWarning(w: TerimaWarning, satuan: string): string {
  if (w.jenis === 'lompatan_stok') {
    return `Jumlah ini ${w.rasio.toFixed(1)}x stok gudang yang sekarang (${w.stokSebelum} ${satuan}). Pastikan tidak tertukar dengan bahan atau PO lain.`
  }
  return `Melebihi jumlah pesanan sebanyak ${w.kelebihan} ${satuan}. Pastikan vendor memang mengirim lebih, bukan kiriman yang sama tercatat dua kali.`
}
