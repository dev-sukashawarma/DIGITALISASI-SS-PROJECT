'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, X, Sparkles, LayoutGrid, SearchX } from 'lucide-react'
import AppTile from './AppTile'

export interface PortalAppItem {
  id: string
  label: string
  url: string
  desc: string
  category?: string
  badge?: string
  group?: string
}

interface AppGridProps {
  apps: PortalAppItem[]
}

export default function AppGrid({ apps }: AppGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('Semua')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut: Pressing "/" or "Ctrl+K" focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Calculate unique category groups with app counts
  const groups = useMemo(() => {
    const map = new Map<string, number>()
    apps.forEach(app => {
      const g = app.group || 'Lainnya'
      map.set(g, (map.get(g) || 0) + 1)
    })
    
    // Ordered categories
    const orderedKeys = ['Operasional', 'Keuangan & Data', 'Manajemen & SDM', 'Pemasaran & Ulasan']
    const result: { name: string; count: number }[] = [
      { name: 'Semua', count: apps.length }
    ]

    orderedKeys.forEach(k => {
      if (map.has(k)) {
        result.push({ name: k, count: map.get(k)! })
        map.delete(k)
      }
    })

    // Any remaining custom groups
    map.forEach((count, name) => {
      result.push({ name, count })
    })

    return result
  }, [apps])

  // Filter apps alphabetically while respecting search and category
  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return apps.filter(app => {
      const matchesGroup = selectedGroup === 'Semua' || app.group === selectedGroup
      if (!matchesGroup) return false

      if (!query) return true

      const labelMatch = app.label.toLowerCase().includes(query)
      const descMatch = app.desc.toLowerCase().includes(query)
      const categoryMatch = app.category?.toLowerCase().includes(query)
      const groupMatch = app.group?.toLowerCase().includes(query)

      return labelMatch || descMatch || categoryMatch || groupMatch
    })
  }, [apps, selectedGroup, searchQuery])

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedGroup('Semua')
    searchInputRef.current?.focus()
  }

  return (
    <section className="space-y-4">
      {/* Header bar with title, search input, and count indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-suka-orange/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-suka-orange/15 text-suka-orange">
            <LayoutGrid size={14} strokeWidth={2.5} />
          </div>
          <h2 className="text-xs font-black uppercase tracking-widest text-suka-orange">
            Aplikasi Anda
          </h2>
          <span className="ml-1 rounded-full bg-suka-brown/10 px-2 py-0.5 text-[10px] font-black text-suka-brown/70 tabular-nums">
            {filteredApps.length === apps.length
              ? `${apps.length} modul`
              : `${filteredApps.length} dari ${apps.length} modul`}
          </span>
        </div>

        {/* Real-time search bar */}
        <div className="relative w-full sm:w-72">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-suka-brown/40">
            <Search size={14} strokeWidth={2.5} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari modul (tekan /)..."
            className="w-full rounded-full border border-suka-brown/15 bg-white/80 py-1.5 pl-8 pr-8 text-xs font-semibold text-suka-ink placeholder:text-suka-brown/40 backdrop-blur-md transition-all focus:border-suka-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-suka-orange/20 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Hapus pencarian"
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-suka-brown/40 hover:text-suka-ink cursor-pointer"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills (displayed when multiple categories exist) */}
      {groups.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {groups.map(group => {
            const isSelected = selectedGroup === group.name
            return (
              <button
                key={group.name}
                type="button"
                onClick={() => setSelectedGroup(group.name)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-suka-ink text-white shadow-xs'
                    : 'bg-white/70 text-suka-brown/70 hover:bg-white hover:text-suka-ink border border-suka-brown/10'
                }`}
              >
                <span>{group.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-extrabold tabular-nums ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-suka-brown/10 text-suka-brown/60'
                  }`}
                >
                  {group.count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Grid of Alphabetically Sorted App Tiles */}
      {filteredApps.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredApps.map(app => (
            <AppTile
              key={app.id}
              id={app.id}
              label={app.label}
              url={app.url}
              desc={app.desc}
              category={app.category}
              badge={app.badge}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-suka-brown/20 bg-white/50 backdrop-blur-md p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-suka-brown/10 text-suka-brown/60">
            <SearchX size={24} />
          </div>
          <h3 className="mt-3 text-sm font-bold text-suka-ink">
            Tidak ada modul yang cocok
          </h3>
          <p className="mt-1 max-w-sm text-xs text-suka-gray-500">
            Tidak ditemukan modul dengan kata kunci &ldquo;{searchQuery}&rdquo;
            {selectedGroup !== 'Semua' && ` di kategori ${selectedGroup}`}.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-suka-orange/15 border border-suka-orange/30 px-4 py-1.5 text-xs font-bold text-suka-brown hover:bg-suka-orange/25 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles size={12} />
            <span>Reset Pencarian</span>
          </button>
        </div>
      )}
    </section>
  )
}
