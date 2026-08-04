'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Check, X } from 'lucide-react'
import { processVoidOrder } from '@/app/actions/cancellations'
import { formatRupiah } from '@/lib/utils'

type VoidRequest = {
  id: string
  order_id: string
  reason: string
  status: string
  created_at: string
  token: string
  order_number: string
  customer_name: string
  total_amount: number
  outlet_name: string
  requester_name: string
}

export default function VoidOrderClient({ initialRequests }: { initialRequests: any[] }) {
  const [requests, setRequests] = useState<VoidRequest[]>(initialRequests)
  const [loadingIds, setLoadingIds] = useState<string[]>([])

  const handleAction = async (token: string, action: 'approve' | 'reject', requestId: string) => {
    if (!confirm(`Apakah Anda yakin ingin ${action === 'approve' ? 'MENYETUJUI' : 'MENOLAK'} pembatalan ini?`)) {
      return
    }

    setLoadingIds(prev => [...prev, requestId])
    
    try {
      const res = await processVoidOrder(token, action)
      if (res.success) {
        // Hapus dari list atau update status
        setRequests(prev => prev.filter(r => r.id !== requestId))
        alert(`Berhasil ${action === 'approve' ? 'menyetujui' : 'menolak'} pembatalan pesanan.`)
      } else {
        alert('Gagal memproses pembatalan: ' + res.error)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== requestId))
    }
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Tidak ada pengajuan pembatalan pesanan saat ini.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {requests.map(req => (
        <Card key={req.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{req.order_number}</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">{req.outlet_name}</div>
              </div>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">
                Menunggu
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kasir:</span>
                <span className="font-medium">{req.requester_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pelanggan:</span>
                <span className="font-medium">{req.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-medium">{formatRupiah(req.total_amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Waktu:</span>
                <span className="font-medium">{new Date(req.created_at).toLocaleString('id-ID')}</span>
              </div>
              <div className="mt-3 bg-muted/50 p-2 rounded-md">
                <span className="text-muted-foreground block mb-1">Alasan Pembatalan:</span>
                <p className="font-medium text-sm">"{req.reason}"</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200"
                onClick={() => handleAction(req.token, 'reject', req.id)}
                disabled={loadingIds.includes(req.id)}
              >
                {loadingIds.includes(req.id) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                Tolak
              </Button>
              <Button 
                variant="default" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleAction(req.token, 'approve', req.id)}
                disabled={loadingIds.includes(req.id)}
              >
                {loadingIds.includes(req.id) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Setujui
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
