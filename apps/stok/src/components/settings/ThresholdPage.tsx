'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOutletsList } from '@/lib/queries/monitoring'
import {
  fetchThresholds,
  upsertThreshold,
  resetThreshold,
  type ThresholdItem
} from '@/lib/queries/threshold'
import { ThresholdTable } from './ThresholdTable'
import { useAuth } from '@/context/AuthContext'

export function ThresholdPage() {
  const { outletStaff } = useAuth()
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  const [items, setItems] = useState<ThresholdItem[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const { data: outlets } = useQuery({
    queryKey: ['outlets-list'],
    queryFn: fetchOutletsList,
  })

  useEffect(() => {
    if (!selectedOutletId) return
    setLoading(true)
    setFetchError(null)
    fetchThresholds(selectedOutletId)
      .then(setItems)
      .catch(() => setFetchError('Gagal memuat data threshold'))
      .finally(() => setLoading(false))
  }, [selectedOutletId])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleSave = useCallback(async (bahanBakuId: string, value: number) => {
    if (!outletStaff) return
    await upsertThreshold(selectedOutletId, bahanBakuId, value, outletStaff.id)
    setItems(prev => prev.map(i =>
      i.bahan_baku_id === bahanBakuId ? { ...i, outlet_threshold: value } : i
    ))
    showToast('Tersimpan')
  }, [selectedOutletId, outletStaff])

  const handleReset = useCallback(async (bahanBakuId: string) => {
    await resetThreshold(selectedOutletId, bahanBakuId)
    setItems(prev => prev.map(i =>
      i.bahan_baku_id === bahanBakuId ? { ...i, outlet_threshold: null } : i
    ))
    showToast('Reset ke default')
  }, [selectedOutletId])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pengaturan Threshold Stok</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Outlet</label>
        <select
          value={selectedOutletId}
          onChange={e => setSelectedOutletId(e.target.value)}
          className="w-72 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">-- pilih outlet --</option>
          {(outlets || []).map((o: any) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {!selectedOutletId && (
        <p className="text-gray-400 text-sm">Pilih outlet untuk melihat dan mengedit threshold.</p>
      )}
      {selectedOutletId && loading && (
        <p className="text-gray-400 text-sm">Memuat…</p>
      )}
      {fetchError && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">
          {fetchError}
          <button
            onClick={() => setSelectedOutletId(v => v)}
            className="ml-3 underline"
          >
            Coba lagi
          </button>
        </div>
      )}
      {selectedOutletId && !loading && !fetchError && (
        <ThresholdTable items={items} onSave={handleSave} onReset={handleReset} />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
