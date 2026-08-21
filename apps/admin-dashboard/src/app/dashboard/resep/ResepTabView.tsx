'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { BookOpen, TrendingUp, Search, X, Layers } from 'lucide-react'
import HppDashboardView from './HppDashboardView'
import { CATEGORY_GROUPS } from './categoryHelper'

interface ResepTabViewProps {
  menuWithBOM: any[]
  hppItems: any[]
  channels: { id: string; name: string; color?: string }[]
}

export default function ResepTabView({ menuWithBOM, hppItems, channels }: ResepTabViewProps) {
  const [activeTab, setActiveTab] = useState<'bom' | 'dashboard'>('dashboard')
  const [bomSearch, setBomSearch] = useState('')
  const [bomCategory, setBomCategory] = useState('all')

  const bomCategoryCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    menuWithBOM.forEach(i => {
      const catId = i.categoryId || 'other'
      map[catId] = (map[catId] || 0) + 1
    })
    return map
  }, [menuWithBOM])

  const filteredBOM = useMemo(() => {
    let res = menuWithBOM
    if (bomCategory !== 'all') {
      res = res.filter(r => r.categoryId === bomCategory)
    }
    if (bomSearch.trim()) {
      const q = bomSearch.toLowerCase().trim()
      res = res.filter(r => r.name.toLowerCase().includes(q) || (r.categoryFullName && r.categoryFullName.toLowerCase().includes(q)))
    }
    return res
  }, [menuWithBOM, bomCategory, bomSearch])

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown">Resep & HPP</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kelola Bill of Materials dan pantau Harga Pokok Penjualan semua menu per kategori.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 bg-white/60 backdrop-blur-xl p-1.5 rounded-2xl w-fit shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeTab === 'dashboard'
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'
              : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Analisis HPP & Distribusi
        </button>
        <button
          onClick={() => setActiveTab('bom')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeTab === 'bom'
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'
              : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Resep BOM ({menuWithBOM.length})
        </button>
      </div>

      {/* Tab Content: Resep BOM */}
      {activeTab === 'bom' && (
        <div className="space-y-4">
          {/* Category Pills for BOM Tab */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
            <button
              onClick={() => setBomCategory('all')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 border shadow-sm ${
                bomCategory === 'all'
                  ? 'bg-suka-primary text-white border-suka-primary shadow-amber-500/20'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Semua</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                bomCategory === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {menuWithBOM.length}
              </span>
            </button>

            {CATEGORY_GROUPS.map((cat) => {
              const count = bomCategoryCountMap[cat.id] || 0
              const isSelected = bomCategory === cat.id
              const isTikTok = cat.id === 'tiktok'

              return (
                <button
                  key={cat.id}
                  onClick={() => setBomCategory(cat.id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 border shadow-sm ${
                    isSelected
                      ? isTikTok
                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white border-transparent shadow-rose-500/30'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-amber-500/30'
                      : isTikTok
                        ? 'bg-rose-50/70 text-rose-700 border-rose-200 hover:bg-rose-100/80'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span>{cat.shortName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : isTikTok
                          ? 'bg-rose-200/60 text-rose-800'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search bar for BOM */}
          <div className="flex items-center justify-between gap-4 bg-white/60 backdrop-blur-xl p-3 border rounded-2xl shadow-sm">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </span>
              <input
                type="text"
                placeholder="Cari resep menu..."
                value={bomSearch}
                onChange={(e) => setBomSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-suka-primary/20 focus:border-suka-primary placeholder-gray-400 bg-white"
              />
              {bomSearch && (
                <button onClick={() => setBomSearch('')} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xs font-bold text-gray-500">
              Menampilkan: <span className="text-gray-900">{filteredBOM.length} Menu</span>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-500 text-[11px] uppercase tracking-wider font-extrabold">
                  <tr>
                    <th className="px-6 py-4">Kategori</th>
                    <th className="px-6 py-4">Nama Menu</th>
                    <th className="px-6 py-4">Status BOM</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBOM.map((menu: any, idx: number) => {
                    const prevRow = idx > 0 ? filteredBOM[idx - 1] : null
                    const isFirstOfCategory = !prevRow || prevRow.categoryId !== menu.categoryId
                    const showCategoryHeader = isFirstOfCategory && bomCategory === 'all' && !bomSearch.trim()
                    const isTikTok = menu.categoryId === 'tiktok'

                    return (
                      <React.Fragment key={menu.id}>
                        {showCategoryHeader && (
                          <tr className={`${isTikTok ? 'bg-gradient-to-r from-pink-50/80 via-rose-50/40 to-transparent border-t-2 border-b border-rose-200' : 'bg-gradient-to-r from-amber-50/80 via-orange-50/30 to-transparent border-t-2 border-b border-amber-200/60'}`}>
                            <td colSpan={4} className="px-6 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{menu.categoryIcon}</span>
                                <span className="font-black text-xs text-gray-900 tracking-wider uppercase">
                                  {menu.categoryFullName || menu.category}
                                </span>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${menu.categoryBadgeBg || 'bg-gray-100 text-gray-700'}`}>
                                  {bomCategoryCountMap[menu.categoryId] || 0} Menu
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr className="group hover:bg-white/80 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5 hover:scale-[1.005] transition-all duration-300 relative z-10 hover:z-20 border-b border-gray-50">
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${menu.categoryBadgeBg || 'bg-gray-100 text-gray-700'}`}>
                              <span>{menu.categoryIcon}</span>
                              <span>{menu.category}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900">
                            {menu.name}
                            {menu.isPackage && (
                              <span className="ml-2 text-[10px] font-black uppercase text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                                Paket
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {menu.hasBOM ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                Aktif ({menu.itemCount} bahan)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                Belum Diatur
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/dashboard/resep/${menu.id}`}
                              className="inline-flex items-center px-3 py-1.5 bg-suka-primary/10 hover:bg-suka-primary/20 text-suka-primary rounded-xl text-xs font-bold transition-colors"
                            >
                              {menu.isPackage ? 'Lihat Resep' : (menu.hasBOM ? 'Edit Resep' : 'Buat Resep')}
                            </Link>
                          </td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
                  {filteredBOM.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        Tidak ada menu ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Dashboard HPP & Outlet */}
      {activeTab === 'dashboard' && (
        <HppDashboardView items={hppItems} channels={channels} />
      )}
    </div>
  )
}
