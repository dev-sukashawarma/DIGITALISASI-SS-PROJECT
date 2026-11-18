'use server'

import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { parseBalanceHistory } from '@/lib/xendit/balanceHistory'
import { prosesUnggahXendit, type RingkasanUnggah } from '@/lib/xendit/unggah'
import { dbXenditSupabase } from '@/lib/xendit/dbSupabase'
import { bersihkanMemoXendit } from '@/lib/posReport/xenditLoad'

const PERAN_UNGGAH = ['admin', 'owner', 'admin_finance']
export async function unggahFileXendit(formData: FormData): Promise<
  { success: true; ringkasan: RingkasanUnggah } | { success: false; error: string }
> {
  try {
    const { userId } = await requireRole(PERAN_UNGGAH)
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return { success: false, error: 'File belum dipilih.' }
    const baris = parseBalanceHistory(await file.text())
    if (baris.length === 0) return { success: false, error: 'Tidak ada pembayaran masuk di file ini.' }
    const ringkasan = await prosesUnggahXendit(dbXenditSupabase(createServiceClient()), baris, { namaFile: file.name, userId })
    bersihkanMemoXendit()
    return { success: true, ringkasan }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}
