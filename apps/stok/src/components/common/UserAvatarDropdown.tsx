'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '@suka/auth'
import { Store, LogOut, RefreshCw, Shield, ChevronDown } from 'lucide-react'

interface UserAvatarDropdownProps {
  className?: string
  showName?: boolean
}

export function UserAvatarDropdown({ className = '', showName = false }: UserAvatarDropdownProps) {
  const { outletStaff, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  const handleLogout = async () => {
    setIsOpen(false)
    await signOut()
    window.location.href = resolvedPortalUrl
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'kitchen': return 'Central Kitchen'
      case 'spv': return 'Supervisor'
      case 'admin': return 'Admin Pusat'
      case 'owner': return 'Owner'
      case 'area_manager':
      case 'leader': return 'Area Leader'
      case 'mitra': return 'Mitra'
      case 'admin_finance': return 'Finance'
      default: return 'Outlet Staff'
    }
  }

  const initials = outletStaff?.name
    ? outletStaff.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-2xl hover:bg-suka-cream/50 transition-all cursor-pointer active:scale-95 border border-transparent hover:border-suka-brown/10"
        aria-label="Menu Pengguna"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-suka-orange to-orange-500 text-white font-black text-xs flex items-center justify-center shadow-2xs">
          {initials}
        </div>
        {showName && outletStaff && (
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-black text-suka-brown truncate max-w-[120px] leading-tight">
              {outletStaff.name}
            </span>
            <span className="text-[9px] font-bold text-suka-orange uppercase tracking-wider">
              {getRoleLabel(outletStaff.role)}
            </span>
          </div>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-suka-brown/50" />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-3xl shadow-xl border border-suka-brown/10 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* User Info Header */}
          <div className="p-3 bg-suka-cream/40 rounded-2xl border border-suka-brown/10 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-suka-orange text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-suka-brown truncate leading-tight">
                  {outletStaff?.name || 'Pengguna'}
                </div>
                <div className="text-[10px] font-bold text-suka-brown/60 truncate mt-0.5 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-suka-orange" />
                  <span>{getRoleLabel(outletStaff?.role)}</span>
                </div>
              </div>
            </div>
            {outletStaff?.outlets?.name && (
              <div className="mt-2 pt-2 border-t border-suka-brown/10 text-[10px] font-extrabold text-suka-orange truncate uppercase tracking-wider">
                📍 {outletStaff.outlets.name}
              </div>
            )}
          </div>

          {/* Menu Actions */}
          <div className="space-y-1">
            <a
              href={resolvedPortalUrl}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-suka-brown hover:bg-suka-cream/60 transition-colors"
            >
              <Store className="w-4 h-4 text-suka-orange" />
              <span>Portal Aplikasi Utama</span>
            </a>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                window.location.reload()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-suka-brown hover:bg-suka-cream/60 transition-colors cursor-pointer text-left"
            >
              <RefreshCw className="w-4 h-4 text-suka-brown/60" />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>

          {/* Logout Action */}
          <div className="mt-1 pt-1 border-t border-suka-brown/10">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
            >
              <LogOut className="w-4 h-4 text-red-600" />
              <span>Keluar (Logout)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
