'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, TrendingUp } from 'lucide-react'
import HppDashboardView from './HppDashboardView'

interface ResepTabViewProps {
  menuWithBOM: any[]
  hppItems: any[]
  channels: { id: string; name: string; color?: string }[]
}

export default function ResepTabView({ menuWithBOM, hppItems, channels }: ResepTabViewProps) {
  const [activeTab, setActiveTab] = useState<'bom' | 'dashboard'>('bom')

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown">Resep & HPP</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kelola Bill of Materials dan pantau Harga Pokok Penjualan semua menu.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 bg-white/60 backdrop-blur-xl p-1.5 rounded-2xl w-fit shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <button
          onClick={() => setActiveTab('bom')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeTab === 'bom'
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'
              : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Resep BOM
        </button>
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
      </div>

      {/* Tab Content: Resep BOM */}
      {activeTab === 'bom' && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
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
                {menuWithBOM.map((menu: any) => (
                  <tr key={menu.id} className="group hover:bg-white/80 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5 hover:scale-[1.005] transition-all duration-300 relative z-10 hover:z-20 border-b border-gray-50">
                    <td className="px-6 py-4 text-gray-500 uppercase text-xs tracking-wider font-semibold">
                      {menu.category}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {menu.name}
                    </td>
                    <td className="px-6 py-4">
                      {menu.hasBOM ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Aktif ({menu.itemCount} bahan)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Belum Diatur
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/resep/${menu.id}`}
                        className="text-suka-primary hover:text-suka-primary/80 font-medium"
                      >
                        {menu.isPackage ? 'Lihat Resep' : (menu.hasBOM ? 'Edit Resep' : 'Buat Resep')}
                      </Link>
                    </td>
                  </tr>
                ))}
                {menuWithBOM.length === 0 && (
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
      )}

      {/* Tab Content: Dashboard HPP & Outlet */}
      {activeTab === 'dashboard' && (
        <HppDashboardView items={hppItems} channels={channels} />
      )}
    </div>
  )
}
