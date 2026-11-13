import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'

/** Order Online hanya mengenal 'owned' | 'partner'. */
export function tipeOrderOnline(jenis: string | null | undefined): 'owned' | 'partner' {
  return jenis === 'mitra' ? 'partner' : 'owned'
}

export interface OutletUntukOrderOnline {
  id: string
  slug: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  type: string | null
  is_active: boolean
  open_hour: string | null
  close_hour: string | null
}

function klienOrderOnline() {
  try {
    return createOrderOnlineAdminClient()
  } catch {
    console.warn('Order Online not configured, skipping sync')
    return null
  }
}

/** Update bila baris sudah ada, insert bila belum. Melempar bila Order Online menolak. */
export async function sinkronOutletKeOrderOnline(o: OutletUntukOrderOnline): Promise<void> {
  const oo = klienOrderOnline()
  if (!oo) return
  const baris = {
    pos_outlet_id: o.id,
    name: o.name,
    slug: o.slug,
    address: o.address || '-',
    lat: o.lat,
    lng: o.lng,
    type: tipeOrderOnline(o.type),
    is_active: o.is_active,
    open_hour: o.open_hour || '14:00',
    close_hour: o.close_hour || '22:00',
  }
  // Sama dengan updateOutlet: baris lama bisa ber-id lain tapi pos_outlet_id = id POS.
  const { data: ada, error: errCari } = await oo
    .from('outlets')
    .select('id, slug')
    .or(`pos_outlet_id.eq.${o.id},id.eq.${o.id}`)
    .maybeSingle()
  if (errCari) throw new Error(errCari.message)
  const { error } = ada
    ? await oo
        .from('outlets')
        .update({ ...baris, slug: ada.slug || o.slug, updated_at: new Date().toISOString() })
        .eq('id', ada.id)
    : await oo.from('outlets').insert({ id: o.id, ...baris })
  if (error) throw new Error(error.message)
}

export async function hapusOutletDiOrderOnline(id: string): Promise<void> {
  const oo = klienOrderOnline()
  if (!oo) return
  const { error } = await oo.from('outlets').delete().or(`pos_outlet_id.eq.${id},id.eq.${id}`)
  if (error) throw new Error(error.message)
}
