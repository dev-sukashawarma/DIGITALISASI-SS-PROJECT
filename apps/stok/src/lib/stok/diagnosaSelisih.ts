/**
 * Diagnosa selisih opname di Jurnal & Rekonsiliasi.
 *
 * Selisih yang pas kelipatan isi kemasan (tepat 1 tabung, tepat 1 Dus) jarang
 * berarti salah skala satuan; lebih sering salah hitung (tabung kosong kadang
 * ikut dihitung) atau barang dicatat di bahan yang salah. Contoh nyata Mitra
 * Cicurug Nov 2026: crew mencatat semua foil bergantian sebagai FOIL 5M atau
 * FOIL 7,6M -- satu jadi 0, yang lain surplus, hampir tiap hari.
 */

/** Selisih (satuan kecil) tepat kelipatan isi kemasan, toleransi +/- 2 satuan kecil. */
export function isKelipatanKemasan(selisih: number, kemasan: number): boolean {
  if (!(kemasan > 1)) return false
  const a = Math.abs(selisih)
  if (a < kemasan) return false
  const sisa = a % kemasan
  return sisa <= 2 || kemasan - sisa <= 2
}

/**
 * Keluarga bahan sejenis beda ukuran: kata pertama, bila kata kedua diawali angka
 * (FOIL 5M / FOIL 7,6M, KULIT 25 / KULIT 32, GAS 3Kg / GAS 12 KG).
 */
export function keluargaBahan(nama: string): string | null {
  const t = (nama || '').trim().toUpperCase().split(/\s+/)
  if (t.length < 2 || !/^\d/.test(t[1])) return null
  return t[0]
}

export interface ItemSelisih {
  id: string
  nama: string
  satuan: string
  /** Selisih fisik - sistem dalam satuan kecil. */
  selisih: number
  /** Isi satu satuan besar dalam satuan kecil. */
  kemasan: number
}

export interface PasanganTukar {
  id: string
  nama: string
  satuan: string
  selisih: number
  kemasan: number
}

/** Sisa |a + b| maksimal sebagai bagian dari selisih terbesar agar dianggap saling meniadakan. */
export const BATAS_SALING_MENIADAKAN = 0.5

/** Selisih cukup besar untuk dianggap barang yang pindah catatan (>= setengah kemasan). */
function cukupBesar(i: ItemSelisih): boolean {
  return i.kemasan > 1 ? Math.abs(i.selisih) >= i.kemasan / 2 : Math.abs(i.selisih) > 0
}

/**
 * Bahan sejenis (satu keluarga nama, atau pasangan substitusi) yang selisihnya
 * berlawanan arah di opname yang sama: satu kurang, yang lain lebih. Polanya khas
 * barang yang dihitung di bawah nama bahan yang salah.
 * Hasil: id bahan -> daftar pasangannya.
 */
export function cariTukarBahan(
  items: ItemSelisih[],
  pasanganSubstitusi: [string, string][] = []
): Map<string, PasanganTukar[]> {
  const kandidat = items.filter(cukupBesar)
  const sekeluarga = (a: ItemSelisih, b: ItemSelisih) => {
    const ka = keluargaBahan(a.nama)
    if (ka !== null && ka === keluargaBahan(b.nama)) return true
    return pasanganSubstitusi.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id))
  }

  const hasil = new Map<string, PasanganTukar[]>()
  for (let i = 0; i < kandidat.length; i++) {
    for (let j = i + 1; j < kandidat.length; j++) {
      const a = kandidat[i]
      const b = kandidat[j]
      if (Math.sign(a.selisih) === Math.sign(b.selisih) || !sekeluarga(a, b)) continue
      // Harus saling meniadakan setidaknya separuhnya (mis. -1 Dus vs +1,07 Dus); selisih
      // berlawanan yang jauh beda besarnya biasanya kebetulan. Data Nov 2026: 25/28
      // kejadian FOIL tetap tertangkap, KULIT 69 -> 46.
      if (Math.abs(a.selisih + b.selisih) > BATAS_SALING_MENIADAKAN * Math.max(Math.abs(a.selisih), Math.abs(b.selisih))) continue
      const tambah = (dari: ItemSelisih, ke: ItemSelisih) => {
        const list = hasil.get(dari.id) || []
        list.push({ id: ke.id, nama: ke.nama, satuan: ke.satuan, selisih: ke.selisih, kemasan: ke.kemasan })
        hasil.set(dari.id, list)
      }
      tambah(a, b)
      tambah(b, a)
    }
  }
  return hasil
}
