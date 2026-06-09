'use client'
import Link from 'next/link'
import { Card, Badge } from '@suka/design-system'
import type { LedgerStok } from '@/types/stok'

const LABEL: Record<string,string> = {
  terima_kiriman:'Terima Kiriman', pemakaian:'Pemakaian', waste:'Waste',
  adjustment:'Penyesuaian', opname_selisih:'Selisih Opname',
  transfer_keluar:'Transfer Keluar', transfer_masuk:'Transfer Masuk',
}

export function LedgerList({ items }: { items: LedgerStok[] }) {
  return (
    <div className="space-y-2">
      {items.map(l => (
        <Link key={l.id} href={`/stok/ledger/${l.id}`}>
          <Card className="p-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{LABEL[l.tipe] ?? l.tipe}</p>
              <p className="text-xs text-gray-500">{new Date(l.created_at).toLocaleString('id-ID')}</p>
            </div>
            <div className="text-right">
              <p className={`font-bold ${l.qty<0?'text-red-600':'text-green-700'}`}>
                {l.qty>0?'+':''}{l.qty}
              </p>
              <p className="text-xs text-gray-500">saldo {l.saldo_sesudah}</p>
            </div>
          </Card>
        </Link>
      ))}
      {items.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada pergerakan.</p>}
    </div>
  )
}
