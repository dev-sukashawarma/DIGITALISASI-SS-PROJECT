'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import {
  EmergencyCrewAssignment,
  CreateEmergencyAssignmentInput,
  EmergencyAssignmentStatus,
} from '@/lib/types'
import {
  validateEmergencyCrewEligibility,
  validateEmergencyAssignmentInput,
} from '@/lib/emergencyBackupValidation'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export interface GetEmergencyAssignmentsParams {
  date?: string // YYYY-MM-DD
  status?: 'all' | EmergencyAssignmentStatus
  outletId?: string // origin or target outlet
  month?: string // YYYY-MM
}

export async function getEmergencyAssignments(
  params?: GetEmergencyAssignmentsParams
): Promise<{ ok: boolean; data?: EmergencyCrewAssignment[]; error?: string }> {
  try {
    const admin = getAdminSupabase()

    let query = admin
      .from('emergency_crew_assignments')
      .select(`
        id,
        staff_id,
        origin_outlet_id,
        target_outlet_id,
        assignment_date,
        reason,
        status,
        assigned_by,
        created_at,
        updated_at,
        staff:outlet_staff!staff_id (
          id,
          name,
          role,
          sub_role,
          avatar_url,
          phone
        ),
        origin_outlet:outlets!origin_outlet_id (
          id,
          name,
          type
        ),
        target_outlet:outlets!target_outlet_id (
          id,
          name,
          type
        ),
        assigned_by_staff:outlet_staff!assigned_by (
          id,
          name
        )
      `)
      .order('assignment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (params?.date) {
      query = query.eq('assignment_date', params.date)
    } else if (params?.month) {
      // Filter by month (YYYY-MM)
      const startDate = `${params.month}-01`
      // Calculate end of month roughly
      const [year, monthNum] = params.month.split('-').map(Number)
      const lastDay = new Date(year, monthNum, 0).getDate()
      const endDate = `${params.month}-${String(lastDay).padStart(2, '0')}`
      query = query.gte('assignment_date', startDate).lte('assignment_date', endDate)
    }

    if (params?.status && params.status !== 'all') {
      query = query.eq('status', params.status)
    }

    if (params?.outletId && params.outletId !== 'all') {
      query = query.or(`origin_outlet_id.eq.${params.outletId},target_outlet_id.eq.${params.outletId}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[getEmergencyAssignments] error:', error)
      return { ok: false, error: error.message }
    }

    const rows = (data || []) as any[]

    // Fetch attendance logs for these staff members on their assignment dates at target outlets
    // to determine whether the crew actually attended at the backup location
    const assignmentsWithAttendance: EmergencyCrewAssignment[] = await Promise.all(
      rows.map(async (row) => {
        let todayAttendance = {
          has_attended: false,
          first_in: null as string | null,
          last_out: null as string | null,
        }

        try {
          const startDate = `${row.assignment_date}T00:00:00+07:00`
          const nextDayDate = new Date(`${row.assignment_date}T12:00:00+07:00`)
          nextDayDate.setDate(nextDayDate.getDate() + 1)
          const nextDayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(nextDayDate)
          const endDate = `${nextDayStr}T04:00:00+07:00`

          const { data: attLogs } = await admin
            .from('attendance')
            .select('id, type, ts_server, created_at')
            .eq('outlet_staff_id', row.staff_id)
            .eq('outlet_id', row.target_outlet_id)
            .gte('ts_server', startDate)
            .lte('ts_server', endDate)
            .order('ts_server', { ascending: true })

          if (attLogs && attLogs.length > 0) {
            const inLogs = attLogs.filter((a) => a.type === 'in' || a.type === 'masuk')
            const outLogs = attLogs.filter((a) => a.type === 'out' || a.type === 'pulang')

            todayAttendance = {
              has_attended: inLogs.length > 0,
              first_in: inLogs[0]?.ts_server || inLogs[0]?.created_at || null,
              last_out: outLogs[outLogs.length - 1]?.ts_server || outLogs[outLogs.length - 1]?.created_at || null,
            }
          }
        } catch {
          // Ignore attendance check failure, default to false
        }

        return {
          id: row.id,
          staff_id: row.staff_id,
          origin_outlet_id: row.origin_outlet_id,
          target_outlet_id: row.target_outlet_id,
          assignment_date: row.assignment_date,
          reason: row.reason,
          status: row.status,
          assigned_by: row.assigned_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          staff: row.staff,
          origin_outlet: row.origin_outlet,
          target_outlet: row.target_outlet,
          assigned_by_staff: row.assigned_by_staff,
          today_attendance: todayAttendance,
        }
      })
    )

    return { ok: true, data: assignmentsWithAttendance }
  } catch (err: any) {
    console.error('[getEmergencyAssignments] unexpected error:', err)
    return { ok: false, error: err.message || 'Gagal memuat data penugasan darurat' }
  }
}

export async function createEmergencyAssignment(
  input: CreateEmergencyAssignmentInput
): Promise<{ ok: boolean; data?: EmergencyCrewAssignment; error?: string }> {
  try {
    const { userId } = await requireRole(['admin', 'admin_hr', 'owner'])
    const admin = getAdminSupabase()

    const { staff_id, target_outlet_id, assignment_date, reason } = input

    if (!staff_id || !target_outlet_id || !assignment_date) {
      return { ok: false, error: 'Data penugasan darurat tidak lengkap (Karyawan, Outlet Tujuan, & Tanggal wajib diisi)' }
    }

    // 1. Validasi staf
    const { data: staff, error: staffErr } = await admin
      .from('outlet_staff')
      .select('id, name, role, sub_role, outlet_id, status, outlets!outlet_id(name)')
      .eq('id', staff_id)
      .single()

    if (staffErr || !staff) {
      console.error('[createEmergencyAssignment] staff validation error:', staffErr)
      return { ok: false, error: staffErr ? `Gagal memvalidasi karyawan: ${staffErr.message}` : 'Karyawan tidak ditemukan' }
    }

    const crewValidation = validateEmergencyCrewEligibility(staff)
    if (!crewValidation.ok) {
      return { ok: false, error: crewValidation.error }
    }

    const origin_outlet_id = staff.outlet_id!

    // 2. Validasi target outlet aktif
    const { data: targetOutlet, error: outletErr } = await admin
      .from('outlets')
      .select('id, name, is_active')
      .eq('id', target_outlet_id)
      .single()

    if (outletErr || !targetOutlet) {
      return { ok: false, error: 'Outlet tujuan tidak ditemukan' }
    }

    const inputValidation = validateEmergencyAssignmentInput({
      originOutletId: origin_outlet_id,
      targetOutletId: target_outlet_id,
      targetOutletActive: Boolean(targetOutlet.is_active),
      assignmentDate: assignment_date,
    })
    if (!inputValidation.ok) {
      return { ok: false, error: inputValidation.error }
    }

    // 3. Enforce 1 penugasan darurat per crew per hari
    const { data: existingAssignment } = await admin
      .from('emergency_crew_assignments')
      .select('id, status, assignment_date, target_outlet:outlets!target_outlet_id(name)')
      .eq('staff_id', staff_id)
      .eq('assignment_date', assignment_date)
      .maybeSingle()

    if (existingAssignment) {
      if (existingAssignment.status === 'active') {
        const targetName = (existingAssignment as any).target_outlet?.name || 'cabang lain'
        return {
          ok: false,
          error: `Karyawan "${staff.name}" sudah memiliki penugasan darurat aktif di ${targetName} pada tanggal ${assignment_date}. (Maksimal 1 outlet BKO per hari).`,
        }
      } else {
        // If previous assignment on this date was cancelled or completed, update it back to active with new target
        const { data: updated, error: updateErr } = await admin
          .from('emergency_crew_assignments')
          .update({
            origin_outlet_id,
            target_outlet_id,
            reason: reason || null,
            status: 'active',
            assigned_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAssignment.id)
          .select(`
            id, staff_id, origin_outlet_id, target_outlet_id, assignment_date,
            reason, status, assigned_by, created_at, updated_at
          `)
          .single()

        if (updateErr) {
          return { ok: false, error: updateErr.message }
        }

        revalidatePath('/emergency-backup')
        return { ok: true, data: updated as EmergencyCrewAssignment }
      }
    }

    // 4. Insert assignment baru
    const { data: inserted, error: insertErr } = await admin
      .from('emergency_crew_assignments')
      .insert({
        staff_id,
        origin_outlet_id,
        target_outlet_id,
        assignment_date,
        reason: reason || null,
        status: 'active',
        assigned_by: userId,
      })
      .select(`
        id, staff_id, origin_outlet_id, target_outlet_id, assignment_date,
        reason, status, assigned_by, created_at, updated_at
      `)
      .single()

    if (insertErr) {
      console.error('[createEmergencyAssignment] insert error:', insertErr)
      return { ok: false, error: insertErr.message }
    }

    revalidatePath('/emergency-backup')
    return { ok: true, data: inserted as EmergencyCrewAssignment }
  } catch (err: any) {
    console.error('[createEmergencyAssignment] unexpected error:', err)
    return { ok: false, error: err.message || 'Gagal membuat penugasan darurat' }
  }
}

export async function cancelEmergencyAssignment(
  assignmentId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRole(['admin', 'admin_hr', 'owner'])
    const admin = getAdminSupabase()

    if (!assignmentId) {
      return { ok: false, error: 'ID penugasan tidak valid' }
    }

    const { error } = await admin
      .from('emergency_crew_assignments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId)

    if (error) {
      console.error('[cancelEmergencyAssignment] error:', error)
      return { ok: false, error: error.message }
    }

    revalidatePath('/emergency-backup')
    return { ok: true }
  } catch (err: any) {
    console.error('[cancelEmergencyAssignment] unexpected error:', err)
    return { ok: false, error: err.message || 'Gagal membatalkan penugasan darurat' }
  }
}

export async function getEligibleRegularCrews(search?: string): Promise<{
  ok: boolean
  data?: Array<{
    id: string
    name: string
    role: string
    sub_role: string | null
    outlet_id: string
    outlet_name: string
    nik: string | null
  }>
  error?: string
}> {
  try {
    const admin = getAdminSupabase()

    // Fetch active regular crew
    let query = admin
      .from('outlet_staff')
      .select(`
        id,
        name,
        role,
        sub_role,
        outlet_id,
        nik,
        outlets!outlet_id (
          id,
          name
        )
      `)
      .eq('status', 'active')
      .not('outlet_id', 'is', null)
      .in('role', ['crew', 'crew_regular', 'crew_trainee'])
      .order('name', { ascending: true })

    if (search && search.trim()) {
      const q = search.trim()
      query = query.or(`name.ilike.%${q}%,nik.ilike.%${q}%`)
    }

    const { data, error } = await query.limit(100)

    if (error) {
      return { ok: false, error: error.message }
    }

    const result = (data || [])
      // Filter out crew_backup sub_role
      .filter((s: any) => s.sub_role !== 'crew_backup')
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        sub_role: s.sub_role,
        outlet_id: s.outlet_id,
        outlet_name: s.outlets?.name || 'Unknown Outlet',
        nik: s.nik,
      }))

    return { ok: true, data: result }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Gagal memuat daftar kru' }
  }
}

export async function getEmergencyOutlets(): Promise<{
  ok: boolean
  data?: Array<{ id: string; name: string; type: string }>
  error?: string
}> {
  try {
    const admin = getAdminSupabase()
    const { data, error } = await admin
      .from('outlets')
      .select('id, name, type')
      .eq('is_active', true)
      .not('type', 'in', '("marketplace","system")')
      .order('name', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data || [] }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Gagal memuat outlet' }
  }
}
