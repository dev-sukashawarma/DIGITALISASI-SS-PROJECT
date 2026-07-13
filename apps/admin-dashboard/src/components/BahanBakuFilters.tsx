'use client'

import { Search } from 'lucide-react'

import type { SortOption } from '@/lib/bahanBaku'

export function BahanBakuFilters({
  search, onSearch, sortBy, onSortBy
}: {
  search: string
  onSearch: (v: string) => void
  sortBy: SortOption
  onSortBy: (v: SortOption) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <Search size={16} />
        </div>
        <input 
          className="rounded-xl border border-suka-gray-200 bg-gray-50/50 pl-9 pr-3 py-2 text-sm outline-none focus:border-suka-orange focus:bg-white transition-colors w-64" 
          placeholder="Cari nama bahan baku..."
          value={search} 
          onChange={(e) => onSearch(e.target.value)} 
        />
      </div>
      <div className="relative">
        <select 
          value={sortBy}
          onChange={(e) => onSortBy(e.target.value as SortOption)}
          className="appearance-none rounded-xl border border-suka-gray-200 bg-gray-50/50 px-4 py-2 pr-8 text-sm outline-none focus:border-suka-orange focus:bg-white transition-colors cursor-pointer text-suka-ink font-medium"
        >
          <option value="nama-asc">Nama (A-Z)</option>
          <option value="nama-desc">Nama (Z-A)</option>
          <option value="kategori-asc">Kategori (A-Z)</option>
          <option value="kategori-desc">Kategori (Z-A)</option>
          <option value="harga-asc">Harga (Terendah)</option>
          <option value="harga-desc">Harga (Tertinggi)</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  )
}
