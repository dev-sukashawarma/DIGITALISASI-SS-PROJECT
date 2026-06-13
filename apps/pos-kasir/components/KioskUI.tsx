'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ShoppingCart, Sandwich, SearchX, ChevronRight, Flame } from 'lucide-react'
import MenuItem from '@/components/MenuItem'
import CategoryFilter from '@/components/CategoryFilter'
import Cart from '@/components/Cart'
import { useCart } from '@/store/cart'
import { formatRupiah } from '@/lib/validations'
import AttractScreen from '@/components/AttractScreen'
import type { MenuItem as MenuItemType, Category } from '@/types'
import { useBrand } from '@/components/BrandContext'

interface Props {
  menuItems: MenuItemType[]
  categories: Category[]
  bestsellerIds: string[]
  coverUrl: string | null
  outletName: string
  isIdle: boolean
  setIsIdle: (val: boolean) => void
}

export default function KioskUI({ menuItems, categories, bestsellerIds, coverUrl, outletName, isIdle, setIsIdle }: Props) {
  const pathname = usePathname()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const { totalItems, totalPrice, isOpen, toggleCart, clearCart, closeCart } = useCart()
  const [deviceLabel, setDeviceLabel] = useState<string>('')
  const { brandName, brandLogo } = useBrand()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const label = window.localStorage.getItem('kiosk_device_label')
      if (label) setDeviceLabel(label)
    }
  }, [])

  // Reset idle countdown when user returns to menu page (from detail/checkout)
  useEffect(() => {
    if (pathname === '/') setIsIdle(false)
  }, [pathname, setIsIdle])

  useEffect(() => {
    if (isIdle) return

    const IDLE_MS = 15_000
    let timer: ReturnType<typeof setTimeout>

    function resetTimer() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        clearCart()
        closeCart()
        setIsIdle(true)
      }, IDLE_MS)
    }

    const events = ['click', 'touchstart', 'mousemove', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
  }, [isIdle, clearCart, closeCart, setIsIdle])

  const filtered =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((m) => m.category_id === selectedCategory)

  const count = totalItems()
  const total = totalPrice()

  return (
    <div className="min-h-screen bg-[#FFFBF5]">

      {/* ── Header ──────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 min-w-0 pr-4">
            {brandLogo ? (
              <img src={brandLogo} alt="Logo" className="w-10 h-10 object-cover rounded-xl shrink-0 shadow-sm" />
            ) : (
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shrink-0">
                <Sandwich className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-lg tracking-tight leading-none truncate">
                {brandName}
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-gray-400 text-[10px] font-semibold tracking-[.2em] uppercase leading-none">
                  Kiosk {deviceLabel && <span className="font-bold text-gray-500">[{deviceLabel}]</span>}
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                <span className="text-amber-500 text-[10px] font-bold uppercase leading-none">
                  {outletName}
                </span>
              </div>
            </div>
          </div>

          {/* Cart button (Mobile Only) */}
          {count > 0 ? (
            <button
              onClick={toggleCart}
              className="lg:hidden flex items-center gap-3 bg-white hover:bg-gray-50
                border border-gray-200 shadow-sm
                text-gray-900 font-semibold px-4 py-2.5 rounded-2xl
                transition-all duration-200 hover:scale-[1.02]"
            >
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-gray-600" />
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-amber-500 text-white
                  text-[9px] font-extrabold rounded-full flex items-center justify-center">
                  {count}
                </span>
              </div>
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-gray-500 text-[10px] font-bold">{count} item</span>
                <span className="text-sm font-black text-amber-600">{formatRupiah(total)}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 hidden sm:block" />
            </button>
          ) : (
            <div className="lg:hidden flex items-center gap-2 text-gray-400 text-sm font-semibold">
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline">Keranjang kosong</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto flex">

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 space-y-6">

          {/* Category filter */}
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onChange={setSelectedCategory}
          />

          {/* Menu layout */}
          {selectedCategory !== 'all' ? (
            // Flat grid for specific category
            filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <SearchX className="w-7 h-7 text-gray-300" strokeWidth={1.5} />
                </div>
                <p className="font-semibold text-gray-500">Tidak ada menu di kategori ini</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map((item, i) => (
                  <div
                    key={item.id}
                    className="animate-fade-up"
                    style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                  >
                    <MenuItem item={item} />
                  </div>
                ))}
              </div>
            )
          ) : (
            // Grouped layout for 'Semua Menu'
            <div className="space-y-10">
              
              {/* Best Sellers Section */}
              {menuItems.filter(m => bestsellerIds.includes(m.id)).length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-5 h-5 text-amber-500" strokeWidth={2.5} />
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Best Seller</h2>
                    <span className="text-sm text-gray-400 hidden sm:inline">· Pilihan favorit pelanggan</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {menuItems.filter(m => bestsellerIds.includes(m.id)).map((item, i) => (
                      <div
                        key={item.id}
                        className="animate-fade-up"
                        style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                      >
                        <MenuItem item={item} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories Section */}
              {categories.map(category => {
                const catItems = menuItems.filter(m => m.category_id === category.id);
                if (catItems.length === 0) return null;
                
                return (
                  <div key={category.id} className="space-y-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-1 h-6 bg-amber-400 rounded-full"></div>
                      <h2 className="text-xl font-bold text-gray-900 tracking-tight capitalize">{category.name}</h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {catItems.map((item, i) => (
                        <div
                          key={item.id}
                          className="animate-fade-up"
                          style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                        >
                          <MenuItem item={item} />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

        {/* Cart — desktop sidebar */}
        <aside className="hidden lg:flex w-[340px] xl:w-[380px] flex-shrink-0 bg-gray-50 border-l border-gray-200 min-h-[calc(100vh-73px)]">
          <div className="w-full sticky top-[73px] h-[calc(100vh-73px)] flex flex-col">
            <Cart />
          </div>
        </aside>
      </div>

      {/* ── Mobile cart overlay ──────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex items-center justify-center p-4 sm:p-6" onClick={toggleCart}>
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in" />
          <div
            className="relative w-full max-w-[380px] bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <Cart />
          </div>
        </div>
      )}

      {/* ── Mobile cart bottom bar ───────────────── */}
      {count > 0 && !isOpen && (
        <div className="fixed bottom-4 left-4 right-4 lg:hidden z-30">
          <button
            onClick={toggleCart}
            className="w-full bg-amber-500 text-white rounded-2xl px-5 py-4
              flex items-center shadow-lg shadow-amber-500/25
              hover:bg-amber-600 active:scale-[.98] transition-all"
          >
            <div className="relative mr-3">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 w-4 h-4 bg-white text-amber-600
                text-[9px] font-bold rounded-full flex items-center justify-center">
                {count}
              </span>
            </div>
            <span className="font-semibold flex-1 text-left">Lihat Pesanan</span>
            <span className="font-bold">{formatRupiah(total)}</span>
            <ChevronRight className="w-4 h-4 text-white/70 ml-2" />
          </button>
        </div>
      )}

      {/* Bottom padding on mobile so content isn't hidden behind bar */}
      {count > 0 && <div className="h-24 lg:hidden" />}

      {isIdle && (
        <AttractScreen
          onStart={() => setIsIdle(false)}
          coverUrl={coverUrl}
        />
      )}
    </div>
  )
}
