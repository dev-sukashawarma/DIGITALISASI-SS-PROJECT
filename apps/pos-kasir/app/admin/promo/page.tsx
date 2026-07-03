'use client'

import { useEffect, useState } from 'react'
import { Loader2, Tag, Percent, CheckCircle2, AlertCircle, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
  min_purchase?: number | null
  end_date?: string | null
}

type Outlet = {
  id: string
  name: string
}

export default function AdminPromoPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [promos, setPromos] = useState<OutletPromo[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient()
        
        const [menuRes, outletsRes] = await Promise.all([
          supabase.from('menu_items').select('id, name, price').eq('is_available', true).order('sort_order'),
          supabase.from('outlets').select('id, name').eq('is_active', true)
        ])
        
        if (menuRes.error) throw menuRes.error
        if (outletsRes.error) throw outletsRes.error
        
        setMenuItems(menuRes.data || [])
        
        const activeOutlets = outletsRes.data || []
        setOutlets(activeOutlets)

        if (activeOutlets.length > 0) {
          const promoRes = await supabase.from('outlet_promos').select('*').eq('outlet_id', activeOutlets[0].id)
          if (promoRes.error) throw promoRes.error
          setPromos(promoRes.data || [])
        }
      } catch (err: any) {
        console.error('Error loading data:', err)
        setMessage({ type: 'error', text: 'Gagal memuat data promo.' })
      } finally {
        setLoadingData(false)
      }
    }
    
    loadData()
  }, [])

  const globalPromo = promos.find(p => p.scope === 'global') || {
    scope: 'global',
    menu_item_id: null,
    discount_type: 'percentage',
    discount_value: 0,
    is_active: false,
    min_purchase: null,
    end_date: null
  } as OutletPromo

  const isGlobalActive = globalPromo.is_active

  const handleGlobalPromoChange = (field: keyof OutletPromo, value: any) => {
    const updated = [...promos]
    const idx = updated.findIndex(p => p.scope === 'global')
    
    if (field === 'is_active' && value === true) {
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
        min_purchase: null,
        end_date: null,
        [field]: value
      })
    }
    setPromos(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      const supabase = createClient()
      
      const { data: currentOutlets, error: outletsErr } = await supabase.from('outlets').select('id').eq('is_active', true)
      if (outletsErr) throw outletsErr

      if (!currentOutlets || currentOutlets.length === 0) {
        throw new Error('Tidak ada outlet aktif untuk diterapkan promo.')
      }

      for (const outlet of currentOutlets) {
        const { data: existingPromos } = await supabase.from('outlet_promos').select('id, scope, menu_item_id').eq('outlet_id', outlet.id)
        
        const toUpsert = promos.map(p => {
          const existing = existingPromos?.find(ep => ep.scope === p.scope && ep.menu_item_id === p.menu_item_id)
          return {
            ...(existing ? { id: existing.id } : {}),
            outlet_id: outlet.id,
            scope: p.scope,
            menu_item_id: p.menu_item_id,
            discount_type: p.discount_type,
            discount_value: p.discount_value,
            is_active: p.is_active,
            min_purchase: p.min_purchase,
            end_date: p.end_date
          }
        })

        for (const p of toUpsert) {
          if (p.id) {
            const { error } = await supabase.from('outlet_promos').update(p).eq('id', p.id)
            if (error) throw error
          } else {
            const { error } = await supabase.from('outlet_promos').insert(p)
            if (error) throw error
          }
        }
      }
      
      setMessage({ type: 'success', text: 'Pengaturan promo berhasil diterapkan ke semua outlet!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan promo' })
    } finally {
      setSaving(false)
    }
  }

  if (loadingData) return <div className="p-6 flex justify-center items-center h-48"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
  
  const filteredMenuItems = menuItems.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="max-w-4xl flex flex-col min-h-full relative animate-fade-in">
      <div className="space-y-6 flex-1 pb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan Promo</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola diskon Global (Seluruh Transaksi) atau diskon Per Menu.</p>
          <div className="mt-3 inline-flex items-center px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
            Promo ini berlaku untuk <b>semua cabang</b>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        {/* PROMO GLOBAL */}
        <div className={`card p-6 space-y-4 border-2 transition-colors duration-300 ${globalPromo.is_active ? 'border-amber-400 bg-amber-50/40 shadow-sm' : 'border-gray-200 bg-white'}`}>
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className={`font-semibold text-lg flex items-center gap-2 ${globalPromo.is_active ? 'text-amber-700' : 'text-gray-800'}`}>
                <Tag className={`w-5 h-5 ${globalPromo.is_active ? 'text-amber-500' : 'text-gray-400'}`} /> Promo Semua Menu (Transaksi)
              </h2>
              <p className="text-sm text-gray-500 mt-1">Berlaku untuk total harga semua pesanan tanpa terkecuali.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" className="sr-only peer" checked={globalPromo.is_active} onChange={(e) => handleGlobalPromoChange('is_active', e.target.checked)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {globalPromo.is_active && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tipe Diskon</label>
                <select 
                  className="input bg-white border-gray-300 shadow-sm font-medium" 
                  value={globalPromo.discount_type} 
                  onChange={e => handleGlobalPromoChange('discount_type', e.target.value)}
                >
                  <option value="percentage">Persentase (%)</option>
                  <option value="nominal">Nominal (Rp)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nilai Diskon</label>
                <div className="relative shadow-sm rounded-xl">
                  {globalPromo.discount_type === 'nominal' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">Rp</span>}
                  <input 
                    type="number" 
                    onWheel={(e) => e.currentTarget.blur()}
                    min="0"
                    className={`input bg-white border-gray-300 font-bold text-gray-900 ${globalPromo.discount_type === 'nominal' ? 'pl-10' : 'pr-10'}`}
                    value={globalPromo.discount_value || ''}
                    onChange={e => handleGlobalPromoChange('discount_value', Number(e.target.value))}
                  />
                  {globalPromo.discount_type === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm"><Percent className="w-4 h-4"/></span>}
                </div>
              </div>
              
              <div className="sm:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Minimal Pembelian <span className="text-gray-400 font-normal">(Opsional)</span>
                </label>
                <div className="relative shadow-sm rounded-xl">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">Rp</span>
                  <input 
                    type="number" 
                    onWheel={(e) => e.currentTarget.blur()}
                    min="0"
                    placeholder="0"
                    className="input bg-white border-gray-300 font-medium text-gray-900 pl-10"
                    value={globalPromo.min_purchase || ''}
                    onChange={e => handleGlobalPromoChange('min_purchase', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>
              
              <div className="sm:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Batas Waktu Berakhir <span className="text-gray-400 font-normal">(Opsional)</span>
                </label>
                <div className="relative shadow-sm rounded-xl">
                  <input 
                    type="datetime-local" 
                    className="input bg-white border-gray-300 font-medium text-gray-900"
                    value={globalPromo.end_date ? new Date(globalPromo.end_date).toISOString().slice(0, 16) : ''}
                    onChange={e => handleGlobalPromoChange('end_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PROMO ITEM */}
        <div className={`card p-6 space-y-4 border-2 border-gray-100 transition-all duration-300 ${isGlobalActive ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>
          <div>
            <h2 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-500" /> Promo Per Menu
            </h2>
            <p className="text-sm text-gray-500 mt-1">Berikan diskon untuk menu spesifik. Fitur ini otomatis dinonaktifkan jika Promo Global aktif.</p>
          </div>

          <div className="relative max-w-sm mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Cari nama menu..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input pl-9 py-2 text-sm bg-gray-50 border-gray-200 focus:bg-white"
            />
          </div>

          <div className="space-y-3 mt-4">
            {filteredMenuItems.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-gray-500 text-sm">Tidak ada menu yang sesuai pencarian.</p>
              </div>
            ) : (
              filteredMenuItems.map(menu => {
                const promo = promos.find(p => p.scope === 'item' && p.menu_item_id === menu.id) || {
                  scope: 'item',
                  menu_item_id: menu.id,
                  discount_type: 'nominal',
                  discount_value: 0,
                  is_active: false,
                  min_purchase: null,
                  end_date: null
                } as OutletPromo

                let discountedPrice = menu.price;
                if (promo.is_active && promo.discount_value > 0) {
                  if (promo.discount_type === 'nominal') {
                    discountedPrice = Math.max(0, menu.price - promo.discount_value)
                  } else {
                    discountedPrice = Math.max(0, menu.price - (menu.price * promo.discount_value / 100))
                  }
                }

                return (
                  <div key={menu.id} className={`p-4 rounded-xl border transition-all duration-300 ${promo.is_active ? 'bg-blue-50/60 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className={`font-semibold ${promo.is_active ? 'text-blue-900' : 'text-gray-800'}`}>{menu.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {promo.is_active && promo.discount_value > 0 ? (
                            <>
                              <span className="text-xs text-gray-400 line-through">Rp {menu.price.toLocaleString('id-ID')}</span>
                              <span className="text-sm font-bold text-emerald-600">Rp {discountedPrice.toLocaleString('id-ID')}</span>
                            </>
                          ) : (
                            <span className="text-sm font-medium text-gray-500">Rp {menu.price.toLocaleString('id-ID')}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        {promo.is_active && (
                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                            <select 
                              className="input py-1.5 pl-2 pr-6 text-sm w-[72px] bg-white border-blue-200 text-center font-semibold text-blue-700 shadow-sm" 
                              value={promo.discount_type} 
                              onChange={e => handleItemPromoChange(menu.id, 'discount_type', e.target.value)}
                            >
                              <option value="nominal">Rp</option>
                              <option value="percentage">%</option>
                            </select>
                            
                            <div className="relative">
                              <input 
                                type="number" 
                                onWheel={(e) => e.currentTarget.blur()}
                                min="0"
                                placeholder="Nilai"
                                className={`input py-1.5 text-sm w-24 sm:w-28 bg-white border-blue-200 font-bold text-blue-900 shadow-sm ${promo.discount_type === 'nominal' ? 'pl-8' : 'pr-8'}`}
                                value={promo.discount_value || ''}
                                onChange={e => handleItemPromoChange(menu.id, 'discount_value', Number(e.target.value))}
                              />
                              {promo.discount_type === 'nominal' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-blue-400 font-bold">Rp</span>}
                              {promo.discount_type === 'percentage' && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-blue-400 font-bold">%</span>}
                            </div>
                          </div>
                        )}
                        
                        <label className="relative inline-flex items-center cursor-pointer ml-1">
                          <input type="checkbox" className="sr-only peer" checked={promo.is_active} onChange={(e) => handleItemPromoChange(menu.id, 'is_active', e.target.checked)} />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                      </div>
                    </div>

                    {promo.is_active && (
                      <div className="mt-4 pt-4 border-t border-blue-100/50 flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-blue-800 mb-1.5">Min. Pembelian (Opsional)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 font-bold">Rp</span>
                            <input 
                              type="number" 
                              onWheel={(e) => e.currentTarget.blur()}
                              min="0"
                              placeholder="0"
                              className="input py-1.5 text-sm w-full bg-white border-blue-200 text-blue-900 shadow-sm pl-9"
                              value={promo.min_purchase || ''}
                              onChange={e => handleItemPromoChange(menu.id, 'min_purchase', e.target.value ? Number(e.target.value) : null)}
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-blue-800 mb-1.5">Batas Waktu (Opsional)</label>
                          <input 
                            type="datetime-local" 
                            className="input py-1.5 text-sm w-full bg-white border-blue-200 text-blue-900 shadow-sm"
                            value={promo.end_date ? new Date(promo.end_date).toISOString().slice(0, 16) : ''}
                            onChange={e => handleItemPromoChange(menu.id, 'end_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 -mx-6 -mb-6 bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] z-40 flex justify-end">
        <button 
          className="btn-primary px-8 py-3 shadow-lg shadow-amber-500/30 flex items-center gap-2 text-sm font-bold sm:text-base w-full sm:w-auto justify-center"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          Terapkan ke Semua Cabang
        </button>
      </div>
    </div>
  )
}
