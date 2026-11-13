/**
 * Outlet yang ditampilkan sebagai kartu di Dashboard Kemitraan.
 *
 * Ikut tampil bila outlet punya data kemitraan (investasi, profil mitra, atau
 * transfer bagi hasil) — sekalipun outletnya sudah nonaktif, supaya riwayat
 * outlet yang tutup (mis. Ciseeng) tetap bisa dilihat.
 *
 * Outlet bertipe mitra TANPA data apa pun hanya tampil selama masih aktif atau
 * masih Persiapan. Outlet mitra nonaktif yang kosong (mis. outlet uji) disembunyikan.
 */
type OutletRingkas = {
  id: string
  type?: string | null
  is_active?: boolean | null
  status?: string | null
}

export function idOutletKemitraan(input: {
  outlets: OutletRingkas[]
  profiles?: { outlet_ids?: string[] | null }[]
  investments?: { outlet_id?: string | null }[]
  transfers?: { outlet_id?: string | null }[]
}): string[] {
  const punyaData = new Set<string>()
  for (const p of input.profiles ?? []) for (const id of p.outlet_ids ?? []) punyaData.add(id)
  for (const i of input.investments ?? []) if (i.outlet_id) punyaData.add(i.outlet_id)
  for (const t of input.transfers ?? []) if (t.outlet_id) punyaData.add(t.outlet_id)

  const hasil = new Set<string>(punyaData)
  for (const o of input.outlets) {
    if (o.type !== 'mitra') continue
    const masihJalan = o.is_active === true || o.status === 'pending'
    if (masihJalan) hasil.add(o.id)
  }
  return Array.from(hasil)
}
