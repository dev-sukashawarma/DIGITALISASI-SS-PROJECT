'use client'
import { useEffect, useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { fetchPendingWasteReports, approveWasteReport, rejectWasteReport } from '@/app/actions/waste'
import { toast } from 'sonner'
import { useStokBalance } from '@/hooks/useStokBalance'
import { useAuth } from '@suka/auth'

export default function WasteApprovalPage() {
  const { outletStaff } = useAuth()
  const outletId = outletStaff?.outlet_id 
  
  // We can also fetch without outletId to get all accessible pending reports
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { balances } = useStokBalance(outletId || '')

  const loadReports = async () => {
    try {
      setLoading(true)
      const data = await fetchPendingWasteReports() // gets all accessible
      setReports(data)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  const handleApprove = async (id: string, qty: number, bahanBakuId: string) => {
    const bal = balances.find(b => b.bahan_baku_id === bahanBakuId)
    const currentSaldo = bal?.saldo || 0
    
    if (qty > currentSaldo) {
      const confirmMsg = `WARNING: Qty waste (${qty}) lebih besar dari saldo saat ini (${currentSaldo}). Saldo akan menjadi negatif. Tetap setujui?`
      if (!window.confirm(confirmMsg)) return
    }

    try {
      await approveWasteReport(id)
      toast.success('Laporan disetujui')
      loadReports()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingId || !rejectReason) return
    try {
      await rejectWasteReport(rejectingId, rejectReason)
      toast.success('Laporan ditolak')
      setRejectingId(null)
      setRejectReason('')
      loadReports()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (loading) return <div className="p-4">Memuat...</div>

  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Persetujuan Waste</h1>
        <Button variant="secondary" onClick={loadReports}>Refresh</Button>
      </div>

      {reports.length === 0 ? (
        <p className="text-gray-500">Tidak ada laporan waste yang pending.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(r => {
            const bal = balances.find(b => b.bahan_baku_id === r.bahan_baku_id)
            const isNegativeWarning = r.qty > (bal?.saldo || 0)
            
            return (
              <Card key={r.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-bold">{r.bahan_baku?.nama}</h3>
                    <p className="text-sm text-gray-500">{r.outlets?.name} • Oleh: {r.reported_by_staff?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{r.qty} {r.bahan_baku?.satuan}</p>
                    <p className="text-xs text-gray-400">Waste</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-2 rounded text-sm">
                  <span className="font-semibold">Alasan:</span> {r.reason}
                </div>

                {isNegativeWarning && (
                  <div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded border border-yellow-200">
                    ⚠️ Saldo saat ini: {bal?.saldo || 0}. Menyetujui ini akan membuat stok menjadi negatif.
                  </div>
                )}

                {r.photo_url && (
                  <div className="mt-2">
                    <a href={r.photo_url} target="_blank" rel="noreferrer" className="text-blue-500 text-sm hover:underline">
                      Lihat Foto Bukti ↗
                    </a>
                  </div>
                )}

                <div className="flex gap-2 mt-auto pt-4">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white" 
                    onClick={() => handleApprove(r.id, r.qty, r.bahan_baku_id)}
                  >
                    Setujui
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setRejectingId(r.id)}
                  >
                    Tolak
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-4">Alasan Penolakan</h2>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <Input
                autoFocus
                placeholder="Misal: Foto buram, salah item"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setRejectingId(null)}>Batal</Button>
                <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">Tolak Laporan</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
