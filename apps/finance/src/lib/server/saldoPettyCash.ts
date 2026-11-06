import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { SaldoOutlet } from '@/lib/pettyCash/laporan'

/**
 * Saldo petty cash TERKINI per outlet dari get_petty_cash_snapshot (sumber angka
 * yang sama dengan app kasir & dashboard leader). Dipanggil dengan sesi pemakai,
 * jadi tunduk accessible_outlet_ids(). Tidak terpengaruh filter periode.
 */
export async function ambilSaldoPettyCash(outlets: { id: string; name: string }[]): Promise<SaldoOutlet[]> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  return Promise.all(
    outlets.map(async (o): Promise<SaldoOutlet> => {
      const { data, error } = await supabase.rpc('get_petty_cash_snapshot', { p_outlet_id: o.id })
      if (error || !data) return { outletId: o.id, nama: o.name, saldo: null, shiftAktif: false, dihitungPada: null }
      const snap = data as Record<string, unknown>
      return {
        outletId: o.id,
        nama: o.name,
        saldo: Number(snap.current_balance ?? 0) || 0,
        shiftAktif: snap.has_active_shift === true,
        dihitungPada: typeof snap.calculated_at === 'string' ? snap.calculated_at : null,
      }
    }),
  )
}
