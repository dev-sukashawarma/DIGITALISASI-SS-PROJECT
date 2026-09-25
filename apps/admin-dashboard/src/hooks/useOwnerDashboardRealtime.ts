'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@suka/auth'
import { invalidateOwnerDashboardDays } from '@/app/actions/ownerDashboard'
import { jakartaDate, orderDatesFromRealtime, refreshDelayMs } from '@/lib/ownerDashboardCache'

type Options = {
  channelName: string
  /** Tanggal paling awal yang ditampilkan halaman (termasuk periode pembanding). */
  relevantFrom: string
  /** Tanggal paling akhir yang ditampilkan halaman. */
  relevantTo: string
  /** Paksa refresh untuk setiap order hari ini walau rentang filter tidak
   *  memuat hari ini (mis. daftar "order terbaru" di dashboard mitra). */
  alwaysRefreshOnToday?: boolean
  onRefresh?: () => void
}

/**
 * Listener realtime `orders` untuk Ringkasan Bisnis — pengganti versi lama
 * yang pada SETIAP perubahan order (0,8 dtk debounce) membuang seluruh cache
 * lalu me-refresh halaman. Dengan banyak outlet aktif, itu sama saja dengan
 * menghitung ulang seluruh rentang terus-menerus sampai database timeout.
 *
 * Sekarang:
 *  - order hari ini → cukup refresh (bagian hari ini memang selalu segar),
 *  - order hari lampau yang berubah → buang cache TANGGAL ITU saja,
 *  - event yang tak menyentuh rentang yang sedang dilihat → diabaikan,
 *  - refresh dibatasi paling sering sekali per REALTIME_REFRESH_MIN_GAP_MS.
 */
export function useOwnerDashboardRealtime({
  channelName,
  relevantFrom,
  relevantTo,
  alwaysRefreshOnToday = false,
  onRefresh,
}: Options) {
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  // Nilai terbaru disimpan di ref supaya channel tidak dibuat ulang tiap render.
  const optsRef = useRef({ relevantFrom, relevantTo, alwaysRefreshOnToday, onRefresh })
  optsRef.current = { relevantFrom, relevantTo, alwaysRefreshOnToday, onRefresh }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRefreshRef = useRef<number | null>(null)
  const pendingPastDatesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let disposed = false

    const runRefresh = async () => {
      timerRef.current = null
      const dates = Array.from(pendingPastDatesRef.current)
      pendingPastDatesRef.current.clear()
      if (dates.length > 0) {
        try {
          await invalidateOwnerDashboardDays(dates)
        } catch {
          // Gagal membuang cache hari lampau tidak fatal: TTL 1 jam tetap berlaku.
        }
      }
      if (disposed) return
      lastRefreshRef.current = Date.now()
      router.refresh()
      optsRef.current.onRefresh?.()
    }

    const schedule = () => {
      if (timerRef.current) return // sudah terjadwal; perubahan berikutnya ikut refresh itu
      timerRef.current = setTimeout(runRefresh, refreshDelayMs(lastRefreshRef.current, Date.now()))
    }

    const onChange = (payload: any) => {
      const { relevantFrom, relevantTo, alwaysRefreshOnToday } = optsRef.current
      const today = jakartaDate(new Date())
      const dates = orderDatesFromRealtime(payload)
      const viewIncludesToday = relevantFrom <= today && today <= relevantTo

      // DELETE tanpa tanggal: tak bisa ditentukan, anggap menyentuh hari ini.
      const touchesToday = dates.length === 0 || dates.includes(today)
      const pastDates = dates.filter((d) => d < today)
      const pastInView = pastDates.filter((d) => d >= relevantFrom && d <= relevantTo)

      // Tanggal lampau di luar tampilan tetap dicatat; cache-nya ikut dibuang
      // pada refresh berikutnya supaya tidak basi saat filter dipindah ke sana.
      for (const d of pastDates) pendingPastDatesRef.current.add(d)

      if (pastInView.length > 0 || (touchesToday && (viewIncludesToday || alwaysRefreshOnToday))) {
        schedule()
      }
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .subscribe()

    return () => {
      disposed = true
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      supabase.removeChannel(channel)
    }
  }, [supabase, router, channelName])
}
