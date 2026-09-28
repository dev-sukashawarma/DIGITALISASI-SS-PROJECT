'use server'

import { requireRole } from '@/lib/authz'
import { getServiceSupabase } from '@/lib/supabase-service'

export interface OpexExemptionRecord {
  id: string
  month: number
  year: number
  unit_id: string
  category: string
  quick_reason?: string | null
  notes?: string | null
  marked_by?: string | null
  created_at: string
  updated_at: string
}

export async function getOpexExemptionsAction(month: number, year: number) {
  try {
    await requireRole(['admin_finance', 'admin', 'owner', 'developer'])
    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('eom_opex_exemptions')
      .select('*')
      .eq('month', month)
      .eq('year', year)

    if (error) throw new Error(error.message)
    return { success: true, exemptions: (data ?? []) as OpexExemptionRecord[] }
  } catch (err: any) {
    console.error('getOpexExemptionsAction error:', err)
    return { success: false, error: err?.message || 'Gagal memuat status nihil OPEX' }
  }
}

export async function setOpexExemptionAction(input: {
  month: number
  year: number
  unitId: string
  category: string
  quickReason?: string | null
  notes?: string | null
  markedBy?: string | null
}) {
  try {
    await requireRole(['admin_finance', 'admin', 'owner', 'developer'])
    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('eom_opex_exemptions')
      .upsert(
        {
          month: input.month,
          year: input.year,
          unit_id: input.unitId,
          category: input.category,
          quick_reason: input.quickReason || null,
          notes: input.notes || null,
          marked_by: input.markedBy || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'month, year, unit_id, category',
        }
      )
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { success: true, data: data as OpexExemptionRecord }
  } catch (err: any) {
    console.error('setOpexExemptionAction error:', err)
    return { success: false, error: err?.message || 'Gagal menandai kategori nihil' }
  }
}

export async function removeOpexExemptionAction(input: {
  month: number
  year: number
  unitId: string
  category: string
}) {
  try {
    await requireRole(['admin_finance', 'admin', 'owner', 'developer'])
    const supabase = getServiceSupabase()

    const { error } = await supabase
      .from('eom_opex_exemptions')
      .delete()
      .eq('month', input.month)
      .eq('year', input.year)
      .eq('unit_id', input.unitId)
      .eq('category', input.category)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (err: any) {
    console.error('removeOpexExemptionAction error:', err)
    return { success: false, error: err?.message || 'Gagal membatalkan status nihil' }
  }
}
