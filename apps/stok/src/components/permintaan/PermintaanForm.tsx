import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '@suka/auth'
import { useSaranItem, usePermintaanActions, usePermintaanList, type SaranItem } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useOutletBudgetStatus } from '@/hooks/useOutletBudget'
import { estimateCartValue } from '@/app/actions/budget'
import { BudgetBadge } from './BudgetBadge'
import { formatTriUnitSaldoAdaptive, convertToDistribusiUnit, convertToBaseUnit } from '@/lib/format/compositeUnit'
import {
  Search,
  X,
  Flame,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
  Package,
} from 'lucide-react'

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

export function PermintaanForm({
  outletId,
  onSubmitSuccess,
  onCartViewChange,
}: {
  outletId: string
  onSubmitSuccess?: () => void
  onCartViewChange?: (isCart: boolean) => void
}) {
  const { outletStaff } = useAuth()
  const isKitchenRole = ['kitchen', 'admin_kitchen', 'admin', 'owner', 'developer'].includes(outletStaff?.role ?? '')

  const { saran } = useSaranItem(outletId)
  const { bahanBaku } = useBahanBaku()
  const { buat } = usePermintaanActions()
  const { permintaan: existingList, refresh: refreshExisting } = usePermintaanList(outletId)
  const { status: budgetStatus } = useOutletBudgetStatus(outletId)

  const [manualBahan, setManualBahan] = useState<Record<string, number>>({}) // id -> qty (satuan distribusi)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [isCartView, setIsCartView] = useState(false)
  const [showBatchNudge, setShowBatchNudge] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [cartEstimate, setCartEstimate] = useState<{ totalNilai: number; itemTanpaHarga: string[] }>({
    totalNilai: 0,
    itemTanpaHarga: [],
  })

  // Permintaan 'menunggu' yang sudah >12 jam dibebaskan dari daftar hide
  const STALE_HOURS = 12
  const pendingItemIds = useMemo(() => {
    const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000
    return new Set(
      existingList
        .filter(p => p.status === 'menunggu' && new Date(p.created_at).getTime() >= cutoff)
        .flatMap(p => p.items.map(it => it.bahan_baku_id))
    )
  }, [existingList])

  const prevCartViewRef = useRef(isCartView)
  useEffect(() => {
    if (prevCartViewRef.current !== isCartView) {
      prevCartViewRef.current = isCartView
      onCartViewChange?.(isCartView)
    }
  }, [isCartView, onCartViewChange])

  // Final Cart
  const finalCart = useMemo(() => {
    return Object.entries(manualBahan)
      .filter(([id, qty]) => qty > 0 && !pendingItemIds.has(id))
      .map(([id, qty]) => {
        const b = bahanBaku.find(x => x.id === id)
        const saranItem = saran.find(s => s.bahan_baku_id === id)
        const distUnit = b?.satuan_distribusi || b?.satuan || ''
        return {
          id,
          nama: b?.nama ?? id,
          satuan: b?.satuan ?? '',
          dist_satuan: distUnit,
          qty,
          current_qty: saranItem?.current_qty,
          saldo_is_gram: saranItem?.saldo_is_gram,
        }
      })
  }, [manualBahan, bahanBaku, saran, pendingItemIds])

  // Estimasi nilai Rupiah keranjang (debounce) — dikalikan langsung dengan Qty Satuan Pesan (Distribusi)
  useEffect(() => {
    const items = finalCart
      .map(item => {
        return { bahan_baku_id: item.id, qty: item.qty }
      })
      .filter(it => it.qty > 0)

    if (items.length === 0) {
      setCartEstimate(prev => {
        if (prev.totalNilai === 0 && prev.itemTanpaHarga.length === 0) return prev
        return { totalNilai: 0, itemTanpaHarga: [] }
      })
      return
    }

    const timer = setTimeout(() => {
      estimateCartValue(items)
        .then(res => setCartEstimate(res))
        .catch(console.error)
    }, 500)

    return () => clearTimeout(timer)
  }, [finalCart])

  // Filter bahan baku: kategori BUMBU hanya untuk role kitchen / admin / owner / dev
  const allowedBahanBaku = useMemo(() => {
    return bahanBaku.filter(b => {
      if (!isKitchenRole && b.kategori?.toUpperCase() === 'BUMBU') return false
      return true
    })
  }, [bahanBaku, isKitchenRole])

  // Actions
  function updateManualBahan(id: string, delta: number) {
    setManualBahan(prev => {
      const current = prev[id] || 0
      const next = Math.max(0, current + delta)
      const copy = { ...prev }
      if (next <= 0) delete copy[id]
      else copy[id] = next
      return copy
    })
  }

  function setManualBahanExact(id: string, val: number) {
    setManualBahan(prev => {
      const copy = { ...prev }
      if (val <= 0) delete copy[id]
      else copy[id] = val
      return copy
    })
  }

  function addCriticalItem(s: SaranItem) {
    const kekuranganBase = Math.max(1, Math.ceil(s.threshold - s.current_qty))
    const b_info = bahanBaku.find(x => x.id === s.bahan_baku_id)
    const distQty = b_info ? convertToDistribusiUnit(kekuranganBase, b_info) : kekuranganBase
    setManualBahan(p => ({ ...p, [s.bahan_baku_id]: Math.ceil(distQty) }))
  }

  function addAllCriticalItems() {
    const unadded = saran.filter(s => {
      if (manualBahan[s.bahan_baku_id] || pendingItemIds.has(s.bahan_baku_id)) return false
      const b = bahanBaku.find(x => x.id === s.bahan_baku_id)
      if (!isKitchenRole && b?.kategori?.toUpperCase() === 'BUMBU') return false
      return true
    })
    if (unadded.length === 0) return
    setManualBahan(prev => {
      const copy = { ...prev }
      unadded.forEach(s => {
        const kekuranganBase = Math.max(1, Math.ceil(s.threshold - s.current_qty))
        const b_info = bahanBaku.find(x => x.id === s.bahan_baku_id)
        const distQty = b_info ? convertToDistribusiUnit(kekuranganBase, b_info) : kekuranganBase
        copy[s.bahan_baku_id] = Math.ceil(distQty)
      })
      return copy
    })
  }

  const criticalItems = useMemo(() => {
    return saran.filter(s => {
      if (pendingItemIds.has(s.bahan_baku_id)) return false
      const b = bahanBaku.find(x => x.id === s.bahan_baku_id)
      if (!isKitchenRole && b?.kategori?.toUpperCase() === 'BUMBU') return false
      return true
    })
  }, [saran, pendingItemIds, bahanBaku, isKitchenRole])

  const unaddedCriticalCount = useMemo(() => {
    return criticalItems.filter(s => !manualBahan[s.bahan_baku_id]).length
  }, [criticalItems, manualBahan])

  const categories = useMemo(() => {
    const unique = Array.from(new Set(allowedBahanBaku.map(b => b.kategori).filter(Boolean)))
    return unique
  }, [allowedBahanBaku])

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return allowedBahanBaku.filter(b => {
      if (pendingItemIds.has(b.id)) return false

      // Category filter
      if (selectedCategory === 'kritis') {
        if (!criticalItems.some(s => s.bahan_baku_id === b.id)) return false
      } else if (selectedCategory !== 'all') {
        if (b.kategori !== selectedCategory) return false
      }

      // Search filter
      if (q) {
        const matchName = b.nama.toLowerCase().includes(q)
        const matchCat = b.kategori && b.kategori.toLowerCase().includes(q)
        if (!matchName && !matchCat) return false
      }

      return true
    })
  }, [allowedBahanBaku, pendingItemIds, selectedCategory, searchQuery, criticalItems])

  const groupedItems = useMemo(() => {
    if (selectedCategory === 'kritis') {
      return [
        {
          category: 'Bahan Baku Stok Kritis',
          isCritical: true,
          items: filteredItems,
        },
      ]
    }

    if (selectedCategory !== 'all') {
      return [
        {
          category: selectedCategory,
          isCritical: false,
          items: filteredItems,
        },
      ]
    }

    // Group by kategori
    const map = new Map<string, typeof filteredItems>()
    for (const item of filteredItems) {
      const cat = item.kategori || 'LAIN-LAIN'
      if (!map.has(cat)) {
        map.set(cat, [])
      }
      map.get(cat)!.push(item)
    }

    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      isCritical: false,
      items,
    }))
  }, [filteredItems, selectedCategory])

  const cartItemCount = finalCart.length

  async function submit() {
    const itemsToRequest = finalCart.filter(r => r.qty > 0)
    if (itemsToRequest.length === 0) {
      setErrorMsg('Tidak ada bahan baku yang perlu diminta (Quantity 0).')
      setShowConfirmModal(false)
      return
    }

    setBusy(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await buat(
        outletId,
        itemsToRequest.map(r => {
          const b = bahanBaku.find(x => x.id === r.id)
          const qtyDimintaBase = b ? convertToBaseUnit(r.qty, b) : r.qty
          return {
            bahan_baku_id: r.id,
            qty_diminta: qtyDimintaBase,
          }
        })
      )
      setManualBahan({})
      setIsCartView(false)
      setShowBatchNudge(false)
      setShowConfirmModal(false)
      setSuccessMsg(`Permintaan berhasil dikirim (${itemsToRequest.length} item bahan baku). Menunggu persetujuan.`)
      refreshExisting()
      if (onSubmitSuccess) onSubmitSuccess()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function handleInitiateSubmit() {
    if (finalCart.length === 0) return
    if (finalCart.length === 1 && pendingItemIds.size > 0) {
      setShowBatchNudge(true)
    } else {
      setShowConfirmModal(true)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CART VIEW (Mobile & Review Screen)
  // ──────────────────────────────────────────────────────────────────────────
  if (isCartView) {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartView(false)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-suka-brown/10 text-suka-brown hover:bg-suka-cream hover:text-suka-orange active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Kembali ke Katalog Bahan"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Tinjau Permintaan</h2>
              <p className="text-xs text-suka-brown/60 font-medium">Periksa kembali daftar dan jumlah bahan sebelum dikirim</p>
            </div>
          </div>
          <span className="text-xs font-black bg-suka-orange/10 text-suka-orange px-3 py-1 rounded-full border border-suka-orange/20">
            {finalCart.length} Item
          </span>
        </div>

        {errorMsg && (
          <div className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 font-black cursor-pointer">
              ✕
            </button>
          </div>
        )}

        <BudgetBadge status={budgetStatus} projectedAdd={cartEstimate.totalNilai} />

        <div className="bg-white rounded-3xl shadow-xs border border-suka-brown/10 overflow-hidden">
          <div className="p-4 bg-suka-cream/40 border-b border-suka-brown/10 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-suka-orange" />
              <span className="font-extrabold text-xs text-suka-brown uppercase tracking-wider">
                Rincian Bahan Baku yang Diminta
              </span>
            </div>
            {cartEstimate.totalNilai > 0 && (
              <span className="text-xs font-black text-suka-brown bg-white px-2.5 py-1 rounded-lg border border-suka-brown/10">
                Estimasi: {formatRp(cartEstimate.totalNilai)}
              </span>
            )}
          </div>

          <div className="divide-y divide-suka-brown/5 max-h-[60vh] overflow-y-auto">
            {finalCart.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-suka-cream/60 text-suka-brown/40 flex items-center justify-center mx-auto">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-suka-brown/60">Belum ada bahan baku yang dipilih.</p>
                <button
                  onClick={() => setIsCartView(false)}
                  className="text-xs font-bold text-suka-orange hover:underline cursor-pointer"
                >
                  ← Kembali ke katalog bahan
                </button>
              </div>
            ) : (
              finalCart.map(item => {
                const b = bahanBaku.find(x => x.id === item.id)
                const hargaBelumDiset = cartEstimate.itemTanpaHarga.includes(item.id)
                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-suka-cream/10 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-suka-brown text-sm sm:text-base">{item.nama}</h3>
                        {hargaBelumDiset && (
                          <span className="text-[9px] font-bold text-suka-brown/50 bg-suka-cream px-2 py-0.5 rounded-full border border-suka-brown/10">
                            Harga belum diset
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        {item.current_qty !== undefined && (
                          <span className="text-red-500 font-bold">
                            Sisa Stok:{' '}
                            {formatTriUnitSaldoAdaptive(
                              item.current_qty,
                              item.saldo_is_gram ?? false,
                              item.satuan,
                              b?.satuan_tengah,
                              b?.faktor_tengah,
                              b?.satuan_kecil,
                              b?.faktor_tampilan,
                              true
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-suka-brown/5">
                      <span className="sm:hidden text-xs font-bold text-suka-brown/60">Jumlah Dipesan:</span>
                      {/* Main Stepper */}
                      <div className="flex items-center bg-suka-cream/40 rounded-xl p-1 border border-suka-brown/10">
                        <button
                          onClick={() => updateManualBahan(item.id, -1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-suka-brown hover:bg-red-50 hover:text-red-600 font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          {item.qty === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                        </button>
                        <div className="flex items-center px-3">
                          <input
                            type="number"
                            min="1"
                            value={item.qty || ''}
                            onChange={e => setManualBahanExact(item.id, Number(e.target.value))}
                            className="w-12 text-center bg-transparent border-none p-0 font-extrabold text-sm text-suka-brown focus:ring-0"
                          />
                          <span className="text-xs font-bold text-suka-brown/60 ml-1">{item.dist_satuan}</span>
                        </div>
                        <button
                          onClick={() => updateManualBahan(item.id, 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-suka-orange text-white hover:bg-orange-600 font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {finalCart.length > 0 && (
            <div className="p-4 sm:p-5 bg-suka-cream/20 border-t border-suka-brown/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={() => setIsCartView(false)}
                className="w-full sm:w-auto px-4 py-3 text-xs font-bold text-suka-brown/70 hover:text-suka-brown hover:bg-white rounded-xl border border-transparent hover:border-suka-brown/10 transition-all cursor-pointer"
              >
                + Tambah Bahan Lain
              </button>

              <button
                disabled={busy || finalCart.length === 0}
                onClick={handleInitiateSubmit}
                className="w-full sm:w-auto flex-1 max-w-sm bg-suka-orange hover:bg-orange-600 text-white font-extrabold text-sm py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{busy ? 'Mengirim Permintaan...' : `Kirim ${finalCart.length} Permintaan Bahan`}</span>
              </button>
            </div>
          )}
        </div>

        {/* Batch Nudge Modal */}
        {showBatchNudge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
            <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-suka-brown/10">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-suka-brown text-base">Masih ada permintaan yang menunggu</h3>
                <p className="text-xs text-suka-brown/70 leading-relaxed mt-1">
                  Anda memiliki <strong className="text-suka-brown font-extrabold">{pendingItemIds.size} item bahan baku</strong> lain
                  yang masih menunggu persetujuan admin kitchen. Mau gabungkan dengan bahan lain dulu atau kirim sekarang?
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowBatchNudge(false)
                    setIsCartView(false)
                  }}
                  className="flex-1 border border-suka-brown/20 text-suka-brown font-bold text-xs py-3 rounded-xl hover:bg-suka-cream/50 transition-colors cursor-pointer"
                >
                  Tambah Dulu
                </button>
                <button
                  onClick={() => {
                    setShowBatchNudge(false)
                    setShowConfirmModal(true)
                  }}
                  className="flex-1 bg-suka-orange hover:bg-orange-600 text-white font-bold text-xs py-3 rounded-xl transition-colors shadow-2xs cursor-pointer"
                >
                  Kirim Sekarang
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Guard Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
            <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-suka-brown/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-suka-orange/10 text-suka-orange flex items-center justify-center shrink-0">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-suka-brown text-base">Kirim Permintaan Bahan?</h3>
                  <p className="text-xs text-suka-brown/60">
                    Total <strong className="text-suka-brown font-black">{finalCart.length} item</strong> bahan baku akan diajukan ke Kitchen / Gudang.
                  </p>
                </div>
              </div>

              {/* Item summary box */}
              <div className="bg-suka-cream/30 rounded-2xl p-3 border border-suka-brown/10 max-h-48 overflow-y-auto space-y-1.5 divide-y divide-suka-brown/5 text-xs">
                {finalCart.map(item => (
                  <div key={item.id} className="pt-1.5 first:pt-0 flex items-center justify-between">
                    <span className="font-bold text-suka-brown truncate pr-2">{item.nama}</span>
                    <span className="font-extrabold text-suka-brown whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-suka-brown/10">
                      {item.qty} {item.dist_satuan}
                    </span>
                  </div>
                ))}
              </div>

              {cartEstimate.totalNilai > 0 && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-bold text-suka-brown/60">Estimasi Nilai:</span>
                  <span className="font-black text-suka-brown">{formatRp(cartEstimate.totalNilai)}</span>
                </div>
              )}

              {errorMsg && (
                <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 border border-suka-brown/20 text-suka-brown font-bold text-xs py-3 rounded-xl hover:bg-suka-cream/50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={submit}
                  className="flex-1 bg-suka-orange hover:bg-orange-600 text-white font-extrabold text-xs py-3 rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{busy ? 'Mengirim...' : 'Ya, Kirim Sekarang'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN CATALOG VIEW (2-Column Desktop, 1-Column Mobile)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-36 lg:pb-12">
      {/* Pending Alert */}
      {pendingItemIds.size > 0 && (
        <div className="text-xs font-bold text-amber-900 bg-amber-50/80 border border-amber-200/80 p-4 rounded-2xl flex items-center gap-3 shadow-2xs animate-in fade-in">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {pendingItemIds.size} item bahan baku sedang menunggu persetujuan admin_kitchen. Bahan tersebut otomatis disembunyikan agar tidak terduplikasi.
          </span>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-black cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="space-y-3">
        {/* Search Input & Quick Mobile Cart Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-suka-brown/40">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Cari nama bahan baku atau kategori (misal: Foil, Daging, Saos)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-suka-brown/10 text-suka-brown placeholder:text-suka-brown/40 rounded-2xl pl-12 pr-10 py-3.5 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange shadow-2xs font-semibold text-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-suka-brown/40 hover:text-suka-brown cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Cart Button on Mobile Header */}
          {cartItemCount > 0 && (
            <button
              onClick={() => setIsCartView(true)}
              className="lg:hidden shrink-0 h-[48px] px-3.5 bg-suka-orange text-white rounded-2xl flex items-center gap-2 shadow-2xs active:scale-95 transition-all cursor-pointer font-bold text-xs"
              title="Buka Keranjang"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="bg-white text-suka-orange text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {cartItemCount}
              </span>
            </button>
          )}
        </div>

        {/* Category Chips & Quick Action */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-suka-brown text-white shadow-2xs'
                  : 'bg-white text-suka-brown/70 border border-suka-brown/10 hover:bg-suka-cream/50'
              }`}
            >
              Semua ({allowedBahanBaku.filter(b => !pendingItemIds.has(b.id)).length})
            </button>

            {criticalItems.length > 0 && (
              <button
                onClick={() => setSelectedCategory('kritis')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'kritis'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Kritis ({criticalItems.length})</span>
              </button>
            )}

            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-suka-brown text-white shadow-2xs'
                    : 'bg-white text-suka-brown/70 border border-suka-brown/10 hover:bg-suka-cream/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 1-Click Add All Critical Button */}
          {unaddedCriticalCount > 0 && (
            <button
              onClick={addAllCriticalItems}
              className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white text-xs font-black px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer ml-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ Tambah Semua Kritis ({unaddedCriticalCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Product Cards Grid (lg:col-span-7 / xl:col-span-8) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="flex items-center justify-between text-xs text-suka-brown/60 px-1 font-bold">
            <span>Menampilkan {filteredItems.length} bahan baku</span>
            {searchQuery && <span>Hasil pencarian: &quot;{searchQuery}&quot;</span>}
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-suka-brown/10 p-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-suka-cream/60 text-suka-brown/40 flex items-center justify-center mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <p className="font-extrabold text-suka-brown text-sm">Tidak ada bahan baku yang sesuai</p>
              <p className="text-xs text-suka-brown/50">Coba ubah kata kunci pencarian atau pilih filter kategori lain.</p>
              {(searchQuery || selectedCategory !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('all')
                  }}
                  className="mt-2 text-xs font-bold text-suka-orange hover:underline cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {groupedItems.map(group => (
                <section key={group.category} className="space-y-3.5">
                  {/* Category Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-suka-brown/10">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-4 rounded-full ${
                          group.isCritical ? 'bg-red-500' : 'bg-suka-orange'
                        }`}
                      />
                      <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider text-suka-brown flex items-center gap-1.5 font-display">
                        {group.isCritical && <Flame className="w-4 h-4 text-red-500" />}
                        <span>{group.category}</span>
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-suka-brown/50 bg-suka-cream/40 px-2.5 py-0.5 rounded-full">
                      {group.items.length} item
                    </span>
                  </div>

                  {/* Cards Grid for this category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {group.items.map(item => {
                      const isAdded = (manualBahan[item.id] || 0) > 0
                      const qty = manualBahan[item.id] || 0
                      const saranItem = saran.find(s => s.bahan_baku_id === item.id)
                      const distUnit = item.satuan_distribusi || item.satuan || ''
                      const isCritical = !!saranItem

                      return (
                        <div
                          key={item.id}
                          className={`relative bg-white rounded-2xl border p-4 transition-all flex flex-col justify-between shadow-2xs ${
                            isAdded
                              ? 'border-suka-orange ring-2 ring-suka-orange/20 shadow-xs'
                              : isCritical
                              ? 'border-red-200 hover:border-red-300 bg-gradient-to-b from-white to-red-50/20'
                              : 'border-suka-brown/10 hover:border-suka-brown/20'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span className="text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-suka-cream/50 text-suka-brown/60">
                                {item.kategori || 'BAHAN BAKU'}
                              </span>
                              {isCritical && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1 shrink-0">
                                  <Flame className="w-2.5 h-2.5" /> Kritis
                                </span>
                              )}
                            </div>

                            <h4 className="font-extrabold text-suka-brown text-sm sm:text-base leading-snug">
                              {item.nama}
                            </h4>

                            {/* Stock / Sisa info */}
                            <div className="mt-2 text-xs">
                              {saranItem ? (
                                <div className="text-red-600 font-bold flex items-center gap-1">
                                  <span className="opacity-75">Sisa:</span>
                                  <span>
                                    {formatTriUnitSaldoAdaptive(
                                      saranItem.current_qty,
                                      saranItem.saldo_is_gram,
                                      item.satuan,
                                      item.satuan_tengah,
                                      item.faktor_tengah,
                                      item.satuan_kecil,
                                      item.faktor_tampilan
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-suka-brown/50 font-medium text-[11px]">
                                  Satuan Pesan: <span className="font-bold text-suka-brown/70">{distUnit}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button / Stepper */}
                          <div className="mt-4 pt-3 border-t border-suka-brown/5 flex items-center justify-between gap-2">
                            {!isAdded ? (
                              <button
                                onClick={() => {
                                  if (saranItem) addCriticalItem(saranItem)
                                  else updateManualBahan(item.id, 1)
                                }}
                                className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                  isCritical
                                    ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 shadow-2xs'
                                    : 'bg-suka-cream/50 hover:bg-suka-orange hover:text-white text-suka-brown border border-suka-brown/10'
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>
                                  {isCritical
                                    ? `Rekomendasi (${distUnit})`
                                    : `Tambah (${distUnit})`}
                                </span>
                              </button>
                            ) : (
                              <div className="w-full flex items-center justify-between bg-suka-cream/30 p-1 rounded-xl border border-suka-orange/30">
                                <button
                                  onClick={() => updateManualBahan(item.id, -1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-suka-brown hover:bg-red-50 hover:text-red-600 font-black shadow-2xs transition-colors cursor-pointer"
                                >
                                  {qty === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                                </button>
                                <div className="flex items-center gap-1 px-2 font-bold text-suka-brown text-sm">
                                  <input
                                    type="number"
                                    min="1"
                                    value={qty || ''}
                                    onChange={e =>
                                      setManualBahanExact(item.id, e.target.value === '' ? 0 : Number(e.target.value))
                                    }
                                    className="w-10 text-center font-extrabold text-suka-brown bg-transparent border-none p-0 focus:ring-0"
                                  />
                                  <span className="text-[10px] text-suka-brown/60 font-semibold">{distUnit}</span>
                                </div>
                                <button
                                  onClick={() => updateManualBahan(item.id, 1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-suka-orange text-white hover:bg-orange-600 font-black shadow-2xs transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Desktop Sticky Order Panel (hidden lg:block lg:col-span-5) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-24 space-y-4">
          <div className="bg-white rounded-3xl border border-suka-brown/10 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-suka-brown/10">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-suka-orange" />
                <h3 className="font-extrabold text-sm text-suka-brown">Keranjang Permintaan</h3>
              </div>
              <span className="text-xs font-black bg-suka-orange text-white px-2.5 py-0.5 rounded-full">
                {cartItemCount} item
              </span>
            </div>

            {/* Budget status badge */}
            <BudgetBadge status={budgetStatus} projectedAdd={cartEstimate.totalNilai} />

            {/* Cart items list */}
            {finalCart.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs font-bold text-suka-brown/40">Keranjang masih kosong.</p>
                <p className="text-[11px] text-suka-brown/40">
                  Pilih bahan baku dari katalog di sebelah kiri untuk mengajukan permintaan.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 divide-y divide-suka-brown/5">
                {finalCart.map(item => (
                  <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-suka-brown truncate">{item.nama}</p>
                      <p className="text-[10px] text-suka-brown/50">
                        {item.qty} {item.dist_satuan}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateManualBahan(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-suka-cream text-suka-brown hover:bg-red-100 hover:text-red-600 font-bold transition-colors cursor-pointer text-xs"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-suka-brown">{item.qty}</span>
                      <button
                        onClick={() => updateManualBahan(item.id, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-suka-cream text-suka-brown hover:bg-suka-orange hover:text-white font-bold transition-colors cursor-pointer text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-3 border-t border-suka-brown/10 space-y-2">
              {cartEstimate.totalNilai > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-suka-brown/60">Estimasi Nilai:</span>
                  <span className="font-extrabold text-suka-brown">{formatRp(cartEstimate.totalNilai)}</span>
                </div>
              )}

              <button
                disabled={busy || finalCart.length === 0}
                onClick={handleInitiateSubmit}
                className="w-full bg-suka-orange hover:bg-orange-600 text-white font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-2xs active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{busy ? 'Mengirim...' : `Kirim Permintaan (${cartItemCount})`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mobile Cart Bar (< lg) - Positioned ABOVE BottomNav */}
      {cartItemCount > 0 && (
        <div className="lg:hidden fixed bottom-20 left-3 right-3 sm:left-6 sm:right-6 z-40 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <button
            onClick={() => setIsCartView(true)}
            className="w-full bg-suka-brown/95 backdrop-blur-md text-white shadow-2xl rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/10 hover:bg-suka-ink transition-all group cursor-pointer ring-4 ring-black/5 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="bg-suka-orange w-10 h-10 rounded-xl flex items-center justify-center font-bold relative text-white shadow-2xs shrink-0">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-suka-brown font-black shadow-xs">
                  {cartItemCount}
                </span>
              </div>
              <div className="text-left min-w-0">
                <p className="text-[10px] text-suka-cream uppercase font-bold tracking-widest leading-none">
                  {cartItemCount} Bahan di Keranjang
                </p>
                <p className="font-extrabold text-sm text-white truncate mt-0.5">
                  {cartEstimate.totalNilai > 0 ? `Est. ${formatRp(cartEstimate.totalNilai)}` : 'Tinjau & Kirim'}
                </p>
              </div>
            </div>
            <div className="bg-white/15 px-3 py-1.5 rounded-xl group-hover:bg-white/25 transition-colors flex items-center gap-1 shrink-0">
              <span className="text-xs font-black">Tinjau</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}

      {/* Batch Nudge Modal (Desktop Context) */}
      {showBatchNudge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-suka-brown/10">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-suka-brown text-base">Masih ada permintaan yang menunggu</h3>
              <p className="text-xs text-suka-brown/70 leading-relaxed mt-1">
                Anda memiliki <strong className="text-suka-brown font-extrabold">{pendingItemIds.size} item bahan baku</strong> lain
                yang masih menunggu persetujuan admin kitchen. Mau gabungkan dengan bahan lain dulu atau kirim sekarang?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowBatchNudge(false)
                  setIsCartView(false)
                }}
                className="flex-1 border border-suka-brown/20 text-suka-brown font-bold text-xs py-3 rounded-xl hover:bg-suka-cream/50 transition-colors cursor-pointer"
              >
                Tambah Dulu
              </button>
              <button
                onClick={() => {
                  setShowBatchNudge(false)
                  setShowConfirmModal(true)
                }}
                className="flex-1 bg-suka-orange hover:bg-orange-600 text-white font-bold text-xs py-3 rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                Kirim Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Guard Modal (Desktop Context) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-suka-brown/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-suka-orange/10 text-suka-orange flex items-center justify-center shrink-0">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-suka-brown text-base">Kirim Permintaan Bahan?</h3>
                <p className="text-xs text-suka-brown/60">
                  Total <strong className="text-suka-brown font-black">{finalCart.length} item</strong> bahan baku akan diajukan ke Kitchen / Gudang.
                </p>
              </div>
            </div>

            {/* Item summary box */}
            <div className="bg-suka-cream/30 rounded-2xl p-3 border border-suka-brown/10 max-h-48 overflow-y-auto space-y-1.5 divide-y divide-suka-brown/5 text-xs">
              {finalCart.map(item => (
                <div key={item.id} className="pt-1.5 first:pt-0 flex items-center justify-between">
                  <span className="font-bold text-suka-brown truncate pr-2">{item.nama}</span>
                  <span className="font-extrabold text-suka-brown whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-suka-brown/10">
                    {item.qty} {item.dist_satuan}
                  </span>
                </div>
              ))}
            </div>

            {cartEstimate.totalNilai > 0 && (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-suka-brown/60">Estimasi Nilai:</span>
                <span className="font-black text-suka-brown">{formatRp(cartEstimate.totalNilai)}</span>
              </div>
            )}

            {errorMsg && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 border border-suka-brown/20 text-suka-brown font-bold text-xs py-3 rounded-xl hover:bg-suka-cream/50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="flex-1 bg-suka-orange hover:bg-orange-600 text-white font-extrabold text-xs py-3 rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{busy ? 'Mengirim...' : 'Ya, Kirim Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

