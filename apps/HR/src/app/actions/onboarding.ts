'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import type { OnboardingStage } from '@/lib/types'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export interface SaveEvaluationParams {
  staff_id: string
  evaluator_id?: string | null
  outlet_id?: string | null
  day_count_at_eval: number
  decision: 'pass_pkwt' | 'extend_ojt' | 'failed'
  scores: {
    technical?: number
    sop?: number
    hygiene?: number
    attendance?: number
    attitude?: number
    [key: string]: any
  }
  notes?: string | null
  status?: 'draft' | 'submitted' | 'verified_hr'
}

export async function saveCrewEvaluationAction(params: SaveEvaluationParams): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRole(['admin', 'owner', 'admin_hr', 'area_manager', 'regional_manager'])
    const admin = getAdminSupabase()

    const { staff_id, evaluator_id, outlet_id, day_count_at_eval, decision, scores, notes, status = 'submitted' } = params

    if (!staff_id) return { ok: false, error: 'Staff ID wajib diisi' }
    if (day_count_at_eval < 15) {
      return { ok: false, error: 'Form kelayakan baru dapat diisi setelah hari ke-15 masa kerja/training.' }
    }

    // Upsert evaluation
    const { error: evalError } = await admin
      .from('crew_onboarding_evaluations')
      .insert({
        staff_id,
        evaluator_id: evaluator_id || null,
        outlet_id: outlet_id || null,
        evaluation_date: new Date().toISOString().split('T')[0],
        day_count_at_eval,
        decision,
        scores,
        notes: notes || null,
        status,
        updated_at: new Date().toISOString(),
      })

    if (evalError) throw evalError

    // If decision is pass_pkwt or failed, update onboarding_stage on outlet_staff accordingly
    if (decision === 'pass_pkwt') {
      await admin
        .from('outlet_staff')
        .update({
          onboarding_stage: 'graduated',
          contract_type: 'contract', // PKWT
        })
        .eq('id', staff_id)
    } else if (decision === 'failed') {
      await admin
        .from('outlet_staff')
        .update({
          onboarding_stage: 'failed',
        })
        .eq('id', staff_id)
    } else if (decision === 'extend_ojt') {
      await admin
        .from('outlet_staff')
        .update({
          onboarding_stage: 'ojt',
        })
        .eq('id', staff_id)
    }

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Gagal menyimpan evaluasi kelayakan crew' }
  }
}

export async function updateOnboardingStageAction(params: {
  staff_id: string
  stage: OnboardingStage
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRole(['admin', 'owner', 'admin_hr', 'area_manager'])
    const admin = getAdminSupabase()

    const { staff_id, stage } = params
    if (!staff_id) return { ok: false, error: 'Staff ID tidak valid' }

    const patch: Record<string, any> = { onboarding_stage: stage }
    if (stage === 'graduated') {
      patch.contract_type = 'contract'
    }

    const { error } = await admin.from('outlet_staff').update(patch).eq('id', staff_id)
    if (error) throw error

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Gagal memperbarui tahapan onboarding' }
  }
}
