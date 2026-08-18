'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

const AUTHORIZED_ROLES = ['admin', 'owner', 'finance', 'purchasing', 'spv'] as const

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso'
  return createClient(url, key)
}

async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
}

async function requirePriceMasterEditor(): Promise<{ userId: string; userRole: string; userName: string }> {
  const authedClient = await getAuthedClient()
  const { data: { user }, error: userError } = await authedClient.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized: Tidak ada sesi aktif pengguna')
  }
  const userId = user.id

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status, name')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  
  // Jika staff aktif dan role ada di daftar otorisasi
  if (!staff || staff.status !== 'active' || !(AUTHORIZED_ROLES as readonly string[]).includes(staff.role)) {
    throw new Error('Forbidden: Hanya Admin / Finance / Purchasing / SPV yang berhak mengubah Harga Master')
  }

  return { userId, userRole: staff.role, userName: staff.name || 'User' }
}

export type SyncMasterItemInput = {
  bahan_baku_id: string
  harga_baru: number
  ref_po_id?: string | null
  catatan?: string | null
}

export async function syncMasterPriceAction(items: SyncMasterItemInput[]) {
  if (!items || items.length === 0) {
    throw new Error('Tidak ada item bahan baku yang dipilih untuk disinkronkan')
  }

  const { userId, userName } = await requirePriceMasterEditor()
  const supabase = makeServiceClient()

  const results: { bahan_baku_id: string; success: boolean; error?: string }[] = []

  for (const item of items) {
    try {
      // 1. Ambil harga lama saat ini
      const { data: currentPriceRow } = await supabase
        .from('bahan_baku_harga')
        .select('harga_beli')
        .eq('bahan_baku_id', item.bahan_baku_id)
        .maybeSingle()

      const hargaLama = currentPriceRow?.harga_beli ?? null

      // 2. Upsert ke tabel master bahan_baku_harga
      const { error: upsertErr } = await supabase
        .from('bahan_baku_harga')
        .upsert({
          bahan_baku_id: item.bahan_baku_id,
          harga_beli: item.harga_baru,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'bahan_baku_id'
        })

      if (upsertErr) throw upsertErr

      // 3. Catat riwayat audit ke bahan_baku_harga_history
      const { error: histErr } = await supabase
        .from('bahan_baku_harga_history')
        .insert({
          bahan_baku_id: item.bahan_baku_id,
          harga_lama: hargaLama,
          harga_baru: item.harga_baru,
          ref_po_id: item.ref_po_id || null,
          catatan: item.catatan || `Sinkronisasi dari PO Vendor oleh ${userName}`,
          changed_by: userId,
          changed_at: new Date().toISOString()
        })

      if (histErr) {
        console.warn('Gagal mencatat history perubahan harga:', histErr.message)
      }

      results.push({ bahan_baku_id: item.bahan_baku_id, success: true })
    } catch (err: any) {
      console.error(`Gagal sync harga master untuk ${item.bahan_baku_id}:`, err)
      results.push({ bahan_baku_id: item.bahan_baku_id, success: false, error: err.message })
    }
  }

  const successCount = results.filter(r => r.success).length
  if (successCount === 0 && items.length > 0) {
    throw new Error('Gagal memperbarui harga master: ' + (results[0]?.error || 'Terjadi kesalahan sistem'))
  }

  return {
    success: true,
    total: items.length,
    successCount,
    failedCount: items.length - successCount,
    results
  }
}
