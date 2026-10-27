'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useRealtimeInvalidate } from '@suka/realtime'
import type {
  LokasiTerkiniRow, PerjalananRow, PerjalananTampil, StatusAntarSj, StopRow, StopTampil, TitikJejak,
} from '@/lib/pelacakan/types'

// Semua query pelacakan memakai prefix ['pelacakan'] agar satu event realtime
// menyegarkan peta, panel, baris detail SJ, dan kartu dashboard sekaligus.
const KUNCI = 'pelacakan'

const SELECT_PERJALANAN =
  '*, driver:outlet_staff(name), stops:driver_perjalanan_stop(*, surat_jalan(document_number), outlets(name, lat, lng))'

type BarisPerjalanan = PerjalananRow & {
  driver: { name: string } | null
  stops: (StopRow & { surat_jalan: { document_number: string | null } | null; outlets: { name: string; lat: number | null; lng: number | null } | null })[]
}

function petakan(rows: BarisPerjalanan[], terkini: LokasiTerkiniRow[]): PerjalananTampil[] {
  return rows.map(({ driver, stops, ...p }) => ({
    ...p,
    driver_name: driver?.name ?? 'Driver',
    terkini: terkini.find((t) => t.driver_id === p.driver_id) ?? null,
    stops: stops
      .map(({ surat_jalan, outlets, ...s }): StopTampil => ({
        ...s,
        document_number: surat_jalan?.document_number ?? null,
        outlet_name: outlets?.name ?? 'Outlet',
        outlet_lat: outlets?.lat ?? null,
        outlet_lng: outlets?.lng ?? null,
      }))
      .sort((a, b) => a.urutan - b.urutan),
  }))
}

/** Realtime pelacakan untuk layar pusat. Pasang sekali per halaman. */
export function usePelacakanRealtime(enabled = true) {
  useRealtimeInvalidate({
    channelName: 'distribusi-pelacakan',
    enabled,
    subs: [
      { table: 'driver_lokasi_terkini', queryKeys: [[KUNCI]] },
      { table: 'driver_perjalanan', queryKeys: [[KUNCI]] },
      { table: 'driver_perjalanan_stop', queryKeys: [[KUNCI]] },
    ],
  })
}

/** Perjalanan yang sedang berjalan + posisi terkini driver. */
export function usePerjalananAktif(enabled = true) {
  const { data = [], isLoading } = useQuery({
    queryKey: [KUNCI, 'aktif'],
    enabled,
    queryFn: async (): Promise<PerjalananTampil[]> => {
      const supabase = createSupabaseBrowserClient()
      const { data: rows, error } = await supabase
        .from('driver_perjalanan')
        .select(SELECT_PERJALANAN)
        .eq('status', 'berjalan')
        .order('berangkat_at', { ascending: false })
      if (error) throw error
      const driverIds = (rows ?? []).map((r: any) => r.driver_id)
      let terkini: LokasiTerkiniRow[] = []
      if (driverIds.length) {
        const res = await supabase.from('driver_lokasi_terkini').select('*').in('driver_id', driverIds)
        if (res.error) throw res.error
        terkini = (res.data ?? []) as LokasiTerkiniRow[]
      }
      return petakan((rows ?? []) as unknown as BarisPerjalanan[], terkini)
    },
  })
  return { perjalanan: data, loading: isLoading }
}

/** Perjalanan yang berangkat pada tanggal WIB tertentu ('YYYY-MM-DD'). */
export function useRiwayatPerjalanan(tanggal: string) {
  const { data = [], isLoading } = useQuery({
    queryKey: [KUNCI, 'riwayat', tanggal],
    queryFn: async (): Promise<PerjalananTampil[]> => {
      const supabase = createSupabaseBrowserClient()
      const { data: rows, error } = await supabase
        .from('driver_perjalanan')
        .select(SELECT_PERJALANAN)
        .gte('berangkat_at', `${tanggal}T00:00:00+07:00`)
        .lte('berangkat_at', `${tanggal}T23:59:59.999+07:00`)
        .order('berangkat_at', { ascending: false })
      if (error) throw error
      return petakan((rows ?? []) as unknown as BarisPerjalanan[], [])
    },
  })
  return { perjalanan: data, loading: isLoading }
}

const HALAMAN = 1000

/** Titik rute satu perjalanan, berurutan. Dipaginasi (batas 1.000 baris PostgREST). */
export function useJejakPerjalanan(perjalananId: string | null) {
  const { data = [], isLoading } = useQuery({
    queryKey: [KUNCI, 'jejak', perjalananId],
    enabled: !!perjalananId,
    queryFn: async (): Promise<TitikJejak[]> => {
      const supabase = createSupabaseBrowserClient()
      const semua: TitikJejak[] = []
      for (let dari = 0; ; dari += HALAMAN) {
        const { data: rows, error } = await supabase
          .from('driver_lokasi_jejak')
          .select('lat, lng, direkam_at')
          .eq('perjalanan_id', perjalananId as string)
          .order('direkam_at', { ascending: true })
          .order('id', { ascending: true })
          .range(dari, dari + HALAMAN - 1)
        if (error) throw error
        semua.push(...((rows ?? []) as TitikJejak[]))
        if (!rows || rows.length < HALAMAN) break
      }
      return semua
    },
  })
  return { jejak: data, loading: isLoading }
}

/** Stop + perjalanan untuk satu SJ (layar pusat). null = SJ tidak dilacak. */
export function useStopSj(sjId: string | null, enabled = true) {
  const { data = null, isLoading } = useQuery({
    queryKey: [KUNCI, 'stop-sj', sjId],
    enabled: enabled && !!sjId,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: row, error } = await supabase
        .from('driver_perjalanan_stop')
        .select('*, perjalanan:driver_perjalanan(id, status, berangkat_at, driver:outlet_staff(name))')
        .eq('surat_jalan_id', sjId as string)
        .neq('status', 'dibatalkan')
        .maybeSingle()
      if (error) throw error
      return row as (StopRow & { perjalanan: { id: string; status: string; berangkat_at: string; driver: { name: string } | null } | null }) | null
    },
  })
  return { stop: data, loading: isLoading }
}

/** Status antar ringkas untuk outlet penerima (RPC, tanpa koordinat). */
export function useStatusAntarSj(sjId: string | null, enabled = true) {
  const { data = null, isLoading } = useQuery({
    queryKey: [KUNCI, 'antar-sj', sjId],
    enabled: enabled && !!sjId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<StatusAntarSj | null> => {
      const supabase = createSupabaseBrowserClient()
      const { data: rows, error } = await supabase.rpc('status_antar_sj', { p_sj_id: sjId })
      if (error) throw error
      return ((rows as StatusAntarSj[] | null) ?? [])[0] ?? null
    },
  })
  return { status: data, loading: isLoading }
}
