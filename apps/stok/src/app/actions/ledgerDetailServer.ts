'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

function makeServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Server Action = endpoint POST publik; makeServiceClient() bypass RLS, jadi
// wajib gerbang sesi sendiri sebelum baca data (lihat CLAUDE.md § Server
// Action authz gap). Ledger yang jadi sumber id di sini sudah RLS-scoped di
// LedgerDetail.tsx, jadi cukup pastikan ada sesi aktif — bukan data
// finansial/privileged, hanya nama pelapor/penyetuju waste + URL foto.
async function requireActiveStaff(): Promise<void> {
  const cookieStore = await cookies()
  const authedClient = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
  const { data: { user }, error } = await authedClient.auth.getUser()
  if (error || !user) throw new Error('Unauthorized: sesi tidak ditemukan')

  const { data: staff } = await makeServiceClient()
    .from('outlet_staff')
    .select('status')
    .eq('id', user.id)
    .maybeSingle()
  if (!staff || staff.status !== 'active') throw new Error('Unauthorized: staff tidak aktif')
}

export async function getWasteReportDetailsForLedger(id: string) {
  await requireActiveStaff()
  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('stok_waste_reports')
    .select('photo_url, created_at, updated_at, reported_by_staff:outlet_staff!reported_by(name), approved_by_staff:outlet_staff!approved_by(name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function getStaffNameForLedger(id: string) {
  await requireActiveStaff()
  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('outlet_staff')
    .select('name')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? data.name : null
}
