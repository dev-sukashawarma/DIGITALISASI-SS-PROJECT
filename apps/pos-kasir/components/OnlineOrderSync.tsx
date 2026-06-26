'use client'

import { useEffect } from 'react'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export default function OnlineOrderSync() {
  useEffect(() => {
    const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL
    const SS_ORDER_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY

    if (!SS_ORDER_URL || !SS_ORDER_KEY) {
      console.warn('OnlineOrderSync: Kredensial SS_ORDER tidak ditemukan di .env.local')
      return
    }

    const ssOrderDb = createSupabaseClient(SS_ORDER_URL, SS_ORDER_KEY)
    const knownOrders = new Set<string>()

    console.log('OnlineOrderSync: Mendengarkan pesanan baru dari SS_ORDER...')

    async function pullOrder(externalOrderId: string) {
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
          console.error('OnlineOrderSync: Gagal menarik pesanan', data.error)
        }
      } catch (err) {
        console.error('OnlineOrderSync: Error fetching pull-online', err)
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
                window.location.reload()
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
    async function syncPendingPaidOrders() {
      try {
        const { data: orders } = await ssOrderDb
          .from('orders')
          .select('id')
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(10)

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
        const posKasirDb = createClient()
        // 1. Ambil pesanan online yang masih gantung di kasir
        const { data: localOrders } = await posKasirDb
          .from('orders')
          .select('id, external_order_id, status')
          .eq('source', 'online')
          .in('status', ['preparing', 'ready'])

        if (!localOrders || localOrders.length === 0) return

        // 2. Cek status terbarunya di SS Order System
        const externalIds = localOrders.map(o => o.external_order_id).filter(Boolean)
        if (externalIds.length === 0) return

        const { data: remoteOrders } = await ssOrderDb
          .from('orders')
          .select('id, status')
          .in('id', externalIds)

        if (!remoteOrders || remoteOrders.length === 0) return

        // 3. Bandingkan dan update jika perlu
        let needsReload = false
        for (const local of localOrders) {
          const remote = remoteOrders.find(r => r.id === local.external_order_id)
          if (remote) {
            // Jika di remote sudah done/ready/cancelled tapi di lokal masih preparing/ready
            if (remote.status === 'done' || remote.status === 'ready' || remote.status === 'cancelled') {
              const mappedStatus = (remote.status === 'done' || remote.status === 'ready') ? 'completed' : 'cancelled'
              
              if (local.status !== mappedStatus) {
                console.log(`OnlineOrderSync: Memperbaiki status pesanan nyangkut ${local.external_order_id} menjadi ${mappedStatus}`)
                try {
                  const res = await fetch('/api/orders/sync-internal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ external_order_id: remote.id, status: mappedStatus })
                  })
                  if (res.ok) {
                    needsReload = true
                  }
                } catch (e) {
                  console.error('Gagal sync nyangkut', e)
                }
              }
            }
          }
        }

        if (needsReload) {
          window.location.reload()
        }

      } catch (err) {
        console.error('OnlineOrderSync: Error sync active statuses', err)
      }
    }

    // Panggil saat mount
    syncPendingPaidOrders()
    syncActiveOrderStatuses()

    return () => {
      ssOrderDb.removeChannel(channel)
    }
  }, [])

  return null
}
