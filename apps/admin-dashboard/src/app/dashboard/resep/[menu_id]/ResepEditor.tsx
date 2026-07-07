'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, Save } from 'lucide-react'
import { computeResepHpp, type HppBahan } from '@/lib/hpp'

export function ResepEditor({ menu, bahanBakuList, existingRecipe }: any) {
  const router = useRouter()
  const supabase = createClient()
  
  // State for recipe items
  const [items, setItems] = useState<any[]>(
    existingRecipe?.resep_item || []
  )
  const [isActive, setIsActive] = useState(existingRecipe?.is_active ?? true)
  const [isSaving, setIsSaving] = useState(false)

  const bahanById = useMemo(() => {
    const m: Record<string, HppBahan & { satuan?: string }> = {}
    for (const bb of bahanBakuList as any[]) {
      m[bb.id] = { harga_beli: bb.harga_beli || 0, faktor_konversi: bb.faktor_konversi || 1, satuan: bb.satuan }
    }
    return m
  }, [bahanBakuList])

  const hpp = useMemo(
    () => computeResepHpp(
      items.map((i) => ({ bahan_baku_id: i.bahan_baku_id, qty_per_porsi: Number(i.qty_per_porsi) || 0, satuan: i.satuan || '' })),
      bahanById,
      Number(menu.price) || 0,
    ),
    [items, bahanById, menu.price],
  )

  const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), bahan_baku_id: '', qty_per_porsi: 0 }])
  }

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map((item) => {
      if (item.id === id) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      
      // Validate
      if (items.some(i => !i.bahan_baku_id || i.qty_per_porsi <= 0)) {
        toast.error('Pastikan semua bahan baku dipilih dan jumlah lebih dari 0')
        return
      }

      // Upsert header resep
      const resepPayload = {
        menu_item_ref: menu.id,
        nama: `Resep ${menu.name}`,
        scope: 'global',
        is_active: isActive,
      }

      let resepId = existingRecipe?.id

      if (resepId) {
        const { error } = await supabase.from('resep').update(resepPayload).eq('id', resepId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('resep').insert(resepPayload).select().single()
        if (error) throw error
        resepId = data.id
      }

      // Sync items
      // For simplicity, delete old ones and insert new ones
      const { error: delError } = await supabase.from('resep_item').delete().eq('resep_id', resepId)
      if (delError) throw delError

      if (items.length > 0) {
        const itemsPayload = items.map(i => {
          const bb = bahanBakuList.find((b: any) => b.id === i.bahan_baku_id)
          return {
            resep_id: resepId,
            bahan_baku_id: i.bahan_baku_id,
            qty_per_porsi: i.qty_per_porsi,
            satuan: bb?.satuan || ''
          }
        })
        const { error: insError } = await supabase.from('resep_item').insert(itemsPayload)
        if (insError) throw insError
      }

      toast.success('Resep berhasil disimpan!')
      router.refresh()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Terjadi kesalahan')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Komposisi Bahan Baku</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isActive} 
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-suka-primary focus:ring-suka-primary"
            />
            Resep Aktif (Memotong Stok)
          </label>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-end gap-4 p-4 border border-gray-100 bg-gray-50/50 rounded-lg">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Pilih Bahan Baku</label>
              <select 
                value={item.bahan_baku_id} 
                onChange={(e) => updateItem(item.id, 'bahan_baku_id', e.target.value)}
                className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-suka-primary focus:ring-suka-primary"
              >
                <option value="" disabled>-- Pilih Bahan --</option>
                {bahanBakuList.map((bb: any) => (
                  <option key={bb.id} value={bb.id}>
                    {bb.nama} ({bb.satuan}) - {bb.kategori}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-500 mb-1">Takaran / Porsi</label>
              <div className="relative">
                <input 
                  type="number" 
                  min="0.01" 
                  step="any"
                  value={item.qty_per_porsi || ''} 
                  onChange={(e) => updateItem(item.id, 'qty_per_porsi', parseFloat(e.target.value))}
                  className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-suka-primary focus:ring-suka-primary pr-12"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {bahanBakuList.find((b: any) => b.id === item.bahan_baku_id)?.satuan || ''}
                </span>
              </div>
            </div>

            <div className="w-28 text-right">
              <label className="block text-xs font-medium text-gray-500 mb-1">Subtotal</label>
              {(() => {
                const line = hpp.lines.find((l) => l.bahan_baku_id === item.bahan_baku_id)
                if (!item.bahan_baku_id) return <span className="text-sm text-gray-300">—</span>
                if (line && !line.hasPrice)
                  return <span className="text-xs text-amber-600">harga belum diset</span>
                return <span className="text-sm font-semibold text-gray-800">{rupiah(line?.subtotal || 0)}</span>
              })()}
            </div>

            <button
              onClick={() => removeItem(item.id)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title="Hapus Bahan"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
            Belum ada bahan baku yang ditambahkan.
          </div>
        )}

        <button 
          onClick={addItem}
          className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-500 hover:border-suka-primary hover:text-suka-primary rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Tambah Bahan Baku
        </button>
      </div>

      <div className="px-6 py-4 border-t bg-white grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-gray-500">Total HPP / porsi</div>
          <div className="text-lg font-bold text-suka-brown">{rupiah(hpp.totalHpp)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Harga jual</div>
          <div className="text-lg font-semibold text-gray-800">{rupiah(Number(menu.price) || 0)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Margin</div>
          <div className="text-lg font-bold text-green-700">
            {rupiah(hpp.marginRp)}
            {hpp.marginPct !== null && <span className="text-sm font-medium text-green-600"> ({Math.round(hpp.marginPct)}%)</span>}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Food cost</div>
          <div className="text-lg font-semibold text-gray-800">
            {hpp.foodcostPct !== null ? `${Math.round(hpp.foodcostPct)}%` : '—'}
          </div>
        </div>
        {hpp.anyMissingPrice && (
          <div className="col-span-2 md:col-span-4 text-xs text-amber-600">
            ⚠️ HPP parsial — sebagian bahan belum ada harga di Master Bahan Baku.
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 border-t flex justify-end">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-suka-primary text-white rounded-md font-medium text-sm hover:bg-suka-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-suka-primary disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Resep BOM</>}
        </button>
      </div>
    </div>
  )
}
