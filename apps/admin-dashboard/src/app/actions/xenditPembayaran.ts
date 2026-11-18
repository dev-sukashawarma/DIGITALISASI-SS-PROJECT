'use server'

import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { parseBalanceHistory } from '@/lib/xendit/balanceHistory'
import { prosesUnggahXendit, type DbXendit, type RingkasanUnggah } from '@/lib/xendit/unggah'
import { bersihkanMemoXendit } from '@/lib/posReport/xenditLoad'

const PERAN_UNGGAH = ['admin', 'owner', 'admin_finance']
const POTONG = 200 // panjang URL .in() aman

function potong<T>(arr: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += POTONG) out.push(arr.slice(i, i + POTONG))
  return out
}

function dbDari(supabase: ReturnType<typeof createServiceClient>): DbXendit {
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

export async function unggahFileXendit(formData: FormData): Promise<
  { success: true; ringkasan: RingkasanUnggah } | { success: false; error: string }
> {
  try {
    const { userId } = await requireRole(PERAN_UNGGAH)
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return { success: false, error: 'File belum dipilih.' }
    const baris = parseBalanceHistory(await file.text())
    if (baris.length === 0) return { success: false, error: 'Tidak ada pembayaran masuk di file ini.' }
    const ringkasan = await prosesUnggahXendit(dbDari(createServiceClient()), baris, { namaFile: file.name, userId })
    bersihkanMemoXendit()
    return { success: true, ringkasan }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}
