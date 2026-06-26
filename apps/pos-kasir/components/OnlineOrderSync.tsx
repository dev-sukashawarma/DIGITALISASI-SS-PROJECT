'use client'

import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function OnlineOrderSync() {
  useEffect(() => {
    const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL
    const SS_ORDER_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY

    if (!SS_ORDER_URL || !SS_ORDER_KEY) {
      console.warn('OnlineOrderSync: Kredensial SS_ORDER tidak ditemukan di .env.local')
      return
    }

    const ssOrderDb = createClient(SS_ORDER_URL, SS_ORDER_KEY)
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
          } else if (payload.new.status === 'done' || payload.new.status === 'cancelled') {
            console.log(`OnlineOrderSync: Pesanan ${payload.new.id} berubah jadi ${payload.new.status} di order-system!`)
            // Update db pos-kasir lokal
            const posKasirDb = createClientComponentClient()
            const mappedStatus = payload.new.status === 'done' ? 'completed' : 'cancelled'
            await posKasirDb
              .from('orders')
              .update({ status: mappedStatus, updated_at: new Date().toISOString() })
              .eq('external_order_id', payload.new.id)
              .eq('source', 'online')
              
            // Refresh halaman agar UI Kasir terupdate
            window.location.reload()
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

    // Panggil saat mount
    syncPendingPaidOrders()

    return () => {
      ssOrderDb.removeChannel(channel)
    }
  }, [])

  return null
}
