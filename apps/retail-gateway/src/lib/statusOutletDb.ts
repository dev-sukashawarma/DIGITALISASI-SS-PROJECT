import { createServiceClient } from './supabase'
import { statusOutlet, type StatusOutlet, type TutupSementara } from './jamBuka'
import { ambilPengaturan } from './pengaturanApp'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Tutup sementara yang masih berlaku. Kunci '*' = baris outlet_id NULL (semua).
 * MELEMPAR bila DB gagal: pemanggil di jalur pembayaran harus gagal-tertutup.
 */
export async function tutupSementaraAktif(outletIds: string[]): Promise<Map<string, TutupSementara[]>> {
  // `outletIds` masuk ke filter PostgREST sebagai string mentah lewat `.or()`.
  // Disaring ke bentuk UUID dulu supaya id yang aneh (koma/tanda kurung) tidak
  // bisa mengubah bentuk kueri -- id outlet sah selalu UUID.
  const idAman = outletIds.filter((id) => UUID_RE.test(id))

  let query = createServiceClient()
    .from('outlet_tutup_sementara')
    .select('outlet_id, sampai, alasan')
    .is('dicabut_pada', null)
    .gt('sampai', new Date().toISOString())

  query = idAman.length > 0
    ? query.or(`outlet_id.is.null,outlet_id.in.(${idAman.join(',')})`)
    : query.is('outlet_id', null)

  const { data, error } = await query
  if (error) throw new Error(`Gagal membaca tutup sementara: ${error.message}`)

  const peta = new Map<string, TutupSementara[]>()
  for (const r of data ?? []) {
    const kunci = r.outlet_id ?? '*'
    const daftar = peta.get(kunci) ?? []
    daftar.push({ sampai: new Date(r.sampai), alasan: r.alasan })
    peta.set(kunci, daftar)
  }
  return peta
}

export async function statusUntuk(
  outlet: { id: string; open_hour: string | null; close_hour: string | null; is_active: boolean },
  peta?: Map<string, TutupSementara[]>,
): Promise<StatusOutlet> {
  const [pengaturan, tutup] = await Promise.all([
    ambilPengaturan(),
    peta ? Promise.resolve(peta) : tutupSementaraAktif([outlet.id]),
  ])
  return statusOutlet({
    sekarang: new Date(),
    openHour: outlet.open_hour,
    closeHour: outlet.close_hour,
    isActive: outlet.is_active,
    tutupSementara: [...(tutup.get(outlet.id) ?? []), ...(tutup.get('*') ?? [])],
    menitPesanTerakhir: pengaturan.menitPesanTerakhir,
  })
}
