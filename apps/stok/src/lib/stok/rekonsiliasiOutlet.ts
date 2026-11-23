/**
 * Penggabungan posisi stok per outlet untuk satu bahan di Jurnal & Rekonsiliasi.
 *
 * Mode "Semua Outlet" dulu menjumlah stok FISIK hanya dari outlet yang opname
 * di periode itu, tetapi stok SISTEM dari semua outlet -- sehingga seluruh stok
 * outlet yang tidak opname (BNR, Beji hampir tiap hari) tampil sebagai kerugian
 * puluhan juta. Aturan yang benar (apel ke apel): selisih sebuah bahan hanya
 * membandingkan fisik vs sistem DARI OUTLET-OUTLET YANG SAMA, yaitu outlet yang
 * benar-benar menghitung bahan itu. Stok sistem outlet lain tetap terlihat di
 * total stok sistem, tapi tidak ikut selisih.
 *
 * Satuan: semua angka dalam satuan kecil (sudah dinormalisasi pemanggil).
 */

export interface PosisiOutletBahan {
  saldoAwal: number
  masuk: number
  pakai: number
  waste: number
  mutasiLain: number
  /** Hitungan fisik opname penutup outlet ini; null = bahan tidak dihitung. */
  fisik: number | null
}

export interface GabunganBahan {
  saldoAwal: number
  masuk: number
  pakai: number
  waste: number
  mutasiLain: number
  /** Stok sistem SEMUA outlet (dibulatkan 2 desimal). */
  stokSistem: number
  /** Jumlah hitungan fisik; null bila tidak ada outlet yang menghitung. */
  stokFisik: number | null
  /** Stok sistem hanya outlet yang menghitung fisik -- pembanding selisih. */
  stokSistemTerhitung: number | null
  /** stokFisik - stokSistemTerhitung; 0 bila tidak ada hitungan fisik. */
  selisih: number
  outletOpname: number
  outletTotal: number
}

const bulat2 = (n: number) => Math.round(n * 100) / 100

/**
 * Saldo awal satu outlet: hitungan fisik opname sebelumnya bila bahan itu
 * dihitung; kalau opname sebelumnya ada tapi bahan ini kosong (`qty_fisik`
 * null) -- atau belum pernah opname -- pakai saldo ledger sebelum mutasi
 * pertama periode. Dulu outlet ber-opname yang tidak menghitung bahan
 * tertentu menyumbang 0.
 */
export function saldoAwalOutlet(
  qtyFisikSebelum: number | null | undefined,
  saldoLedgerAwal: number | null | undefined
): number {
  if (qtyFisikSebelum !== null && qtyFisikSebelum !== undefined) return Number(qtyFisikSebelum)
  if (saldoLedgerAwal !== null && saldoLedgerAwal !== undefined) return Number(saldoLedgerAwal)
  return 0
}

export function stokSistemOutlet(p: PosisiOutletBahan): number {
  return p.saldoAwal + p.masuk - p.pakai - p.waste + p.mutasiLain
}

export function gabungPosisiOutlet(posisi: PosisiOutletBahan[]): GabunganBahan {
  let saldoAwal = 0
  let masuk = 0
  let pakai = 0
  let waste = 0
  let mutasiLain = 0
  let sistem = 0
  let sistemTerhitung = 0
  let fisik = 0
  let outletOpname = 0

  for (const p of posisi) {
    saldoAwal += p.saldoAwal
    masuk += p.masuk
    pakai += p.pakai
    waste += p.waste
    mutasiLain += p.mutasiLain
    const s = stokSistemOutlet(p)
    sistem += s
    if (p.fisik !== null && p.fisik !== undefined) {
      outletOpname++
      fisik += Number(p.fisik)
      sistemTerhitung += s
    }
  }

  const adaFisik = outletOpname > 0
  // Pembulatan sama dengan rumus lama outlet tunggal: sistem dibulatkan dulu, baru selisih.
  const sistemTerhitungBulat = adaFisik ? bulat2(sistemTerhitung) : null
  return {
    saldoAwal,
    masuk,
    pakai,
    waste,
    mutasiLain,
    stokSistem: bulat2(sistem),
    stokFisik: adaFisik ? fisik : null,
    stokSistemTerhitung: sistemTerhitungBulat,
    selisih: adaFisik ? bulat2(fisik - (sistemTerhitungBulat as number)) : 0,
    outletOpname,
    outletTotal: posisi.length,
  }
}
