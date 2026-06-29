'use client'

import { useEffect, useState } from 'react'
import { Loader2, Tag, Percent, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'

type MenuItem = {
  id: string
  name: string
  price: number
}

type OutletPromo = {
  id?: string
  outlet_id?: string
  scope: 'global' | 'item'
  menu_item_id: string | null
  discount_type: 'percentage' | 'nominal'
  discount_value: number
  is_active: boolean
}

export default function KasirPromoPage() {
  const { outletId, loaded } = useMyOutlet()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [promos, setPromos] = useState<OutletPromo[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!loaded || !outletId) return
      
      try {
        const supabase = createClient()
        
        const [menuRes, promoRes] = await Promise.all([
          supabase.from('menu_items').select('id, name, price').eq('is_available', true).order('sort_order'),
          supabase.from('outlet_promos').select('*').eq('outlet_id', outletId)
        ])
        
        if (menuRes.error) throw menuRes.error
        if (promoRes.error) throw promoRes.error
        
        setMenuItems(menuRes.data || [])
        setPromos(promoRes.data || [])
      } catch (err: any) {
        console.error('Error loading data:', err)
        setMessage({ type: 'error', text: 'Gagal memuat data promo.' })
      } finally {
        setLoadingData(false)
      }
    }
    
    loadData()
  }, [outletId, loaded])

  const globalPromo = promos.find(p => p.scope === 'global') || {
    scope: 'global',
    menu_item_id: null,
    discount_type: 'percentage',
    discount_value: 0,
    is_active: false
  } as OutletPromo

  const isGlobalActive = globalPromo.is_active

  const handleGlobalPromoChange = (field: keyof OutletPromo, value: any) => {
    const updated = [...promos]
    const idx = updated.findIndex(p => p.scope === 'global')
    
    // If activating global promo, we should warn or auto-disable item promos, but we enforce it here
    if (field === 'is_active' && value === true) {
      // Auto disable all item promos
      updated.forEach(p => {
        if (p.scope === 'item') p.is_active = false
      })
    }
    
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], [field]: value }
    } else {
      updated.push({ ...globalPromo, [field]: value })
    }
    setPromos(updated)
  }

  const handleItemPromoChange = (menuId: string, field: keyof OutletPromo, value: any) => {
    const updated = [...promos]
    const idx = updated.findIndex(p => p.scope === 'item' && p.menu_item_id === menuId)
    
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], [field]: value }
    } else {
      updated.push({
        scope: 'item',
        menu_item_id: menuId,
        discount_type: 'nominal',
        discount_value: 0,
        is_active: field === 'is_active' ? value : false,
        [field]: value
      })
    }
    setPromos(updated)
  }

  const handleSave = async () => {
    if (!outletId) return
    setSaving(true)
    setMessage(null)
    
    try {
      const supabase = createClient()
      
      // Filter out empty invalid promos (value 0 but active, though we can just save them as inactive)
      const toUpsert = promos.map(p => ({
        ...(p.id ? { id: p.id } : {}),
        outlet_id: outletId,
        scope: p.scope,
        menu_item_id: p.menu_item_id,
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        is_active: p.is_active
      }))
      
      // we can use upsert. Since we don't have a unique constraint on (outlet_id, scope, menu_item_id),
      // we might just delete and recreate to be safe, but supabase upsert needs a PK.
      // Better to delete all and insert to keep it simple, or only insert if new, update if has ID.
      // Wait, we fetched IDs earlier.
      
      // Let's do upsert for those with ID, and insert for those without
      for (const p of toUpsert) {
        if (p.id) {
          const { error } = await supabase.from('outlet_promos').update(p).eq('id', p.id)
          if (error) throw error
        } else {
          const { error, data } = await supabase.from('outlet_promos').insert(p).select().single()
          if (error) throw error
          if (data) p.id = data.id
        }
      }
      
      // Update local state with new IDs
      setPromos(toUpsert as OutletPromo[])
      setMessage({ type: 'success', text: 'Pengaturan promo berhasil disimpan!' })
      
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan promo' })
    } finally {
      setSaving(false)
    }
  }

  if (!loaded || loadingData) return <div className="p-6"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
  if (!outletId) return <div className="p-6 text-red-500 font-bold">Outlet tidak ditemukan</div>

  return (
    <div className="max-w-4xl space-y-6 mb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan Promo</h1>
        <p className="text-gray-500 text-sm mt-1">Kelola diskon Global (Seluruh Transaksi) atau diskon Per Menu.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="font-medium">{message.text}</p>
        </div>
      )}

      <div className="card p-6 space-y-4 border-2 border-amber-100">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-500" /> Promo Semua Menu (Transaksi)
            </h2>
            <p className="text-sm text-gray-500 mt-1">Berlaku untuk total harga semua pesanan.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={globalPromo.is_active} onChange={(e) => handleGlobalPromoChange('is_active', e.target.checked)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        <div className={`grid grid-cols-2 gap-4 mt-4 transition-opacity ${!globalPromo.is_active ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Diskon</label>
            <select 
              className="input-field" 
              value={globalPromo.discount_type} 
              onChange={e => handleGlobalPromoChange('discount_type', e.target.value)}
            >
              <option value="percentage">Persentase (%)</option>
              <option value="nominal">Nominal (Rp)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nilai Diskon</label>
            <div className="relative">
              {globalPromo.discount_type === 'nominal' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>}
              <input 
                type="number" 
                min="0"
                className={`input-field ${globalPromo.discount_type === 'nominal' ? 'pl-9' : 'pr-9'}`}
                value={globalPromo.discount_value || ''}
                onChange={e => handleGlobalPromoChange('discount_value', Number(e.target.value))}
              />
              {globalPromo.discount_type === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><Percent className="w-4 h-4"/></span>}
            </div>
          </div>
        </div>
      </div>

      <div className={`card p-6 space-y-4 ${isGlobalActive ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <h2 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-500" /> Promo Per Menu
          </h2>
          <p className="text-sm text-gray-500 mt-1">Pilih menu spesifik yang ingin diberikan diskon. (Nonaktif jika Promo Semua Menu aktif)</p>
        </div>

        <div className="space-y-3 mt-4">
          {menuItems.map(menu => {
            const promo = promos.find(p => p.scope === 'item' && p.menu_item_id === menu.id) || {
              scope: 'item',
              menu_item_id: menu.id,
              discount_type: 'nominal',
              discount_value: 0,
              is_active: false
            } as OutletPromo

            return (
              <div key={menu.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 gap-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{menu.name}</p>
                  <p className="text-sm text-gray-500">Rp {menu.price.toLocaleString('id-ID')}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <select 
                    className="input-field py-1.5 text-sm w-32" 
                    value={promo.discount_type} 
                    onChange={e => handleItemPromoChange(menu.id, 'discount_type', e.target.value)}
                  >
                    <option value="nominal">Rp</option>
                    <option value="percentage">%</option>
                  </select>
                  
                  <input 
                    type="number" 
                    min="0"
                    placeholder="Nilai"
                    className="input-field py-1.5 text-sm w-24"
                    value={promo.discount_value || ''}
                    onChange={e => handleItemPromoChange(menu.id, 'discount_value', Number(e.target.value))}
                  />
                  
                  <label className="relative inline-flex items-center cursor-pointer ml-2">
                    <input type="checkbox" className="sr-only peer" checked={promo.is_active} onChange={(e) => handleItemPromoChange(menu.id, 'is_active', e.target.checked)} />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end pt-4 sticky bottom-4">
        <button 
          className="btn-primary px-8 py-3 shadow-lg shadow-amber-500/30 flex items-center gap-2"
          onClick={handleSave}
          disabled={saving}
        >
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          Simpan Pengaturan
        </button>
      </div>

    </div>
  )
}
