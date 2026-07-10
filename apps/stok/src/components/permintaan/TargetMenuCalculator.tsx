'use client'
import { useState, useEffect } from 'react'
import { fetchActiveResep, calculateBahanBakuRequest, type ResepMenu, type CalculatedBahan } from '@/app/actions/permintaan_target'

interface TargetMenuCalculatorProps {
  outletId: string
  onCalculated: (items: CalculatedBahan[]) => void
}

export function TargetMenuCalculator({ outletId, onCalculated }: TargetMenuCalculatorProps) {
  const [menus, setMenus] = useState<ResepMenu[]>([])
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchActiveResep(outletId)
      .then(setMenus)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [outletId])

  function handleSetTarget(resepId: string, value: string) {
    setTargets(prev => ({ ...prev, [resepId]: value }))
  }

  async function handleCalculate() {
    setError(null)
    setBusy(true)
    try {
      const payload = Object.entries(targets)
        .map(([resep_id, qtyStr]) => ({ resep_id, qty_target: Number(qtyStr) || 0 }))
        .filter(t => t.qty_target > 0)
      
      if (payload.length === 0) {
        throw new Error('Masukkan setidaknya satu target menu yang lebih dari 0.')
      }

      const results = await calculateBahanBakuRequest(outletId, payload)
      onCalculated(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-center text-sm text-[#544437]/60">Memuat menu...</div>
  }

  return (
    <div className="bg-white border border-[#d9c2b2]/60 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-[#701604]">Target Penjualan Menu</h3>
      <p className="text-xs text-[#544437]/80">
        Masukkan target porsi untuk menghitung kebutuhan bahan baku secara otomatis.
      </p>

      {error && (
        <div className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
        {menus.map(menu => (
          <div key={menu.id} className="flex items-center justify-between border-b border-[#d9c2b2]/20 pb-2">
            <span className="text-sm font-semibold text-[#1e1b15]">{menu.nama}</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={targets[menu.id] || ''}
              onChange={e => handleSetTarget(menu.id, e.target.value)}
              className="w-20 px-3 py-2 text-center border border-[#d9c2b2]/40 rounded-xl text-sm bg-[#faf2e9] text-[#1e1b15] focus:ring-2 focus:ring-[#f29744]/50 focus:border-[#f29744]"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={handleCalculate}
        className="w-full bg-[#544437] hover:bg-[#3a2f26] active:scale-[0.98] transition-all text-white font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-wider disabled:opacity-40"
      >
        {busy ? 'Menghitung...' : 'Hitung Kebutuhan Bahan'}
      </button>
    </div>
  )
}
