'use client'
import Link from 'next/link'
import { Card, Button, Badge } from '@suka/design-system'
import type { Opname } from '@/types/stok'

export function OpnameList({ items }: { items: Opname[] }) {
  const draftCount = items.filter(o => o.status === 'draft').length
  const finalToday = items.filter(o =>
    o.status === 'finalized' && o.tanggal === new Date().toISOString().slice(0, 10)).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{finalToday} selesai hari ini · {draftCount} draft</p>
        <Link href="/stok/opname/new">
          <Button>+ Opname Baru</Button>
        </Link>
      </div>
      <div className="space-y-2">
        {items.map(o => (
          <Link key={o.id} href={`/stok/opname/${o.id}`}>
            <Card className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition">
              <div>
                <p className="font-semibold">{o.tanggal}</p>
                <p className="text-xs text-gray-500 capitalize">{o.tipe}</p>
              </div>
              <Badge variant={o.status === 'finalized' ? 'success' as any : 'default' as any}>
                {o.status === 'finalized' ? 'Selesai' : 'Draft'}
              </Badge>
            </Card>
          </Link>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada opname.</p>}
      </div>
    </div>
  )
}
