import { fetchAllPages } from '@/lib/fetchAllPages'
import type { DbXendit } from './unggah'

const POTONG = 200 // panjang URL .in() aman

function potong<T>(arr: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += POTONG) out.push(arr.slice(i, i + POTONG))
  return out
}

/** Akses xendit_pembayaran & orders lewat klien Supabase (service role) untuk prosesUnggahXendit. */
export function dbXenditSupabase(supabase: any): DbXendit {
  const cek = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
  return {
    async ambilPembayaran(ids) {
      const hasil: any[] = []
      for (const bagian of potong(ids)) {
        const { data, error } = await supabase.from('xendit_pembayaran')
          .select('xendit_id, external_order_id, cara_cocok, sumber, nominal, dibayar_at').in('xendit_id', bagian)
        cek(error); hasil.push(...(data ?? []))
      }
      return hasil
    },
    async sisipkan(rows) {
      for (const bagian of potong(rows)) cek((await supabase.from('xendit_pembayaran').insert(bagian)).error)
    },
    async perbarui(rows) {
      for (const r of rows) {
        const { xendit_id, ...isi } = r
        cek((await supabase.from('xendit_pembayaran').update(isi).eq('xendit_id', xendit_id)).error)
      }
    },
    async ambilPesananWebsite(dari, sampai) {
      return fetchAllPages(() => supabase.from('orders')
        .select('external_order_id, total_amount, created_at, outlet_id, sales_source')
        .eq('sales_source', 'online').not('external_order_id', 'is', null)
        .gte('created_at', dari).lte('created_at', sampai)
        .order('id', { ascending: true }))
    },
    async externalTertaut(ids) {
      const s = new Set<string>()
      for (const bagian of potong(ids)) {
        const { data, error } = await supabase.from('xendit_pembayaran').select('external_order_id').in('external_order_id', bagian)
        cek(error); (data ?? []).forEach((r: any) => s.add(r.external_order_id))
      }
      return s
    },
    async tautkan(rows) {
      for (const r of rows) {
        const { xendit_id, ...isi } = r
        // Jangan timpa tautan yang terlanjur diisi webhook di sela proses.
        cek((await supabase.from('xendit_pembayaran').update(isi).eq('xendit_id', xendit_id).is('external_order_id', null)).error)
      }
    },
  }
}

