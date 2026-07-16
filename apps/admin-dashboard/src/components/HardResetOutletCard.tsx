'use client'

import { useState } from 'react'
import { useOutlets } from '@/hooks/useOutlets'
import { createClient } from '@/lib/supabase'
import { Button, Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'

export function HardResetOutletCard() {
  const { data: outlets, isLoading } = useOutlets()
  const [selectedOutlet, setSelectedOutlet] = useState<string>('')
  const [confirmText, setConfirmText] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const handleReset = async () => {
    if (confirmText !== 'RESET') {
      toast.error('Ketik RESET untuk mengonfirmasi.')
      return
    }
    if (!selectedOutlet) {
      toast.error('Pilih outlet terlebih dahulu.')
      return
    }

    setIsResetting(true)
    const supabase = createClient()
    
    try {
      const { error } = await supabase.rpc('hard_reset_outlet_data', {
        p_outlet_id: selectedOutlet
      })

      if (error) throw error

      toast.success('Data outlet berhasil di-reset.')
      setConfirmText('')
      setSelectedOutlet('')
    } catch (err: any) {
      console.error(err)
      toast.error('Gagal melakukan reset: ' + (err.message || 'Error tidak diketahui'))
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-red-100 p-3 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-red-900">Danger Zone: Hard Reset Data Outlet</h3>
            <p className="text-sm text-red-700">
              Menghapus permanen seluruh data penjualan, absensi uji coba, distribusi, dan riwayat stok pada outlet terpilih. Saldo bahan baku akan dikembalikan ke angka 0. <strong>Tindakan ini tidak dapat dibatalkan.</strong>
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label htmlFor="outlet_select" className="block text-sm font-medium text-red-900">
                Pilih Outlet
              </label>
              <select
                id="outlet_select"
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                className="block w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm bg-white"
                disabled={isResetting || isLoading}
              >
                <option value="">-- Pilih Outlet --</option>
                {outlets?.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-1">
              <label htmlFor="confirm_text" className="block text-sm font-medium text-red-900">
                Ketik <strong>RESET</strong>
              </label>
              <input
                type="text"
                id="confirm_text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET"
                className="block w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm bg-white placeholder-red-300"
                disabled={isResetting || !selectedOutlet}
              />
            </div>

            <Button
              variant="danger"
              disabled={confirmText !== 'RESET' || !selectedOutlet || isResetting}
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              {isResetting ? <Spinner className="mr-2 h-4 w-4" /> : null}
              Eksekusi Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
