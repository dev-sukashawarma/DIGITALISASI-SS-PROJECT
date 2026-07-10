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

async function getCurrentUserId(): Promise<string> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: No active user session found')
  }
  return user.id
}

export type WasteReportData = {
  outlet_id: string;
  bahan_baku_id: string;
  qty: number;
  reason: string;
  photo_url: string;
}

export async function submitWasteReport(data: WasteReportData): Promise<void> {
  const supabase = makeServiceClient()
  const currentUserId = await getCurrentUserId()
  
  const { error } = await supabase
    .from('stok_waste_reports')
    .insert({
      ...data,
      reported_by: currentUserId,
      status: 'PENDING'
    })

  if (error) throw new Error(error.message)
}

export async function approveWasteReport(id: string): Promise<void> {
  const supabase = makeServiceClient()
  const currentUserId = await getCurrentUserId()
  
  const { error } = await supabase
    .from('stok_waste_reports')
    .update({
      status: 'APPROVED',
      approved_by: currentUserId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('status', 'PENDING') // ensure it's still pending

  if (error) throw new Error(error.message)
}

export async function rejectWasteReport(id: string, reason: string): Promise<void> {
  const supabase = makeServiceClient()
  const currentUserId = await getCurrentUserId()
  
  const { error } = await supabase
    .from('stok_waste_reports')
    .update({
      status: 'REJECTED',
      rejection_reason: reason,
      approved_by: currentUserId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('status', 'PENDING')

  if (error) throw new Error(error.message)
}

export async function fetchPendingWasteReports(outletId?: string) {
  const supabase = makeServiceClient()
  let query = supabase
    .from('stok_waste_reports')
    .select('*, bahan_baku(nama, satuan), outlets(name), reported_by_staff:outlet_staff!reported_by(name)')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })

  if (outletId) {
    query = query.eq('outlet_id', outletId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function countPendingWasteReports(outletId?: string) {
  const supabase = makeServiceClient()
  let query = supabase
    .from('stok_waste_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDING')

  if (outletId) {
    query = query.eq('outlet_id', outletId)
  }

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count || 0
}
