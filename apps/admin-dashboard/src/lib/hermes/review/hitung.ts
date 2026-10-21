import type { AlertReviewBaris, OutletRatingBaris, ReviewBaris } from './tipe'

export type UrutanRanking = 'tertinggi' | 'terendah' | 'ulasan_terbanyak'

export function hitungRankingOutlet(
  outlets: OutletRatingBaris[],
  opsi?: { urutkan?: UrutanRanking; status?: string }
) {
  // Hanya outlet operasional aktif ritel
  let valid = outlets.filter((o) => {
    if (!o.isActive) return false
    const n = o.nama.toLowerCase()
    const s = o.slug.toLowerCase()
    // Abaikan cabang tes
    if (n.includes('tes') || n.includes('test')) return false
    // Pisahkan outlet non-ritel (seperti Kitchen Pusat / Gudang) dari leaderboard ulasan publik Google Maps
    if (n.includes('kitchen') || s.includes('kitchen') || n.includes('gudang')) return false
    return true
  })

  if (opsi?.status) {
    valid = valid.filter((o) => o.statusOperasional === opsi.status)
  }

  const urutan = opsi?.urutkan ?? 'tertinggi'
  valid.sort((a, b) => {
    const aPunya = a.totalUlasan > 0
    const bPunya = b.totalUlasan > 0

    // Outlet yang memiliki ulasan selalu diprioritaskan di atas outlet tanpa ulasan
    if (aPunya !== bPunya) {
      return aPunya ? -1 : 1
    }

    if (urutan === 'terendah') {
      if (a.ratingRataRata !== b.ratingRataRata) return a.ratingRataRata - b.ratingRataRata
      return b.totalUlasan - a.totalUlasan
    }
    if (urutan === 'ulasan_terbanyak') {
      if (a.totalUlasan !== b.totalUlasan) return b.totalUlasan - a.totalUlasan
      return b.ratingRataRata - a.ratingRataRata
    }
    // Default 'tertinggi': urutkan rating DESC, lalu sort sekunder: total ulasan DESC
    if (a.ratingRataRata !== b.ratingRataRata) return b.ratingRataRata - a.ratingRataRata
    return b.totalUlasan - a.totalUlasan
  })

  // Rata-rata rating jaringan hanya menghitung outlet yang memiliki ulasan nyata
  const outletBerulasan = valid.filter((o) => o.totalUlasan > 0)
  const totalRating = outletBerulasan.reduce((acc, o) => acc + o.ratingRataRata, 0)
  const rataRata = outletBerulasan.length > 0 ? Math.round((totalRating / outletBerulasan.length) * 10) / 10 : 0
  const totalUlasanSemua = valid.reduce((acc, o) => acc + o.totalUlasan, 0)

  const outletTanpaUlasan = valid.filter((o) => o.totalUlasan === 0).map((o) => o.nama)

  const peringkat = valid.map((o, idx) => ({
    peringkat: idx + 1,
    outlet: o.nama,
    rating: o.totalUlasan > 0 ? o.ratingRataRata : 0,
    total_ulasan: o.totalUlasan,
    status: o.statusOperasional,
    kota: o.kota ?? '-',
    ...(o.totalUlasan === 0 ? { catatan: 'Belum ada ulasan di Google Maps' } : {}),
  }))

  return {
    total_outlet: valid.length,
    total_outlet_berulasan: outletBerulasan.length,
    total_outlet_tanpa_ulasan: outletTanpaUlasan.length,
    rata_rata_rating: rataRata,
    total_ulasan_terkumpul: totalUlasanSemua,
    peringkat,
    ...(outletTanpaUlasan.length > 0 ? { outlet_tanpa_ulasan: outletTanpaUlasan } : {}),
  }
}

export function saringReviewNegatif(
  reviews: ReviewBaris[],
  opsi?: { limit?: number; hanyaUrgensiTinggi?: boolean }
) {
  // Negatif: rating <= 2 atau sentimen 'negative'
  let filtered = reviews.filter((r) => r.rating <= 2 || r.sentimen === 'negative')

  if (opsi?.hanyaUrgensiTinggi) {
    filtered = filtered.filter((r) => r.urgensi === 'high')
  }

  // Urutkan dari yang terbaru
  filtered.sort((a, b) => new Date(b.googleCreatedAt).getTime() - new Date(a.googleCreatedAt).getTime())

  const totalDitemukan = filtered.length
  const limit = Math.min(Math.max(opsi?.limit ?? 10, 1), 50)
  const ulasan = filtered.slice(0, limit).map((r) => ({
    id: r.id,
    outlet: r.outletNama,
    reviewer: r.reviewer,
    rating: r.rating,
    komentar: r.komentar ?? '(tanpa teks)',
    sentimen: r.sentimen ?? 'unknown',
    ringkasan_ai: r.ringkasanAi ?? '-',
    urgensi: r.urgensi ?? 'low',
    kategori: r.kategori,
    tanggal: r.googleCreatedAt.slice(0, 10),
  }))

  return {
    total_ulasan_negatif: totalDitemukan,
    ditampilkan: ulasan.length,
    daftar_ulasan: ulasan,
  }
}

export function agregasiSentimen(
  reviews: ReviewBaris[],
  opsi?: { rentangHari?: number; sekarang?: Date }
) {
  let target = [...reviews]
  if (opsi?.rentangHari && opsi?.sekarang) {
    const batasWaktu = opsi.sekarang.getTime() - opsi.rentangHari * 24 * 60 * 60 * 1000
    target = target.filter((r) => new Date(r.googleCreatedAt).getTime() >= batasWaktu)
  }

  const total = target.length
  let positif = 0
  let netral = 0
  let negatif = 0

  const bintang: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const komplainKategori: Record<string, number> = {}

  for (const r of target) {
    if (r.rating >= 1 && r.rating <= 5) {
      bintang[r.rating] = (bintang[r.rating] ?? 0) + 1
    }
    if (r.sentimen === 'positive' || (!r.sentimen && r.rating >= 4)) {
      positif++
    } else if (r.sentimen === 'negative' || (!r.sentimen && r.rating <= 2)) {
      negatif++
    } else {
      netral++
    }

    // Hitung topik komplain dari review rating <= 3 atau sentimen negatif
    if (r.rating <= 3 || r.sentimen === 'negative') {
      for (const kat of r.kategori) {
        komplainKategori[kat] = (komplainKategori[kat] ?? 0) + 1
      }
    }
  }

  const persen = (val: number) => (total > 0 ? Math.round((val / total) * 1000) / 10 : 0)

  const topikKomplain = Object.entries(komplainKategori)
    .map(([kategori, jumlah]) => ({ kategori, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 5)

  return {
    total_ulasan: total,
    sentimen: {
      positif: { jumlah: positif, persen: persen(positif) },
      netral: { jumlah: netral, persen: persen(netral) },
      negatif: { jumlah: negatif, persen: persen(negatif) },
    },
    distribusi_bintang: {
      bintang_5: bintang[5],
      bintang_4: bintang[4],
      bintang_3: bintang[3],
      bintang_2: bintang[2],
      bintang_1: bintang[1],
    },
    topik_keluhan_utama: topikKomplain,
  }
}

export function saringAlertAktif(
  alerts: AlertReviewBaris[],
  opsi?: { severity?: string; outletId?: string; limit?: number }
) {
  let aktif = alerts.filter((a) => a.status === 'active')

  if (opsi?.severity) {
    aktif = aktif.filter((a) => a.severity === opsi.severity)
  }
  if (opsi?.outletId) {
    aktif = aktif.filter((a) => a.outletId === opsi.outletId)
  }

  aktif.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const totalAktif = aktif.length
  const limit = Math.min(Math.max(opsi?.limit ?? 20, 1), 50)
  const ringkasanKeparahan = {
    critical: aktif.filter((a) => a.severity === 'critical').length,
    high: aktif.filter((a) => a.severity === 'high').length,
    medium: aktif.filter((a) => a.severity === 'medium').length,
    low: aktif.filter((a) => a.severity === 'low').length,
  }

  const daftar = aktif.slice(0, limit).map((a) => ({
    id: a.id,
    outlet: a.outletNama,
    tipe: a.tipe,
    severity: a.severity,
    judul: a.judul,
    pesan: a.pesan,
    waktu: a.createdAt,
  }))

  return {
    total_alert_aktif: totalAktif,
    rekap_keparahan: ringkasanKeparahan,
    daftar_alert: daftar,
  }
}
