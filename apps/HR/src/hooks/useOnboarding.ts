'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { CrewSubRole, OnboardingStage, CrewOnboardingEvaluation } from '@/lib/types'
import { isTestOrDevStaff } from '@/lib/staffFilters'
import { isTestOutlet } from '@/lib/outletFilters'
import { saveCrewEvaluationAction, updateOnboardingStageAction, type SaveEvaluationParams } from '@/app/actions/onboarding'

export interface TraineeRecord {
  id: string
  name: string
  username: string | null
  role: string
  sub_role: CrewSubRole
  onboarding_stage: OnboardingStage
  training_start_date: string | null
  join_date: string | null
  phone: string | null
  outlet_id: string | null
  outlet_name: string
  outlet_ids: string[]
  day_count: number
  training_attendance_days: number
  training_meal_allowance: number
  is_evaluation_ready: boolean
  days_until_evaluation: number
  latest_evaluation: CrewOnboardingEvaluation | null
}

export function useOnboarding(filters?: { outletId?: string; stage?: string; subRole?: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<TraineeRecord[]>({
    queryKey: ['onboarding-crew', filters],
    staleTime: 30_000,
    queryFn: async () => {
      // 1. Fetch crew trainees
      let staffQuery = supabase
        .from('outlet_staff')
        .select(`
          id, name, username, role, sub_role, onboarding_stage, training_start_date, join_date, phone, outlet_id, status,
          outlets!outlet_staff_outlet_id_fkey(name),
          staff_outlets(outlet_id)
        `)
        .eq('role', 'crew')
        .order('training_start_date', { ascending: false })

      if (filters?.outletId && filters.outletId !== 'all') {
        staffQuery = staffQuery.eq('outlet_id', filters.outletId)
      }

      const { data: staffData, error: staffError } = await staffQuery
      if (staffError) throw staffError

      const rawStaff = (staffData ?? []).filter(
        (s: any) => !isTestOrDevStaff(s) && !isTestOutlet(s.outlets)
      )

      if (!rawStaff.length) return []

      const staffIds = rawStaff.map((s: any) => s.id)

      // 2. Fetch attendance logs for these trainees
      const { data: attendanceData } = await supabase
        .from('attendance_logs')
        .select('staff_id, date, status')
        .in('staff_id', staffIds)
        .in('status', ['hadir', 'terlambat'])

      // 3. Fetch evaluations
      const { data: evalData } = await supabase
        .from('crew_onboarding_evaluations')
        .select(`
          id, staff_id, evaluator_id, outlet_id, evaluation_date, day_count_at_eval, decision, scores, notes, status, created_at,
          evaluator:outlet_staff!crew_onboarding_evaluations_evaluator_id_fkey(name, role)
        `)
        .in('staff_id', staffIds)
        .order('created_at', { ascending: false })

      const attendanceMap = new Map<string, Set<string>>()
      ;(attendanceData ?? []).forEach((a: any) => {
        if (!attendanceMap.has(a.staff_id)) {
          attendanceMap.set(a.staff_id, new Set())
        }
        attendanceMap.get(a.staff_id)!.add(a.date)
      })

      const evalMap = new Map<string, any>()
      ;(evalData ?? []).forEach((e: any) => {
        if (!evalMap.has(e.staff_id)) {
          evalMap.set(e.staff_id, e)
        }
      })

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const result: TraineeRecord[] = rawStaff.map((s: any) => {
        const startDateStr = s.training_start_date || s.join_date || s.created_at?.split('T')[0]
        let dayCount = 1

        if (startDateStr) {
          const start = new Date(startDateStr)
          start.setHours(0, 0, 0, 0)
          const diffMs = today.getTime() - start.getTime()
          dayCount = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1)
        }

        // Count attendance days within the 7-day training period
        let trainingAttendanceDays = 0
        if (startDateStr && attendanceMap.has(s.id)) {
          const userLogs = attendanceMap.get(s.id)!
          const start = new Date(startDateStr)
          for (let i = 0; i < 7; i++) {
            const checkDate = new Date(start)
            checkDate.setDate(start.getDate() + i)
            const dateStr = checkDate.toISOString().split('T')[0]
            if (userLogs.has(dateStr)) {
              trainingAttendanceDays++
            }
          }
        }

        const mealAllowance = trainingAttendanceDays * 15000
        const isEvalReady = dayCount >= 15
        const daysUntilEval = Math.max(0, 15 - dayCount)

        return {
          id: s.id,
          name: s.name,
          username: s.username,
          role: s.role,
          sub_role: s.sub_role || 'crew_regular',
          onboarding_stage: s.onboarding_stage || 'regular',
          training_start_date: s.training_start_date || null,
          join_date: s.join_date || null,
          phone: s.phone || null,
          outlet_id: s.outlet_id,
          outlet_name: s.outlets?.name || 'Kantor Pusat',
          outlet_ids: (s.staff_outlets ?? []).map((o: any) => o.outlet_id),
          day_count: dayCount,
          training_attendance_days: trainingAttendanceDays,
          training_meal_allowance: mealAllowance,
          is_evaluation_ready: isEvalReady,
          days_until_evaluation: daysUntilEval,
          latest_evaluation: evalMap.get(s.id) || null,
        }
      })

      // Apply client stage filter if requested
      if (filters?.stage && filters.stage !== 'all') {
        return result.filter((r) => r.onboarding_stage === filters.stage)
      }

      if (filters?.subRole && filters.subRole !== 'all') {
        return result.filter((r) => r.sub_role === filters.subRole)
      }

      return result
    },
  })

  const saveEvaluation = useMutation({
    mutationFn: (params: SaveEvaluationParams) => saveCrewEvaluationAction(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-crew'] })
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })

  const updateStage = useMutation({
    mutationFn: (params: { staff_id: string; stage: OnboardingStage }) => updateOnboardingStageAction(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-crew'] })
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })

  return {
    ...query,
    saveEvaluation,
    updateStage,
  }
}
