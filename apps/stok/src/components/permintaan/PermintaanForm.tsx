'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSaranItem, usePermintaanActions, usePermintaanList } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { fetchActiveResep, calculateBahanBakuRequest, type ResepMenu, type CalculatedBahan } from '@/app/actions/permintaan_target'

export function PermintaanForm({ outletId, onSubmitSuccess }: { outletId: string; onSubmitSuccess?: () => void }) {
  const { saran } = useSaranItem(outletId)
  const { bahanBaku } = useBahanBaku()
  const { buat } = usePermintaanActions()
  const { permintaan: existingList, refresh: refreshExisting } = usePermintaanList(outletId)
  
  const [menus, setMenus] = useState<ResepMenu[]>([])
  const [loadingMenus, setLoadingMenus] = useState(false)
  
  // States
  const [menuTargets, setMenuTargets] = useState<Record<string, number>>({})
  const [manualBahan, setManualBahan] = useState<Record<string, number>>({}) // Stores id -> qty for manual/kritis items
  
  const [busy, setBusy] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [calculatedResult, setCalculatedResult] = useState<CalculatedBahan[]>([])
  
  // UI State
  const [activeTab, setActiveTab] = useState<'katalog' | 'bahan'>('katalog')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCartView, setIsCartView] = useState(false)
  const [manualPickId, setManualPickId] = useState('')

  const pendingItemIds = useMemo(() => new Set(
    existingList
      .filter(p => p.status === 'menunggu')
      .flatMap(p => p.items.map(it => it.bahan_baku_id))
  ), [existingList])

  // Fetch Menus
  useEffect(() => {
    setLoadingMenus(true)
    fetchActiveResep(outletId)
      .then(setMenus)
      .catch(console.error)
      .finally(() => setLoadingMenus(false))
  }, [outletId])

  // Auto-add critical items to manualBahan
  useEffect(() => {
    if (saran.length === 0) return
    setManualBahan(prev => {
      let changed = false
      const next = { ...prev }
      saran.forEach(s => {
        if (next[s.bahan_baku_id] || pendingItemIds.has(s.bahan_baku_id)) return
        const def = Math.max(1, Math.ceil(s.threshold - s.current_qty))
        next[s.bahan_baku_id] = def
        changed = true
      })
      return changed ? next : prev
    })
  }, [saran, pendingItemIds])

  // Calculate whenever menuTargets change
  useEffect(() => {
    const targets = Object.entries(menuTargets)
      .map(([resep_id, qty_target]) => ({ resep_id, qty_target }))
      .filter(t => t.qty_target > 0)
    
    if (targets.length === 0) {
      setCalculatedResult([])
      return
    }

    const timer = setTimeout(() => {
      setCalculating(true)
      calculateBahanBakuRequest(outletId, targets)
        .then(setCalculatedResult)
        .catch(console.error)
        .finally(() => setCalculating(false))
    }, 500) // Debounce

    return () => clearTimeout(timer)
  }, [menuTargets, outletId])

  // Combine Final Cart
  const finalCart = useMemo(() => {
    const map = new Map<string, { id: string, nama: string, satuan: string, qty: number, source: 'calc' | 'manual' | 'both', current_qty?: number, kebutuhan?: number }>()
    
    // Add Calculated
    calculatedResult.forEach(c => {
      if (pendingItemIds.has(c.bahan_baku_id)) return
      map.set(c.bahan_baku_id, {
        id: c.bahan_baku_id,
        nama: c.nama_bahan,
        satuan: c.satuan,
        qty: Math.ceil(c.kebutuhan),
        source: 'calc',
        current_qty: c.sisa_stok,
        kebutuhan: c.kebutuhan
      })
    })

    // Add Manual/Kritis
    Object.entries(manualBahan).forEach(([id, qty]) => {
      if (qty <= 0 || pendingItemIds.has(id)) return
      const b = bahanBaku.find(x => x.id === id)
      if (!b) return
      
      const existing = map.get(id)
      if (existing) {
        existing.qty += qty
        existing.source = 'both'
      } else {
        const saranItem = saran.find(s => s.bahan_baku_id === id)
        map.set(id, {
          id,
          nama: b.nama,
          satuan: b.satuan,
          qty,
          source: 'manual',
          current_qty: saranItem?.current_qty
        })
      }
    })

    return Array.from(map.values())
  }, [calculatedResult, manualBahan, bahanBaku, saran, pendingItemIds])

  function updateMenuTarget(id: string, delta: number) {
    setMenuTargets(prev => {
      const current = prev[id] || 0
      const next = Math.max(0, current + delta)
      const copy = { ...prev }
      if (next === 0) delete copy[id]
      else copy[id] = next
      return copy
    })
  }

  function updateManualBahan(id: string, delta: number) {
    setManualBahan(prev => {
      const current = prev[id] || 0
      const next = Math.max(0, current + delta)
      const copy = { ...prev }
      if (next === 0) delete copy[id]
      else copy[id] = next
      return copy
    })
  }

  function addManualFromPicker() {
    if (!manualPickId) return
    setManualBahan(prev => ({
      ...prev,
      [manualPickId]: (prev[manualPickId] || 0) + 1
    }))
    setManualPickId('')
  }

  const cartItemCount = Object.keys(menuTargets).length + Object.keys(manualBahan).length

  // Filter Menus
  const filteredMenus = useMemo(() => {
    return menus.filter(m => m.nama.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [menus, searchQuery])

  // Filter Bahan Baku for Manual Add
  const filteredBahanManual = useMemo(() => {
    return bahanBaku.filter(b => b.nama.toLowerCase().includes(searchQuery.toLowerCase()) && !pendingItemIds.has(b.id))
  }, [bahanBaku, searchQuery, pendingItemIds])

  async function submit() {
    const itemsToRequest = finalCart.filter(r => r.qty > 0)
    if (itemsToRequest.length === 0) {
      setErrorMsg("Tidak ada bahan baku yang perlu diminta (Quantity 0).")
      return
    }

    setBusy(true); setErrorMsg(null); setSuccessMsg(null)
    try {
      const targetMetadata = Object.entries(menuTargets).map(([id, qty]) => {
        const menu = menus.find(m => m.id === id)
        return {
          id,
          nama: menu?.nama ?? 'Unknown',
          qty,
          harga_jual: menu?.harga_jual ?? 0
        }
      }).filter(m => m.qty > 0)

      await buat(outletId, itemsToRequest.map(r => ({
        bahan_baku_id: r.id, qty_diminta: r.qty,
      })), targetMetadata)
      setMenuTargets({})
      setManualBahan({})
      setIsCartView(false)
      setSuccessMsg(`Permintaan berhasil dikirim (${itemsToRequest.length} item bahan baku). Menunggu persetujuan.`)
      refreshExisting()
      if (onSubmitSuccess) onSubmitSuccess()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }


  // CART VIEW
  if (isCartView) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
        <div className="flex items-center justify-between mb-2">
          <button 
            onClick={() => setIsCartView(false)}
            className="flex items-center gap-2 text-suka-brown font-semibold bg-white px-4 py-2 rounded-xl shadow-sm border border-suka-gray-200 active:scale-95 transition-all"
          >
            ← Kembali
          </button>
          <h2 className="font-['Lilita_One'] text-2xl text-suka-ink">Tinjau Permintaan</h2>
        </div>

        {errorMsg && (
          <div className="text-xs font-bold text-red-700 bg-red-100 border border-red-300 p-3 rounded-xl flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}>✕</button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-suka-gray-200 overflow-hidden">
          <div className="p-4 bg-suka-cream border-b border-suka-orange/20 flex justify-between items-center">
            <span className="font-bold text-suka-brown">Hasil Kalkulasi Bahan Baku</span>
            {calculating && <span className="text-xs text-suka-orange font-bold animate-pulse">Menghitung...</span>}
          </div>
          
          <div className="divide-y divide-suka-gray-100 max-h-[60vh] overflow-y-auto">
            {finalCart.length === 0 ? (
              <div className="p-8 text-center text-suka-gray-500 font-medium">Belum ada bahan baku yang perlu diminta.</div>
            ) : (
              finalCart.map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-suka-ink truncate text-sm">{item.nama}</h3>
                    <div className="flex gap-2 items-center mt-1">
                      {item.source === 'calc' || item.source === 'both' ? (
                        <span className="bg-orange-100 text-suka-orange text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Target Menu</span>
                      ) : null}
                      {item.source === 'manual' || item.source === 'both' ? (
                        <span className="bg-suka-gray-100 text-suka-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Manual/Kritis</span>
                      ) : null}
                      {item.current_qty !== undefined && (
                        <span className="text-[10px] text-red-500 font-bold uppercase">Sisa: {item.current_qty}</span>
                      )}
                    </div>
                  </div>
                  
                  {item.source === 'manual' ? (
                    // User can adjust manual items
                    <div className="flex items-center bg-suka-gray-50 rounded-lg p-1 border border-suka-gray-200">
                      <button onClick={() => updateManualBahan(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-suka-brown font-bold rounded hover:bg-white hover:shadow-sm transition-all">-</button>
                      <input 
                        type="number" value={item.qty} 
                        onChange={e => setManualBahan(prev => ({...prev, [item.id]: Number(e.target.value)}))}
                        className="w-12 text-center bg-transparent border-none p-0 font-bold text-sm text-suka-ink focus:ring-0" 
                      />
                      <button onClick={() => updateManualBahan(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-suka-brown font-bold rounded hover:bg-white hover:shadow-sm transition-all">+</button>
                    </div>
                  ) : (
                    // Calculated items are mostly read-only unless we allow overriding. For now, show readonly.
                    <div className="text-right flex flex-col items-end">
                      <div>
                        <span className="font-bold text-suka-ink text-lg">{item.qty}</span>
                        <span className="text-suka-gray-500 text-xs ml-1">{item.satuan}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          <div className="p-4 bg-suka-gray-50 border-t border-suka-gray-200">
            <button
              disabled={busy || finalCart.length === 0 || calculating}
              onClick={submit}
              className="w-full bg-suka-brown hover:bg-suka-ink text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {busy ? 'Mengirim...' : `Kirim ${finalCart.length} Permintaan`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // CATALOG VIEW
  return (
    <div className="space-y-5 pb-24">
      {pendingItemIds.size > 0 && (
        <div className="text-xs font-bold text-suka-brown bg-orange-100 border border-suka-orange/30 p-3 rounded-xl">
          ⏳ {pendingItemIds.size} item bahan baku sudah menunggu persetujuan SPV.
        </div>
      )}
      {successMsg && (
        <div className="text-xs font-bold text-suka-green bg-green-50 border border-suka-green/30 p-3 rounded-xl flex justify-between">
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex bg-white/60 p-1 rounded-xl shadow-sm border border-suka-gray-200 backdrop-blur-sm">
        <button
          className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'katalog' ? 'bg-suka-orange text-white shadow-sm' : 'text-suka-gray-500 hover:bg-suka-gray-50'}`}
          onClick={() => { setActiveTab('katalog'); setSearchQuery('') }}
        >
          🍔 Target Menu (Jualan)
        </button>
        <button
          className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'bahan' ? 'bg-suka-orange text-white shadow-sm' : 'text-suka-gray-500 hover:bg-suka-gray-50'}`}
          onClick={() => { setActiveTab('bahan'); setSearchQuery('') }}
        >
          📦 Tambah Manual
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span className="text-xl">🔍</span>
        </div>
        <input
          type="text"
          placeholder={activeTab === 'katalog' ? "Cari menu (misal: Shawarma Ayam)..." : "Cari bahan baku (misal: Tisu)..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-suka-gray-200 text-suka-ink rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange shadow-sm font-medium transition-all"
        />
      </div>

      {activeTab === 'katalog' ? (
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {loadingMenus ? (
            <div className="col-span-2 py-10 text-center text-suka-gray-500 font-medium">Memuat menu...</div>
          ) : filteredMenus.length === 0 ? (
            <div className="col-span-2 bg-white rounded-2xl p-8 text-center shadow-sm border border-suka-gray-200">
              <div className="text-4xl mb-3">🌯</div>
              <p className="text-suka-gray-500 font-medium">Menu tidak ditemukan</p>
            </div>
          ) : (
            filteredMenus.map(m => {
              const qty = menuTargets[m.id] || 0
              return (
                <div key={m.id} className={`bg-white rounded-2xl border p-3 flex flex-col justify-between transition-all ${qty > 0 ? 'border-suka-orange shadow-md bg-orange-50/30' : 'border-suka-gray-200 shadow-sm hover:border-suka-gray-300'}`}>
                  <div>
                    {m.image_url ? (
                      <div className="w-full aspect-[4/3] mb-3 rounded-xl overflow-hidden bg-suka-gray-50 border border-suka-gray-100 flex-shrink-0">
                        <img src={m.image_url} alt={m.nama} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ) : (
                      <div className="text-2xl mb-2">🌯</div>
                    )}
                    <h3 className="font-bold text-suka-ink text-sm leading-tight mb-3">{m.nama}</h3>
                  </div>
                  
                  <div className="mt-auto border-t border-suka-gray-100 pt-2">
                    {qty > 0 ? (
                      <div className="flex items-center justify-between bg-suka-orange/10 rounded-lg p-1">
                        <button onClick={() => updateMenuTarget(m.id, -1)} className="w-8 h-8 flex items-center justify-center text-suka-orange font-bold bg-white rounded shadow-sm">-</button>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            min="0"
                            value={qty || ''} 
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value);
                              setMenuTargets(prev => {
                                const copy = { ...prev };
                                if (val <= 0) delete copy[m.id];
                                else copy[m.id] = val;
                                return copy;
                              });
                            }}
                            className="w-12 text-center bg-white border border-suka-orange/20 rounded-md py-1 px-0 font-bold text-suka-orange text-sm focus:outline-none focus:ring-1 focus:ring-suka-orange" 
                          />
                          <span className="font-bold text-suka-orange text-sm">porsi</span>
                        </div>
                        <button onClick={() => updateMenuTarget(m.id, 1)} className="w-8 h-8 flex items-center justify-center text-suka-orange font-bold bg-white rounded shadow-sm">+</button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => updateMenuTarget(m.id, 1)}
                        className="w-full bg-white border-2 border-suka-gray-200 text-suka-ink hover:border-suka-orange hover:text-suka-orange font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center"
                      >
                        + Target
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-suka-cream border border-suka-orange/20 rounded-xl p-4">
            <h3 className="font-bold text-suka-brown text-sm mb-1">Item Kritis & Manual</h3>
            <p className="text-xs text-suka-gray-600 mb-3">Item yang stoknya menipis sudah ditambahkan otomatis. Anda bisa menambah bahan baku lain yang tidak terkait resep menu.</p>
            
            <div className="flex gap-2 mb-4">
              <select 
                value={manualPickId} 
                onChange={e => setManualPickId(e.target.value)}
                className="flex-1 bg-white border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-suka-orange"
              >
                <option value="">-- Pilih Bahan Baku --</option>
                {filteredBahanManual.map(b => (
                  <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>
                ))}
              </select>
              <button 
                onClick={addManualFromPicker}
                disabled={!manualPickId}
                className="bg-suka-orange text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Tambah
              </button>
            </div>

            <div className="space-y-2">
              {Object.entries(manualBahan).length === 0 ? (
                <div className="text-center py-4 text-suka-gray-500 text-xs">Belum ada item manual</div>
              ) : (
                Object.entries(manualBahan).map(([id, qty]) => {
                  const b = bahanBaku.find(x => x.id === id)
                  if (!b) return null
                  const saranItem = saran.find(s => s.bahan_baku_id === id)
                  return (
                    <div key={id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-suka-gray-200">
                      <div>
                        <p className="font-bold text-suka-ink text-sm">{b.nama}</p>
                        <p className="text-xs text-suka-gray-500">
                          {b.satuan} {saranItem && <span className="text-red-500 ml-1">(Kritis: Sisa {saranItem.current_qty})</span>}
                        </p>
                      </div>
                      <div className="flex items-center bg-suka-gray-50 rounded p-1 border border-suka-gray-200">
                        <button onClick={() => updateManualBahan(id, -1)} className="w-6 h-6 flex items-center justify-center text-suka-brown font-bold rounded hover:bg-white">-</button>
                        <input 
                          type="number" 
                          min="0"
                          value={qty || ''} 
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            setManualBahan(prev => {
                              const copy = { ...prev };
                              if (val <= 0) delete copy[id];
                              else copy[id] = val;
                              return copy;
                            });
                          }}
                          className="w-12 text-center bg-transparent border border-suka-gray-200 rounded p-0.5 font-bold text-sm text-suka-ink focus:outline-none focus:ring-1 focus:ring-suka-orange mx-1" 
                        />
                        <button onClick={() => updateManualBahan(id, 1)} className="w-6 h-6 flex items-center justify-center text-suka-brown font-bold rounded hover:bg-white">+</button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {cartItemCount > 0 && !isCartView && (
        <div className="fixed bottom-[88px] left-0 right-0 px-4 max-w-2xl mx-auto z-40 animate-in slide-in-from-bottom-10 fade-in">
          <button 
            onClick={() => setIsCartView(true)}
            className="w-full bg-suka-brown text-white shadow-xl rounded-2xl p-4 flex items-center justify-between hover:bg-suka-ink transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center font-bold relative text-xl">
                🛒
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-suka-brown">
                  {cartItemCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-white/70 uppercase font-bold tracking-widest">Keranjang</p>
                <p className="font-bold text-sm">Hitung & Tinjau Bahan Baku</p>
              </div>
            </div>
            <div className="bg-white/20 p-2 rounded-xl group-hover:translate-x-1 transition-transform">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
