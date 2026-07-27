'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { Save, Store, RefreshCw, AlertCircle, Calculator } from 'lucide-react'
import type { Outlet, MenuOutletPrice } from '@/pos-types'

interface OutletPricingViewProps {
  menuItems: any[]
}

export default function OutletPricingView({ menuItems }: OutletPricingViewProps) {
  const supabase = createClient()
  
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  const [isLoadingOutlets, setIsLoadingOutlets] = useState(true)
  
  const [outletPrices, setOutletPrices] = useState<Record<string, MenuOutletPrice>>({})
  const [isLoadingPrices, setIsLoadingPrices] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load Outlets (Hanya Mitra)
  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        const { data, error } = await supabase
          .from('outlets')
          .select('*')
          .eq('type', 'mitra') // Hanya load MITRA
          .order('name')
        
        if (error) throw error
        setOutlets(data || [])
        if (data && data.length > 0) {
          setSelectedOutletId(data[0].id)
        }
      } catch (err: any) {
        toast.error('Gagal memuat daftar outlet')
        console.error(err)
      } finally {
        setIsLoadingOutlets(false)
      }
    }
    fetchOutlets()
  }, [])

  // Load Pricing when outlet changes
  useEffect(() => {
    if (!selectedOutletId) return

    const fetchPrices = async () => {
      setIsLoadingPrices(true)
      try {
        const { data, error } = await supabase
          .from('menu_outlet_prices')
          .select('*')
          .eq('outlet_id', selectedOutletId)
        
        if (error) throw error
        
        const priceMap: Record<string, MenuOutletPrice> = {}
        if (data) {
          data.forEach((p) => {
            priceMap[p.menu_item_id] = p
          })
        }
        setOutletPrices(priceMap)
      } catch (err: any) {
        toast.error('Gagal memuat harga khusus outlet')
        console.error(err)
      } finally {
        setIsLoadingPrices(false)
      }
    }
    fetchPrices()
  }, [selectedOutletId])

  const selectedOutlet = outlets.find(o => o.id === selectedOutletId)

  // Derived table data
  const tableData = useMemo(() => {
    return menuItems.map(menu => {
      const custom = outletPrices[menu.id]
      return {
        ...menu,
        is_available: custom ? custom.is_available : true,
        custom_price: custom ? custom.price : null,
        custom_hpp: custom ? custom.hpp_override : null
      }
    })
  }, [menuItems, outletPrices])

  const handleChange = (menuId: string, field: keyof MenuOutletPrice, value: any) => {
    setOutletPrices(prev => {
      const existing = prev[menuId] || {
        menu_item_id: menuId,
        outlet_id: selectedOutletId,
        price: null,
        hpp_override: null,
        is_available: true
      }
      return {
        ...prev,
        [menuId]: { ...existing, [field]: value }
      }
    })
  }

  const handleSave = async () => {
    if (!selectedOutletId) return
    setIsSaving(true)
    try {
      const payload = Object.values(outletPrices).map(p => ({
        menu_item_id: p.menu_item_id,
        outlet_id: selectedOutletId,
        price: p.price === null || p.price === '' as any ? null : Number(p.price),
        hpp_override: p.hpp_override === null || p.hpp_override === '' as any ? null : Number(p.hpp_override),
        is_available: p.is_available
      }))

      if (payload.length > 0) {
        const { error } = await supabase
          .from('menu_outlet_prices')
          .upsert(payload, { onConflict: 'menu_item_id,outlet_id' })
        
        if (error) throw error
        toast.success('Pengaturan harga outlet berhasil disimpan!')
      } else {
        toast.info('Tidak ada perubahan yang perlu disimpan.')
      }
    } catch (err: any) {
      toast.error('Gagal menyimpan perubahan. Pastikan tabel menu_outlet_prices sudah dibuat.')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAutoCalculate = () => {
    if (!selectedOutletId) return;
    
    if (!confirm('Hitung otomatis semua HPP Mitra menjadi +10% dari HPP Pusat? Angka akan berubah di tabel dan bisa Anda edit manual sebelum di-Simpan.')) return;

    setOutletPrices(prev => {
      const newPrices = { ...prev };
      
      tableData.forEach(row => {
        // HPP Pusat yang sedang aktif
        const baseHpp = row.hppOverride !== null ? row.hppOverride : row.hpp;
        
        if (baseHpp !== null && baseHpp > 0) {
          const autoHpp = Math.round(baseHpp * 1.10);
          
          const existing = newPrices[row.id] || {
            menu_item_id: row.id,
            outlet_id: selectedOutletId,
            price: null,
            hpp_override: null,
            is_available: true
          };
          
          newPrices[row.id] = { ...existing, hpp_override: autoHpp };
        }
      });
      
      return newPrices;
    });
    
    toast.success('HPP berhasil dihitung (+10%). Silakan periksa tabel dan klik Simpan!');
  };

  const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      
      {/* Top Bar - Header & Save Button */}
      <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-suka-primary/10 rounded-xl">
            <Store className="w-5 h-5 text-suka-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Manajemen HPP Mitra</h2>
            <p className="text-xs text-gray-500">Pilih mitra di bawah ini untuk mengatur HPP khusus dan ketersediaan menu.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          <button
            onClick={handleAutoCalculate}
            disabled={isSaving || isLoadingPrices}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold text-sm hover:bg-amber-100 transition-all disabled:opacity-50"
            title="Isi otomatis semua kotak HPP dengan +10% dari HPP Pusat"
          >
            <Calculator className="w-4 h-4" />
            Auto (+10%)
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoadingPrices}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-suka-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-suka-primary/30 hover:shadow-suka-primary/50 hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Perubahan
          </button>
        </div>
      </div>

      {/* Outlet Pills Selector */}
      <div className="p-4 px-6 bg-white border-b flex flex-wrap gap-2">
        {isLoadingOutlets ? (
          <div className="text-sm text-gray-500 animate-pulse py-2">Memuat data mitra...</div>
        ) : (
          outlets.map(o => (
            <button
              key={o.id}
              onClick={() => setSelectedOutletId(o.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                selectedOutletId === o.id
                  ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {o.name.replace('MITRA ', '')}
            </button>
          ))
        )}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        {isLoadingPrices ? (
           <div className="flex justify-center items-center py-20 text-gray-400 gap-2">
             <RefreshCw className="w-5 h-5 animate-spin" /> Memuat harga khusus...
           </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-white border-b border-gray-100 text-gray-500 text-[11px] uppercase tracking-wider font-extrabold">
              <tr>
                <th className="px-6 py-4 w-12 text-center">Tersedia?</th>
                <th className="px-6 py-4">Menu</th>
                <th className="px-6 py-4">HPP Pusat</th>
                <th className="px-6 py-4">Override HPP Outlet</th>
                <th className="px-6 py-4">Harga Jual</th>
                <th className="px-6 py-4 text-right">Estimasi Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableData.map((row) => {
                const activeHpp = row.custom_hpp !== null ? row.custom_hpp : (row.hppOverride !== null ? row.hppOverride : row.hpp)
                const profit = row.price > 0 && activeHpp !== null ? row.price - activeHpp : null
                
                return (
                  <tr key={row.id} className={`group transition-colors ${row.is_available ? 'hover:bg-gray-50/50' : 'bg-gray-50/30 opacity-70'}`}>
                    {/* Toggle Active */}
                    <td className="px-6 py-4 text-center align-middle">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={row.is_available}
                          onChange={(e) => handleChange(row.id, 'is_available', e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </td>
                    
                    {/* Menu Info */}
                    <td className="px-6 py-4 align-middle">
                      <div className="font-bold text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5">{row.category} {row.isPackage && '(Paket)'}</div>
                    </td>

                    {/* HPP Pusat */}
                    <td className="px-6 py-4 align-middle">
                      <div className="text-gray-900 font-medium">
                        {row.hppOverride !== null ? (
                          rupiah(row.hppOverride)
                        ) : row.hpp !== null ? (
                          rupiah(row.hpp)
                        ) : (
                          <span className="text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Belum Ada</span>
                        )}
                      </div>
                      {row.hppOverride !== null && row.hpp !== null && (
                         <div className="text-[10px] text-gray-400 mt-1" title="HPP asli dari Resep BOM">BOM Asli: {rupiah(row.hpp)}</div>
                      )}
                    </td>

                    {/* Override HPP Outlet */}
                    <td className="px-6 py-4 align-middle">
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">Rp</span>
                        <input
                          type="number"
                          value={row.custom_hpp !== null ? row.custom_hpp : ''}
                          onChange={(e) => handleChange(row.id, 'hpp_override', e.target.value)}
                          placeholder="Ikut Pusat"
                          disabled={!row.is_available}
                          className="w-full text-sm rounded-lg border-gray-200 shadow-sm focus:border-suka-primary focus:ring-suka-primary pl-8 pr-3 py-1.5 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                    </td>

                    {/* Harga Jual Pusat (Global) */}
                    <td className="px-6 py-4 align-middle font-medium text-gray-900">
                      {rupiah(row.price)}
                    </td>

                    {/* Profit */}
                    <td className="px-6 py-4 align-middle text-right">
                      {profit !== null ? (
                        <div>
                          <div className={`font-extrabold ${profit > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {rupiah(profit)}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-1 font-bold">
                            Margin {((profit / row.price) * 100).toFixed(1)}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
