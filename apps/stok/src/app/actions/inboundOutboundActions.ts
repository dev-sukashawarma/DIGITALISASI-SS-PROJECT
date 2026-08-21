'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { InboundOutboundTipe } from '@/types/stok'

const AUTHORIZED_ROLES = ['admin', 'owner', 'finance', 'purchasing', 'spv', 'kitchen'] as const

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

async function requireAuthorizedUser(): Promise<{ userId: string; userRole: string; userName: string }> {
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
  
  if (!staff || staff.status !== 'active' || !(AUTHORIZED_ROLES as readonly string[]).includes(staff.role)) {
    throw new Error('Forbidden: Akses ditolak. Hanya role terkait yang berhak mencatat mutasi Inbound/Outbound.')
  }

  return { userId, userRole: staff.role, userName: staff.name || 'User' }
}

export type SubmitMutasiInput = {
  outlet_id: string
  bahan_baku_id: string
  tipe: InboundOutboundTipe
  kategori: string
  qty: number
  catatan?: string
}

export async function submitInboundOutboundAction(input: SubmitMutasiInput) {
  const { userId } = await requireAuthorizedUser()
  const supabase = makeServiceClient()

  // Ambil harga beli acuan dari master secara otomatis
  let harga_satuan: number | null = null;
  const { data: hargaData } = await supabase
    .from('bahan_baku_harga')
    .select('harga_beli_display, harga_beli')
    .eq('bahan_baku_id', input.bahan_baku_id)
    .maybeSingle()
    
  if (hargaData) {
    harga_satuan = hargaData.harga_beli_display ?? hargaData.harga_beli ?? null
  }

  const { data, error } = await supabase
    .from('inbound_outbound')
    .insert({
      outlet_id: input.outlet_id,
      bahan_baku_id: input.bahan_baku_id,
      tipe: input.tipe,
      kategori: input.kategori,
      qty: input.qty,
      harga_satuan,
      catatan: input.catatan || null,
      created_by: userId
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, data }
}
