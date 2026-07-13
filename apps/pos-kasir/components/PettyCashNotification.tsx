'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { useDialogStore } from '@/lib/dialogStore'
import { useRouter } from 'next/navigation'

export default function PettyCashNotification() {
  const { outletId } = useMyOutlet()
  const { showAlert } = useDialogStore()
  const router = useRouter()
  const alertedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!outletId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`petty-cash-notification-${outletId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'petty_cash_topups',
          filter: `outlet_id=eq.${outletId}`,
        },
        (payload) => {
          const newStatus = payload.new.status
          const oldStatus = payload.old.status
          const id = payload.new.id

          // Only alert when the status CHANGES to 'forwarded_by_leader'
          // and we haven't alerted for this ID recently.
          if (
            newStatus === 'forwarded_by_leader' &&
            oldStatus !== 'forwarded_by_leader' &&
            !alertedIds.current.has(id)
          ) {
            alertedIds.current.add(id)
            
            // Tampilkan notifikasi yang menghalangi layar
            showAlert(
              `Petty Cash senilai Rp ${(payload.new.amount || 0).toLocaleString('id-ID')} telah disetujui dan dananya siap Anda terima. Silakan buka halaman Petty Cash untuk mengonfirmasi penerimaan dana.`,
              'Petty Cash Siap Diterima'
            ).then(() => {
              // Opsional: Buka halaman petty cash otomatis atau biarkan user memutuskan
              // router.push('/kasir/shift')
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [outletId, showAlert, router])

  return null
}
