'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card } from '@suka/design-system'
import type { LedgerStok } from '@/types/stok'

export function LedgerDetail({ ledgerId }: { ledgerId: string }) {
  const [l, setL] = useState<LedgerStok | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.from('ledger_stok').select('*').eq('id', ledgerId).single()
      .then(({ data }) => setL(data as LedgerStok))
  }, [ledgerId])
  if (!l) return <p>Memuat…</p>
  return (
    <Card className="p-4 space-y-2">
      <p><b>Tipe:</b> {l.tipe}</p>
      <p><b>Qty:</b> {l.qty}</p>
      <p><b>Saldo:</b> {l.saldo_sebelum} → {l.saldo_sesudah}</p>
      <p><b>Waktu:</b> {new Date(l.created_at).toLocaleString('id-ID')}</p>
      {l.catatan && <p><b>Catatan:</b> {l.catatan}</p>}
      {l.ref_shipment_id && <p><b>Ref Kiriman:</b> {l.ref_shipment_id}</p>}
      {l.ref_opname_id && <p><b>Ref Opname:</b> {l.ref_opname_id}</p>}
    </Card>
  )
}
