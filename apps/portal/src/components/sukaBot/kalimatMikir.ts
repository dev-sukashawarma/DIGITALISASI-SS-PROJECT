/** Kalimat gelembung "lagi mikir" — berganti selama menunggu agar tidak terasa macet. */
export const KALIMAT_MIKIR: readonly string[] = [
  'Lagi cek datanya, Bos',
  'Sebentar ya, Bos, lagi ngitung',
  'Lagi buka laporan penjualannya',
  'Hmm, angkanya lagi dicocokin dulu',
  'Lagi ngumpulin data outletnya',
  'Bentar, Bos, jawabannya lagi dirapiin',
  'Lagi intip dapur datanya',
  'Lagi bolak-balik catatan kasir',
  'Sabar ya, Bos, lagi diproses',
  'Lagi pastiin angkanya nggak meleset',
]

/** Kalimat acak; bila `sekarang` diisi, hasilnya pasti berbeda dari kalimat itu. */
export function kalimatBerikut(sekarang: string | null, acak: () => number = Math.random): string {
  const pilihan = sekarang === null ? KALIMAT_MIKIR : KALIMAT_MIKIR.filter((k) => k !== sekarang)
  return pilihan[Math.min(Math.floor(acak() * pilihan.length), pilihan.length - 1)]
}
