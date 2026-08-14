'use client'

import React, { useEffect, useState } from 'react'
// @ts-ignore
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { NAV_GROUPS } from './navConfig'
import { useRole } from './RoleContext'

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { role } = useRole()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div 
        className="absolute inset-0 bg-suka-brown/20 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => setOpen(false)}
      />

      <div className="relative w-full max-w-lg overflow-hidden bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_rgb(0,0,0,0.1)] border border-white/60 animate-in zoom-in-95 duration-200">
        <Command
          className="w-full flex flex-col bg-transparent"
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <div className="flex items-center border-b border-gray-100/50 px-4">
            <Search className="w-5 h-5 text-gray-400 shrink-0" />
            <Command.Input 
              autoFocus
              className="flex-1 bg-transparent px-4 py-5 text-sm font-medium text-suka-ink placeholder-gray-400 focus:outline-none"
              placeholder="Ketik perintah atau cari halaman..." 
            />
            <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-hide">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              Tidak ada hasil yang cocok.
            </Command.Empty>

            {NAV_GROUPS.map((group) => {
              if (!group.roles.includes(role)) return null
              return (
                <Command.Group 
                  key={group.title} 
                  heading={group.title}
                  className="px-2 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider"
                >
                  <div className="mt-2 space-y-1">
                    {group.items.map((item) => {
                      if (!item.roles.includes(role)) return null
                      const Icon = item.icon
                      return (
                        <Command.Item
                          key={item.href}
                          onSelect={() => {
                            router.push(item.href)
                            setOpen(false)
                          }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-semibold text-gray-600 aria-selected:bg-suka-orange/10 aria-selected:text-suka-orange transition-colors"
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </Command.Item>
                      )
                    })}
                  </div>
                </Command.Group>
              )
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
