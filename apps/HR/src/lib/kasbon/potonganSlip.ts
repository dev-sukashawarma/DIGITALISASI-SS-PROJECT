import { rupiah } from '../format'

/** Potongan kasbon pada slip: kolom deduction_kasbon, atau angka "kasbon Rp …" di catatan potongan. */
export function potonganKasbonSlip(slip: {
  deduction_kasbon: number | null | undefined
  deduction_note: string | null | undefined
}): number {
  const langsung = Number(slip.deduction_kasbon) || 0
  if (langsung > 0) return langsung
  const m = (slip.deduction_note ?? '').match(/kasbon[:\s]*rp?\s*([0-9.,]+)/i)
  return m ? Number(m[1].replace(/[^0-9]/g, '')) || 0 : 0
}

/**
 * Potongan kasbon di slip hanya boleh dari kasbon yang sudah dicairkan finance (keputusan owner
 * 13 Nov 2026). Mengembalikan pesan galat, atau null bila boleh.
 */
export function cekPotonganKasbonSlip(diminta: number, sisaAktif: number, namaStaf: string): string | null {
  if (diminta <= sisaAktif) return null
  return `Potongan kasbon ${namaStaf} (${rupiah(diminta)}) melebihi sisa kasbon yang sudah dicairkan (${rupiah(sisaAktif)}). Kasbon di luar sistem harus diajukan dan dicairkan finance dulu.`
}
