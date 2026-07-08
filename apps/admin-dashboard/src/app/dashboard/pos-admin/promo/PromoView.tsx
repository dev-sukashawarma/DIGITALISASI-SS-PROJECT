'use client'

import { useState } from 'react'
import { Loader2, Tag, Percent, CheckCircle2, AlertCircle, Search } from 'lucide-react'
import { savePromosAction } from './actions'

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

interface PromoViewProps {
  initialMenuItems: MenuItem[]
  initialOutlets: Outlet[]
  initialPromos: OutletPromo[]
}

const formatLocalDatetime = (dateString: string | null | undefined) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function PromoView({ initialMenuItems, initialOutlets, initialPromos }: PromoViewProps) {
  const [menuItems] = useState<MenuItem[]>(initialMenuItems)
  const [promos, setPromos] = useState<OutletPromo[]>(initialPromos)
  const [outlets] = useState<Outlet[]>(initialOutlets)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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
      if (!outlets || outlets.length === 0) {
        throw new Error('Tidak ada outlet aktif untuk diterapkan promo.')
      }

      await savePromosAction(outlets, promos)
      
      setMessage({ type: 'success', text: 'Pengaturan promo berhasil diterapkan ke semua outlet!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan promo' })
    } finally {
      setSaving(false)
    }
  }

  const filteredMenuItems = menuItems.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="max-w-4xl flex flex-col min-h-full relative animate-fade-in mx-auto">
      <div className="space-y-6 flex-1 pb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Pengaturan Promo</h1>
          <p className="text-gray-500 text-sm sm:text-base mt-1 font-medium">Kelola diskon Global (Seluruh Transaksi) atau diskon Per Menu.</p>
          <div className="mt-3 inline-flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 text-xs sm:text-sm font-semibold rounded-full border border-amber-200/60">
            <AlertCircle className="w-4 h-4 mr-1.5" />
            Berlaku untuk semua cabang outlet
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl flex items-start gap-3 animate-fade-up ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200/60 text-emerald-700' : 'bg-red-50 border border-red-200/60 text-red-700'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
            <p className="font-semibold text-sm leading-relaxed">{message.text}</p>
          </div>
        )}

        {/* PROMO GLOBAL */}
        <div className={`rounded-2xl p-6 sm:p-8 space-y-6 border-2 transition-all duration-300 ${globalPromo.is_active ? 'border-amber-400 bg-amber-50/30 shadow-card hover:shadow-card-hover' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className={`font-bold text-lg sm:text-xl flex items-center gap-2 ${globalPromo.is_active ? 'text-amber-700' : 'text-gray-900'}`}>
                <Tag className={`w-5 h-5 sm:w-6 sm:h-6 ${globalPromo.is_active ? 'text-amber-500' : 'text-gray-400'}`} /> 
                Promo Semua Menu
              </h2>
              <p className="text-sm text-gray-500 mt-1 font-medium">Berlaku untuk total harga semua pesanan tanpa terkecuali.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" className="sr-only peer" checked={globalPromo.is_active} onChange={(e) => handleGlobalPromoChange('is_active', e.target.checked)} />
              <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {globalPromo.is_active && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 pt-6 border-t border-amber-200/50 animate-fade-in">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">Tipe Diskon</label>
                <select 
                  className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none transition-colors font-semibold text-gray-900 appearance-none cursor-pointer"
                  value={globalPromo.discount_type} 
                  onChange={e => handleGlobalPromoChange('discount_type', e.target.value)}
                >
                  <option value="percentage">Persentase (%)</option>
                  <option value="nominal">Nominal (Rp)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">Nilai Diskon</label>
                <div className="relative">
                  {globalPromo.discount_type === 'nominal' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>}
                  <input 
                    type="number" 
                    onWheel={(e) => e.currentTarget.blur()}
                    min="0"
                    className={`w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl py-2.5 outline-none transition-colors font-bold text-gray-900 ${globalPromo.discount_type === 'nominal' ? 'pl-11 pr-4' : 'pl-4 pr-11'}`}
                    value={globalPromo.discount_value || ''}
                    onChange={e => handleGlobalPromoChange('discount_value', Number(e.target.value))}
                  />
                  {globalPromo.discount_type === 'percentage' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold"><Percent className="w-4 h-4"/></span>}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Minimal Pembelian <span className="text-gray-400 font-medium ml-1">(Opsional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                  <input 
                    type="number" 
                    onWheel={(e) => e.currentTarget.blur()}
                    min="0"
                    placeholder="0"
                    className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl pl-11 pr-4 py-2.5 outline-none transition-colors font-semibold text-gray-900"
                    value={globalPromo.min_purchase || ''}
                    onChange={e => handleGlobalPromoChange('min_purchase', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Batas Waktu <span className="text-gray-400 font-medium ml-1">(Opsional)</span>
                </label>
                <input 
                  type="datetime-local" 
                  className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none transition-colors font-semibold text-gray-900"
                  value={formatLocalDatetime(globalPromo.end_date)}
                  onChange={e => handleGlobalPromoChange('end_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
              </div>
            </div>
          )}
        </div>

        {/* PROMO ITEM */}
        <div className={`rounded-2xl p-6 sm:p-8 space-y-6 border-2 border-gray-100 bg-white shadow-sm transition-all duration-300 ${isGlobalActive ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
          <div>
            <h2 className="font-bold text-lg sm:text-xl text-gray-900 flex items-center gap-2">
              <Tag className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" /> Promo Per Menu
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">Berikan diskon untuk menu spesifik. Nonaktif saat Promo Global aktif.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Cari nama menu..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-400 focus:bg-white rounded-xl pl-12 pr-4 py-3 outline-none transition-colors font-medium text-gray-900"
            />
          </div>

          <div className="space-y-4 pt-2">
            {filteredMenuItems.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-500 font-medium">Tidak ada menu yang sesuai pencarian.</p>
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
                  <div key={menu.id} className={`p-5 rounded-2xl border-2 transition-all duration-300 ${promo.is_active ? 'bg-blue-50/40 border-blue-300 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                      <div className="flex-1">
                        <p className={`font-bold text-base sm:text-lg ${promo.is_active ? 'text-blue-900' : 'text-gray-900'}`}>{menu.name}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          {promo.is_active && promo.discount_value > 0 ? (
                            <>
                              <span className="text-sm text-gray-400 line-through decoration-gray-300 font-medium">Rp {menu.price.toLocaleString('id-ID')}</span>
                              <span className="text-base font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Rp {discountedPrice.toLocaleString('id-ID')}</span>
                            </>
                          ) : (
                            <span className="text-base font-bold text-gray-600">Rp {menu.price.toLocaleString('id-ID')}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0">
                        {promo.is_active && (
                          <div className="flex items-center gap-2 animate-fade-in">
                            <select 
                              className="bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl py-2 pl-3 pr-8 text-sm font-bold text-blue-800 outline-none transition-colors appearance-none cursor-pointer" 
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
                                className={`bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl py-2 text-sm w-28 font-bold text-blue-900 outline-none transition-colors ${promo.discount_type === 'nominal' ? 'pl-9 pr-3' : 'pl-3 pr-9'}`}
                                value={promo.discount_value || ''}
                                onChange={e => handleItemPromoChange(menu.id, 'discount_value', Number(e.target.value))}
                              />
                              {promo.discount_type === 'nominal' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-blue-400 font-bold">Rp</span>}
                              {promo.discount_type === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-400 font-bold">%</span>}
                            </div>
                          </div>
                        )}
                        
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={promo.is_active} onChange={(e) => handleItemPromoChange(menu.id, 'is_active', e.target.checked)} />
                          <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                      </div>
                    </div>

                    {promo.is_active && (
                      <div className="mt-5 pt-5 border-t border-blue-200/50 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-blue-900">Min. Pembelian <span className="text-blue-500/70 font-medium ml-1">(Opsional)</span></label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-blue-400 font-bold">Rp</span>
                            <input 
                              type="number" 
                              onWheel={(e) => e.currentTarget.blur()}
                              min="0"
                              placeholder="0"
                              className="w-full bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl pl-10 pr-3 py-2 text-sm font-semibold text-blue-900 outline-none transition-colors"
                              value={promo.min_purchase || ''}
                              onChange={e => handleItemPromoChange(menu.id, 'min_purchase', e.target.value ? Number(e.target.value) : null)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-blue-900">Batas Waktu <span className="text-blue-500/70 font-medium ml-1">(Opsional)</span></label>
                          <input 
                            type="datetime-local" 
                            className="w-full bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl px-3 py-2 text-sm font-semibold text-blue-900 outline-none transition-colors"
                            value={formatLocalDatetime(promo.end_date)}
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

      {/* Sticky Bottom Bar with safe padding */}
      <div className="sticky bottom-0 -mx-3 sm:-mx-6 lg:-mx-8 mt-12 bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] z-40 flex justify-end">
        <button 
          className="btn-primary px-8 py-3.5 rounded-xl shadow-lg shadow-amber-500/30 flex items-center gap-2 text-sm font-bold sm:text-base w-full sm:w-auto justify-center transition-transform active:scale-95"
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
