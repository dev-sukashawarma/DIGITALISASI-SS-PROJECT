'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { AttendanceLog, AttendanceFilterValues } from '@/lib/types'
import { isTestOrDevStaff } from '@/lib/staffFilters'
import { isTestOutlet } from '@/lib/outletFilters'

export function useAttendance(filter: AttendanceFilterValues) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Realtime subscription for instant clock in/out updates
  useEffect(() => {
    const channel = supabase
      .channel('attendance-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['attendance'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['attendance'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return useQuery<AttendanceLog[]>({
    queryKey: ['attendance', filter],
    staleTime: 10_000,
    refetchInterval: 10_000, // 10s fallback polling
    queryFn: async () => {
      // 1. Query attendance table for records
      let query = supabase
        .from('attendance')
        .select(`
          id, outlet_staff_id, outlet_id, type, ts_server, status,
          selfie_url, gps_lat, gps_lng, telat_menit, is_manual_button,
          outlets!attendance_outlet_id_fkey(name)
        `)
        .order('ts_server', { ascending: false })
        .limit(1000)

      if (filter.dateFrom) {
        query = query.gte('ts_server', `${filter.dateFrom}T00:00:00.000+07:00`)
      }
      if (filter.dateTo) {
        query = query.lte('ts_server', `${filter.dateTo}T23:59:59.999+07:00`)
      }
      if (filter.outletId && filter.outletId !== 'all') {
        query = query.eq('outlet_id', filter.outletId)
      }

      let { data: rawRows, error } = await query

      const wibDate = (ts: string | null) =>
        ts ? new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : ''

      // Manajer lintas outlet bisa masuk di outlet A lalu pulang di outlet B.
      // Saat difilter per outlet, ambil juga pasangan absennya di outlet lain
      // (staf & tanggal sama) agar jam & foto pulangnya tetap tampil.
      if (!error && rawRows && rawRows.length > 0 && filter.outletId && filter.outletId !== 'all') {
        const dayKeys = new Set(rawRows.map((r) => `${r.outlet_staff_id}|${wibDate(r.ts_server)}`))
        const staffIds = Array.from(new Set(rawRows.map((r) => r.outlet_staff_id).filter(Boolean)))
        let pairQuery = supabase
          .from('attendance')
          .select(`
            id, outlet_staff_id, outlet_id, type, ts_server, status,
            selfie_url, gps_lat, gps_lng, telat_menit, is_manual_button,
            outlets!attendance_outlet_id_fkey(name)
          `)
          .in('outlet_staff_id', staffIds)
          .neq('outlet_id', filter.outletId)
          .order('ts_server', { ascending: false })
          .limit(1000)
        if (filter.dateFrom) pairQuery = pairQuery.gte('ts_server', `${filter.dateFrom}T00:00:00.000+07:00`)
        if (filter.dateTo) pairQuery = pairQuery.lte('ts_server', `${filter.dateTo}T23:59:59.999+07:00`)
        const { data: pairRows } = await pairQuery
        const pasangan = (pairRows ?? []).filter((r) => dayKeys.has(`${r.outlet_staff_id}|${wibDate(r.ts_server)}`))
        rawRows = [...rawRows, ...pasangan]
      }

      if (error || !rawRows) {
        // Fallback to attendance_logs if attendance query fails
        let logQuery = supabase
          .from('attendance_logs')
          .select(`
            id, staff_id, outlet_id, date, clock_in, clock_out,
            status, late_minutes, notes, created_at, updated_at,
            stealth_photo_in_url, stealth_photo_out_url,
            outlet_staff!attendance_logs_staff_id_fkey(name, role, username),
            outlets!attendance_logs_outlet_id_fkey(name)
          `)
          .gte('date', filter.dateFrom)
          .lte('date', filter.dateTo)
          .order('date', { ascending: false })

        if (filter.outletId && filter.outletId !== 'all') {
          logQuery = logQuery.eq('outlet_id', filter.outletId)
        }
        const { data: logData, error: logErr } = await logQuery
        if (logErr) throw logErr

        return (logData ?? [])
          .map((log: any) => ({
            ...log,
            photo_url: log.stealth_photo_in_url
              ? (log.stealth_photo_in_url.startsWith('http')
                  ? log.stealth_photo_in_url
                  : supabase.storage.from('selfies').getPublicUrl(log.stealth_photo_in_url).data.publicUrl)
              : null,
            clock_out_photo_url: log.stealth_photo_out_url
              ? (log.stealth_photo_out_url.startsWith('http')
                  ? log.stealth_photo_out_url
                  : supabase.storage.from('selfies').getPublicUrl(log.stealth_photo_out_url).data.publicUrl)
              : null,
          }))
          .filter((r: any) => !isTestOrDevStaff(r.outlet_staff) && !isTestOutlet(r.outlets)) as AttendanceLog[]
      }

      // Fetch outlet_staff separately because of missing foreign key relationship
      if (rawRows.length > 0) {
        const staffIds = Array.from(new Set(rawRows.map((r) => r.outlet_staff_id).filter(Boolean)))
        if (staffIds.length > 0) {
          const { data: staffs } = await supabase
            .from('outlet_staff')
            .select('id, name, role, username')
            .in('id', staffIds)

          if (staffs) {
            const staffMap = new Map(staffs.map((s) => [s.id, s]))
            rawRows = rawRows.map((r) => ({
              ...r,
              outlet_staff: staffMap.get(r.outlet_staff_id) || null,
            }))
          }
        }
      }

      // Group into daily entries (clock_in and clock_out)
      const grouped = new Map<string, AttendanceLog>()

      for (const r of rawRows) {
        const dateStr = wibDate(r.ts_server)
        // Satu baris per staf per tanggal, walau masuk & pulang di outlet berbeda.
        const key = `${r.outlet_staff_id}|${dateStr}`

        if (!grouped.has(key)) {
          grouped.set(key, {
            id: r.id,
            staff_id: r.outlet_staff_id,
            outlet_id: r.outlet_id,
            date: dateStr,
            clock_in: null,
            clock_out: null,
            status: 'hadir',
            late_minutes: 0,
            notes: null,
            photo_url: null,
            clock_out_photo_url: null,
            lat: null,
            lng: null,
            is_mock_location: false,
            created_at: r.ts_server,
            outlet_staff: r.outlet_staff,
            outlets: r.outlets,
          })
        }

        const item = grouped.get(key)!
        if (r.type === 'in') {
          // Outlet baris mengikuti outlet absen masuk.
          item.outlet_id = r.outlet_id
          item.outlets = r.outlets
          item.clock_in = r.ts_server
          item.photo_url = r.selfie_url
            ? (r.selfie_url.startsWith('http') ? r.selfie_url : supabase.storage.from('selfies').getPublicUrl(r.selfie_url).data.publicUrl)
            : null
          if (r.gps_lat) item.lat = Number(r.gps_lat)
          if (r.gps_lng) item.lng = Number(r.gps_lng)
          if (r.is_manual_button) item.notes = 'Absen Manual'
          if (r.status === 'telat' || r.status === 'terlambat') {
            item.status = 'terlambat'
            item.late_minutes = r.telat_menit || 0
          } else if (r.status === 'telat_toleransi') {
            item.status = 'terlambat'
            item.late_minutes = r.telat_menit || 0
            item.notes = item.notes ? item.notes + ', Telat dalam toleransi' : 'Telat dalam toleransi'
          }
        } else if (r.type === 'out') {
          item.out_outlet_id = r.outlet_id
          item.out_outlets = r.outlets
          item.clock_out = r.ts_server
          item.clock_out_photo_url = r.selfie_url
            ? (r.selfie_url.startsWith('http') ? r.selfie_url : supabase.storage.from('selfies').getPublicUrl(r.selfie_url).data.publicUrl)
            : null
        }
      }

      let result = Array.from(grouped.values()).filter(
        (r) => !isTestOrDevStaff(r.outlet_staff) && !isTestOutlet(r.outlets)
      )

      if (filter.status && filter.status !== 'all') {
        result = result.filter((r) => r.status === filter.status)
      }

      return result.sort((a, b) => b.date.localeCompare(a.date))
    },
  })
}
