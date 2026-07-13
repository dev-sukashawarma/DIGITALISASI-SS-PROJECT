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
  const [items, setItems] = useState<any[]>(existingRecipe?.resep_item || [])
  const [isActive, setIsActive] = useState(existingRecipe?.is_active ?? true)
  const [catatan, setCatatan] = useState<string>(existingRecipe?.catatan ?? '')
  const [hargaJual, setHargaJual] = useState<number>(Number(menu.price) || 0)
  const [isSaving, setIsSaving] = useState(false)

  const buffer = Number(existingRecipe?.buffer_amount) || 0

  const bahanById = useMemo(() => {
    const m: Record<string, HppBahan> = {}
    for (const bb of bahanBakuList as any[]) {
      m[bb.id] = {
        hargaBeliDisplay: bb.harga_beli_display || 0,
        kemasanQty: bb.kemasan_qty || 0,
        kemasanSatuan: bb.kemasan_satuan || '',
      }
    }
    return m
  }, [bahanBakuList])


  const hpp = useMemo(
    () =>
      computeResepHpp(
        items.map((i) => ({ bahan_baku_id: i.bahan_baku_id, qty_per_porsi: Number(i.qty_per_porsi) || 0, satuan: i.satuan || '' })),
        bahanById,
        hargaJual,
        buffer,
      ),
    [items, bahanById, hargaJual, buffer],
  )

  const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
  const marginPct = hpp.marginPct
  const marginBadge =
    marginPct === null
      ? { label: '—', cls: 'bg-gray-200 text-gray-600' }
      : marginPct >= 35
        ? { label: 'BAIK', cls: 'bg-suka-green text-white' }
        : marginPct >= 20
          ? { label: 'CUKUP', cls: 'bg-amber-500 text-white' }
          : { label: 'TIPIS', cls: 'bg-red-500 text-white' }

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), bahan_baku_id: '', qty_per_porsi: 0 }])
  }

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      // Saat bahan dipilih, otomatis isi satuan dari kemasan_satuan bahan tersebut
      // (jika satuan item belum diset secara manual).
      if (field === 'bahan_baku_id' && value) {
        const bb = bahanBakuList.find((b: any) => b.id === value)
        if (bb?.kemasan_satuan) {
          updated.satuan = bb.kemasan_satuan
        }
      }
      return updated
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)

      if (items.some((i) => !i.bahan_baku_id || i.qty_per_porsi <= 0)) {
        toast.error('Pastikan semua bahan baku dipilih dan jumlah lebih dari 0')
        return
      }

      const resepPayload = {
        menu_item_ref: menu.id,
        nama: existingRecipe?.nama || `Resep ${menu.name}`,
        scope: 'global',
        is_active: isActive,
        catatan: catatan || null,
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

      const { error: delError } = await supabase.from('resep_item').delete().eq('resep_id', resepId)
      if (delError) throw delError

      if (items.length > 0) {
        const itemsPayload = items.map((i) => {
          const bb = bahanBakuList.find((b: any) => b.id === i.bahan_baku_id)
          // Gunakan satuan dari state item (diload dari DB atau saat bahan baru dipilih).
          // Fallback ke kemasan_satuan hanya jika item.satuan belum ter-set (item baru).
          const satuan = i.satuan || bb?.kemasan_satuan || ''
          return {
            resep_id: resepId,
            bahan_baku_id: i.bahan_baku_id,
            qty_per_porsi: i.qty_per_porsi,
            satuan,
          }
        })
        const { error: insError } = await supabase.from('resep_item').insert(itemsPayload)
        if (insError) throw insError
      }

      // Update Harga Jual in menu_items
      if (hargaJual !== Number(menu.price)) {
        const { error: menuError } = await supabase.from('menu_items').update({ price: hargaJual }).eq('id', menu.id)
        if (menuError) throw menuError
      }

      toast.success('Resep dan Harga berhasil disimpan!')
      router.refresh()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Terjadi kesalahan')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 border rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-xs uppercase tracking-wider text-gray-400">Produk</span>
          <span className="text-lg font-bold text-gray-900">{menu.name}</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded text-suka-primary focus:ring-suka-primary"
          />
          Resep Aktif (Memotong Stok)
        </label>
      </div>

      {/* Ringkasan hitam */}
      <div className="rounded-xl bg-suka-ink text-white p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 shadow-md">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400">COGS per unit</div>
          <div className="text-3xl font-extrabold">{rupiah(hpp.totalHpp)}</div>
          <div className="text-xs text-gray-400 mt-1">per piece</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400">Harga jual</div>
          <div className="mt-1 flex items-center relative">
            <span className="absolute left-3 text-lg font-bold text-suka-orange">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={hargaJual ? hargaJual.toLocaleString('id-ID') : ''}
              onChange={(e) => setHargaJual(Number(e.target.value.replace(/\D/g, '')) || 0)}
              className="w-full bg-black/20 text-3xl font-extrabold text-suka-orange rounded-lg py-1 pl-10 pr-3 border border-transparent focus:border-suka-orange focus:ring-1 focus:ring-suka-orange"
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">per unit (editable)</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400">Profit per piece</div>
          <div className="text-3xl font-extrabold text-suka-orange">{rupiah(hpp.marginRp)}</div>
          <div className="text-xs text-gray-400 mt-1">
            margin {marginPct !== null ? `${marginPct.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Margin bar */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-800">Simulasi Margin Keuntungan</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-gray-900">
              {marginPct !== null ? `${marginPct.toFixed(1)}%` : '—'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${marginBadge.cls}`}>
              {marginBadge.label}
            </span>
          </div>
        </div>
        
        <div className="relative pt-1">
          <input
            type="range"
            min="0"
            max="95"
            step="1"
            value={marginPct !== null ? Math.round(marginPct) : 0}
            disabled={hpp.totalHpp <= 0}
            onChange={(e) => {
              const newMarginPct = Number(e.target.value)
              if (newMarginPct >= 100 || hpp.totalHpp <= 0) return
              const calculatedPrice = hpp.totalHpp / (1 - (newMarginPct / 100))
              // Bulatkan ke kelipatan 500 terdekat agar harga jual masuk akal
              const roundedPrice = Math.ceil(calculatedPrice / 500) * 500
              setHargaJual(roundedPrice)
            }}
            className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-suka-ink focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-suka-primary disabled:opacity-50"
            style={{
              background: marginPct !== null 
                ? `linear-gradient(to right, #1f2937 ${Math.max(0, Math.min(100, marginPct))}%, #f3f4f6 ${Math.max(0, Math.min(100, marginPct))}%)` 
                : '#f3f4f6'
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>Geser slider untuk mencari margin ideal</span>
          <span>Max 95%</span>
        </div>
      </div>

      {/* Komposisi Bahan Baku (Editable Table) */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b bg-gray-50/50">
          <h2 className="text-sm font-bold uppercase tracking-widest text-suka-primary">Rincian Bahan Baku</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b bg-white">
                <th className="px-4 py-3 font-medium whitespace-nowrap">Bahan</th>
                <th className="px-4 py-3 font-medium text-center whitespace-nowrap">Harga Beli</th>
                <th className="px-4 py-3 font-medium text-center whitespace-nowrap">Isi Kemasan</th>
                <th className="px-4 py-3 font-medium text-center whitespace-nowrap">Dipakai/Porsi</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Subtotal</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const line = hpp.lines.find((l) => l.bahan_baku_id === item.bahan_baku_id)
                return (
                  <tr key={item.id} className="bg-white hover:bg-gray-50/30 transition-colors">
                    <td className="px-4 py-3 align-middle min-w-[250px]">
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
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 align-middle whitespace-nowrap">
                      {!item.bahan_baku_id ? '—' : line?.hasPrice ? rupiah(line.hargaBeliDisplay) : <span className="text-amber-600">belum diset</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 align-middle whitespace-nowrap">
                      {!item.bahan_baku_id ? '—' : line?.hasPrice ? `${line.kemasanQty} ${line.kemasanSatuan}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="relative inline-block w-28">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.qty_per_porsi || ''}
                          onChange={(e) => updateItem(item.id, 'qty_per_porsi', parseFloat(e.target.value))}
                          className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-suka-primary focus:ring-suka-primary pr-12 text-center"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          {bahanBakuList.find((b: any) => b.id === item.bahan_baku_id)?.kemasan_satuan || ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 align-middle whitespace-nowrap">
                      {!item.bahan_baku_id ? '—' : rupiah(line?.subtotal || 0)}
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Hapus Bahan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 border-dashed">
                    Belum ada bahan baku yang ditambahkan.
                  </td>
                </tr>
              )}

              {hpp.buffer > 0 && (
                <tr className="bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-900 font-medium pl-6">Loss</td>
                  <td className="px-4 py-3 text-center text-gray-500">{rupiah(hpp.buffer)}</td>
                  <td className="px-4 py-3 text-center text-gray-500">1 butir</td>
                  <td className="px-4 py-3 text-center text-gray-500">1 butir</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{rupiah(hpp.buffer)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50/30">
                <td className="px-4 py-4 font-bold text-gray-900 pl-6" colSpan={4}>COGS per unit</td>
                <td className="px-4 py-4 text-right font-extrabold text-gray-900 text-base">{rupiah(hpp.totalHpp)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          
          <div className="p-4 border-t">
            <button
              onClick={addItem}
              className="w-full py-2.5 border-2 border-dashed border-gray-200 text-gray-500 hover:border-suka-primary hover:text-suka-primary hover:bg-orange-50/50 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Tambah Bahan Baku
            </button>
          </div>
          
          {hpp.anyMissingPrice && (
            <div className="px-4 py-3 text-xs text-amber-600 bg-amber-50 font-medium">
              ⚠️ Sebagian bahan belum ada harga — COGS masih parsial.
            </div>
          )}
        </div>

        <div className="border-t p-5 bg-gray-50/80 space-y-4">
          <div>
             <h4 className="text-xs font-bold uppercase tracking-widest text-suka-primary mb-2">Catatan</h4>
             <textarea
               value={catatan}
               onChange={(e) => setCatatan(e.target.value)}
               rows={2}
               placeholder="Catatan resep / COGS (opsional). Disimpan saat klik Simpan Resep BOM."
               className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-suka-primary focus:ring-suka-primary"
             />
          </div>
          
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-suka-primary text-white rounded-md font-medium text-sm hover:bg-suka-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-suka-primary disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all"
            >
              {isSaving ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Resep BOM</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
