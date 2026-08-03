'use client'

import { useEffect } from 'react'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export default function OnlineOrderSync() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL
    const SS_ORDER_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY

    if (!SS_ORDER_URL || !SS_ORDER_KEY) {
      console.warn('OnlineOrderSync: Kredensial SS_ORDER tidak ditemukan di .env.local')
      return
    }

    const ssOrderDb = createSupabaseClient(SS_ORDER_URL, SS_ORDER_KEY)
    const knownOrders = new Set<string>()
    const inFlightPulls = new Set<string>()

    console.log('OnlineOrderSync: Mendengarkan pesanan baru dari SS_ORDER...')

    async function pullOrder(externalOrderId: string) {
      if (inFlightPulls.has(externalOrderId)) return
      inFlightPulls.add(externalOrderId)
      try {
        const res = await fetch('/api/orders/pull-online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ external_order_id: externalOrderId }),
        })
        const data = await res.json()
        if (data.success) {
          console.log('OnlineOrderSync: Berhasil menarik pesanan', data)
        } else {
          // Gunakan warn agar tidak memunculkan overlay error Next.js di mode dev
          console.warn('OnlineOrderSync: Diabaikan (Gagal menarik pesanan)', data.error)
        }
      } catch (err) {
        console.warn('OnlineOrderSync: Error fetching pull-online', err)
      } finally {
        inFlightPulls.delete(externalOrderId)
      }
    }

    const channel = ssOrderDb
      .channel('public:orders:paid')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload) => {
          if (payload.new.status === 'paid') {
            if (!knownOrders.has(payload.new.id)) {
              console.log('OnlineOrderSync: Pesanan PAID terdeteksi!', payload.new)
              knownOrders.add(payload.new.id)
              pullOrder(payload.new.id)
            }
          } else if (payload.new.status === 'done' || payload.new.status === 'ready' || payload.new.status === 'cancelled') {
            console.log(`OnlineOrderSync: Pesanan ${payload.new.id} berubah jadi ${payload.new.status} di order-system!`)
            // Update db pos-kasir lokal via internal API agar bypass RLS & bisa dilog
            const mappedStatus = (payload.new.status === 'done' || payload.new.status === 'ready') ? 'completed' : 'cancelled'
            
            fetch('/api/orders/sync-internal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ external_order_id: payload.new.id, status: mappedStatus })
            }).then(res => {
              if (res.ok) {
                // Segarkan board kasir tanpa reload penuh (tidak mengganggu transaksi berjalan)
                queryClient.invalidateQueries({ queryKey: ['orders'] })
              } else {
                console.error('OnlineOrderSync: Gagal sync internal', res.statusText)
              }
            }).catch(err => {
              console.error('OnlineOrderSync: Gagal memanggil API sync-internal', err)
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.new.status === 'paid') {
            if (!knownOrders.has(payload.new.id)) {
              console.log('OnlineOrderSync: Pesanan PAID (insert) terdeteksi!', payload.new)
              knownOrders.add(payload.new.id)
              pullOrder(payload.new.id)
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('OnlineOrderSync Subscribe Status:', status)
      })

    // Lakukan sinkronisasi awal saat komponen di-mount untuk pesanan yang "tersangkut"
    // Jalur browser dipertahankan untuk latensi rendah, tapi bukan lagi
    // satu-satunya jalur -- cron server /api/cron/pull-online-orders yang
    // menjamin tidak ada pesanan terlewat. Karena itu di sini cukup ambil
    // yang terbaru, bukan mencoba menutup seluruh celah dengan limit(10).
    async function syncPendingPaidOrders() {
      try {
        const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        const { data: orders } = await ssOrderDb
          .from('orders')
          .select('id')
          .eq('status', 'paid')
          .gte('created_at', since)
          .order('created_at', { ascending: false })

        if (orders) {
          for (const o of orders) {
            if (!knownOrders.has(o.id)) {
              knownOrders.add(o.id)
              await pullOrder(o.id)
            }
          }
        }
      } catch (err) {
        console.error('OnlineOrderSync: Error initial sync', err)
      }
    }

    // Melacak pesanan yang sudah ditarik namun belum selesai, lalu mengecek status akhirnya di order system
    async function syncActiveOrderStatuses() {
      try {
        const res = await fetch('/api/orders/sync-active', { method: 'POST' })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.count > 0) {
            console.log(`OnlineOrderSync: Memperbaiki ${data.count} pesanan nyangkut`)
            // Invalidasi react-query agar pesanan yang baru selesai langsung pindah kolom
            // tanpa menunggu polling 3 detik & tanpa kedip reload
            queryClient.invalidateQueries({ queryKey: ['orders'] })
          }
        }
      } catch (err) {
        console.error('OnlineOrderSync: Error sync active statuses', err)
      }
    }

    // Panggil saat mount
    syncPendingPaidOrders()
    syncActiveOrderStatuses()

    // Polling setiap 10 detik agar kebal terhadap kegagalan realtime/webhook
    const interval = setInterval(syncActiveOrderStatuses, 10000)

    // Saat kasir kembali fokus/membuka tab, langsung tarik status terbaru.
    // Menutup celah utama: event realtime yang terlewat selagi tab tidak aktif.
    const onActive = () => {
      if (document.visibilityState === 'visible') syncActiveOrderStatuses()
    }
    document.addEventListener('visibilitychange', onActive)
    window.addEventListener('focus', onActive)

    return () => {
      ssOrderDb.removeChannel(channel)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onActive)
      window.removeEventListener('focus', onActive)
    }
  }, [queryClient])

  return null
}
