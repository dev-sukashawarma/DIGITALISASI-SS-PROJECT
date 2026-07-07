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

  const bahanNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const bb of bahanBakuList as any[]) m[bb.id] = bb.nama
    return m
  }, [bahanBakuList])

  const hpp = useMemo(
    () =>
      computeResepHpp(
        items.map((i) => ({ bahan_baku_id: i.bahan_baku_id, qty_per_porsi: Number(i.qty_per_porsi) || 0, satuan: i.satuan || '' })),
        bahanById,
        Number(menu.price) || 0,
        buffer,
      ),
    [items, bahanById, menu.price, buffer],
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
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
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
          return {
            resep_id: resepId,
            bahan_baku_id: i.bahan_baku_id,
            qty_per_porsi: i.qty_per_porsi,
            satuan: bb?.satuan || '',
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
    <div className="space-y-6">
      {/* ---------- Komposisi Bahan Baku (editable) ---------- */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Komposisi Bahan Baku</h2>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-suka-primary focus:ring-suka-primary"
            />
            Resep Aktif (Memotong Stok)
          </label>
        </div>

        <div className="p-6 space-y-4">
          {items.map((item) => {
            const line = hpp.lines.find((l) => l.bahan_baku_id === item.bahan_baku_id)
            return (
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
                  {!item.bahan_baku_id ? (
                    <span className="text-sm text-gray-300">—</span>
                  ) : line && !line.hasPrice ? (
                    <span className="text-xs text-amber-600">harga belum diset</span>
                  ) : (
                    <span className="text-sm font-semibold text-gray-800">{rupiah(line?.subtotal || 0)}</span>
                  )}
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  title="Hapus Bahan"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )
          })}

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

      {/* ---------- Hasil Perhitungan (kartu COGS, read-only) ---------- */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-suka-primary">Hasil Perhitungan</h3>

        <div className="border rounded-xl p-4 flex items-center justify-between bg-white shadow-sm">
          <span className="text-xs uppercase tracking-wider text-gray-400">Produk</span>
          <span className="text-lg font-bold text-gray-900">{menu.name}</span>
        </div>

        {/* Ringkasan hitam */}
        <div className="rounded-xl bg-suka-ink text-white p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400">COGS per unit</div>
            <div className="text-3xl font-extrabold">{rupiah(hpp.totalHpp)}</div>
            <div className="text-xs text-gray-500">per piece</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400">Harga jual</div>
            <div className="text-3xl font-extrabold text-suka-orange">{rupiah(Number(menu.price) || 0)}</div>
            <div className="text-xs text-gray-500">per unit (publish)</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400">Profit per piece</div>
            <div className="text-3xl font-extrabold text-suka-orange">{rupiah(hpp.marginRp)}</div>
            <div className="text-xs text-gray-500">
              margin {marginPct !== null ? `${marginPct.toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Margin bar */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">Margin keuntungan</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-gray-900">
                {marginPct !== null ? `${marginPct.toFixed(1)}%` : '—'}
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${marginBadge.cls}`}>{marginBadge.label}</span>
            </div>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-suka-ink transition-all"
              style={{ width: `${Math.max(0, Math.min(100, marginPct ?? 0))}%` }}
            />
          </div>
        </div>

        {/* Rincian bahan baku */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-suka-primary">Rincian Bahan Baku</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b">
                  <th className="px-4 py-2 font-medium">Bahan</th>
                  <th className="px-4 py-2 font-medium text-right">Harga Beli</th>
                  <th className="px-4 py-2 font-medium text-right">Isi Kemasan</th>
                  <th className="px-4 py-2 font-medium text-right">Dipakai/Porsi</th>
                  <th className="px-4 py-2 font-medium text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {hpp.lines.map((l, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-gray-900">{bahanNameById[l.bahan_baku_id] || '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {l.hasPrice ? rupiah(l.hargaBeliDisplay) : <span className="text-amber-600">belum diset</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {l.hasPrice ? `${l.kemasanQty} ${l.kemasanSatuan}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {l.qty_per_porsi} {l.satuan}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{rupiah(l.subtotal)}</td>
                  </tr>
                ))}
                {hpp.buffer > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-gray-900">Loss</td>
                    <td className="px-4 py-2 text-right text-gray-500">{rupiah(hpp.buffer)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">1 butir</td>
                    <td className="px-4 py-2 text-right text-gray-500">1 butir</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{rupiah(hpp.buffer)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="px-4 py-3 font-bold text-gray-900" colSpan={4}>COGS per unit</td>
                  <td className="px-4 py-3 text-right font-extrabold text-gray-900">{rupiah(hpp.totalHpp)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {hpp.anyMissingPrice && (
            <div className="px-4 py-2 text-xs text-amber-600 border-t">
              ⚠️ Sebagian bahan belum ada harga — COGS masih parsial.
            </div>
          )}
        </div>

        {/* Catatan */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-widest text-suka-primary mb-2">Catatan</h4>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={3}
            placeholder="Catatan resep / COGS (opsional). Disimpan saat klik Simpan Resep BOM."
            className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-suka-primary focus:ring-suka-primary"
          />
        </div>
      </div>
    </div>
  )
}
