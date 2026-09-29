'use client'

import { useEffect, useId, useMemo, useRef } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { AttendanceLog, AttendanceFilterValues } from '@/lib/types'
import { useHrDirectory } from '@/hooks/useHrDirectory'
import { fetchAllPages } from '@/lib/paging'

type SupabaseClient = ReturnType<typeof createClient>

export const ATTENDANCE_PAGE_SIZE = 50
/** Ukuran satu batch saat export (batas atas `p_limit` di RPC = 5000). */
const EXPORT_BATCH = 5000

export interface AttendanceSummary {
  hadir: number
  terlambat: number
  izin: number
  sakit: number
  cuti: number
  alfa: number
}

export const EMPTY_SUMMARY: AttendanceSummary = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, cuti: 0, alfa: 0 }

export interface AttendancePage {
  rows: AttendanceLog[]
  total: number
  summary: AttendanceSummary
}

interface Exclusions {
  staffIds: string[]
  outletIds: string[]
}

interface RpcRow extends Omit<AttendanceLog, 'photo_url' | 'clock_out_photo_url'> {
  selfie_in: string | null
  selfie_out: string | null
}

interface RpcResult {
  total: number
  ringkasan: AttendanceSummary
  rows: RpcRow[]
}

function selfiePublicUrl(supabase: SupabaseClient, path: string | null): string | null {
  if (!path) return null
  return path.startsWith('http') ? path : supabase.storage.from('selfies').getPublicUrl(path).data.publicUrl
}

async function fetchAttendancePage(
  supabase: SupabaseClient,
  filter: AttendanceFilterValues,
  search: string,
  exclusions: Exclusions,
  limit: number,
  offset: number
): Promise<AttendancePage> {
  const { data, error } = await supabase.rpc('hr_absensi_harian', {
    p_from: filter.dateFrom,
    p_to: filter.dateTo,
    p_outlet: filter.outletId && filter.outletId !== 'all' ? filter.outletId : null,
    p_status: filter.status && filter.status !== 'all' ? filter.status : null,
    p_search: search.trim() || null,
    p_exclude_staff: exclusions.staffIds,
    p_exclude_outlet: exclusions.outletIds,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error

  const res = data as RpcResult
  return {
    total: res.total ?? 0,
    summary: { ...EMPTY_SUMMARY, ...(res.ringkasan ?? {}) },
    rows: (res.rows ?? []).map(({ selfie_in, selfie_out, ...r }) => ({
      ...r,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
      photo_url: selfiePublicUrl(supabase, selfie_in),
      clock_out_photo_url: selfiePublicUrl(supabase, selfie_out),
    })),
  }
}

/**
 * Satu halaman rekap absensi harian (pengelompokan in/out, filter, pencarian,
 * ringkasan dan pagination semuanya di RPC `hr_absensi_harian`).
 */
export function useAttendance(filter: AttendanceFilterValues, search: string, page: number) {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()
  const { data: directory } = useHrDirectory()
  const exclusions = useMemo<Exclusions | undefined>(
    () =>
      directory
        ? { staffIds: directory.excludedStaffIds, outletIds: directory.excludedOutletIds }
        : undefined,
    [directory]
  )

  // Realtime: clock in/out baru → refetch halaman aktif saja (±50 baris).
  // - Event di luar rentang tanggal yang sedang dilihat diabaikan (lihat Agustus
  //   tidak ikut refetch tiap ada clock-in hari ini).
  // - Event beruntun (jam masuk ramai) digabung: satu refetch per 3 detik.
  const channelId = useId()
  const rangeRef = useRef({ from: filter.dateFrom, to: filter.dateTo })
  rangeRef.current = { from: filter.dateFrom, to: filter.dateTo }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const channel = supabase
      .channel(`hr-attendance-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
        const row = (payload.new && 'ts_server' in payload.new ? payload.new : payload.old) as
          | { ts_server?: string }
          | undefined
        if (row?.ts_server) {
          const tgl = new Date(row.ts_server).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
          const { from, to } = rangeRef.current
          if (tgl < from || tgl > to) return
        }
        if (timer) return
        timer = setTimeout(() => {
          timer = null
          queryClient.invalidateQueries({ queryKey: ['attendance'] })
        }, 3000)
      })
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, channelId])

  const query = useQuery<AttendancePage>({
    queryKey: ['attendance', filter, search.trim(), page, exclusions],
    enabled: !!exclusions,
    staleTime: 30_000,
    refetchInterval: 60_000, // cadangan bila koneksi realtime putus
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchAttendancePage(
        supabase,
        filter,
        search,
        exclusions!,
        ATTENDANCE_PAGE_SIZE,
        (page - 1) * ATTENDANCE_PAGE_SIZE
      ),
  })

  /**
   * Seluruh baris sesuai filter aktif (tanggal, outlet, status, pencarian), diambil
   * per batch sampai habis — jumlahnya sama dengan "Total N catatan" di layar.
   */
  const exportAll = async (): Promise<AttendancePage> => {
    if (!exclusions) throw new Error('Data belum siap')
    let summary: AttendanceSummary = EMPTY_SUMMARY
    const all = await fetchAllPages(
      async (limit, offset) => {
        const res = await fetchAttendancePage(supabase, filter, search, exclusions, limit, offset)
        summary = res.summary
        return res
      },
      (r) => `${r.staff_id}|${r.outlet_id}|${r.date}`,
      EXPORT_BATCH
    )
    return { ...all, summary }
  }

  return { ...query, isLoading: query.isLoading || !exclusions, exportAll }
}
