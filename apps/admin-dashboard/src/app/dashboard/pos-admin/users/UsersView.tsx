'use client'

import { useState, useRef, useEffect, useMemo, useCallback, useDeferredValue, memo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Users, Plus, X, Loader2, Store, Search, ChevronDown, Check, Eye, EyeOff, Lock, User,
  Pencil, Trash2, MonitorSmartphone, ShieldCheck, Filter, RotateCcw,
} from 'lucide-react'
import type { Outlet } from '@/pos-types'
import { useDialogStore } from '@/lib/dialogStore'
import { CheckMark, Switch } from '@/components/ui/controls'
import { toast } from 'sonner'

interface UserProfile {
  id: string
  role: string
  name: string
  username: string
  outlet_id: string | null
  outlets?: { name: string }
  staff_outlets?: { outlet_id: string }[]
  is_active?: boolean
  inactive_reason?: string | null
}

interface UsersViewProps {
  initialUsers: UserProfile[]
  initialOutlets: Outlet[]
}

type StatusFilter = 'all' | 'active' | 'inactive'

interface UserIndex {
  /** Gabungan username, nama, outlet, peran (lowercase) untuk pencarian. */
  hay: string
  outlets: Set<string>
  extraNames: string[]
  active: boolean
}

const MULTI_OUTLET_ROLES = [
  'admin', 'owner', 'regional_manager', 'area_manager',
  'leader', 'admin_hr', 'admin_finance',
  'purchasing', 'mitra',
]

const ROLE_GROUPS: { title: string; roles: { value: string; label: string; hint: string }[] }[] = [
  {
    title: 'Outlet',
    roles: [
      { value: 'crew', label: 'Crew', hint: 'Kasir & operasional outlet' },
      { value: 'leader', label: 'Leader', hint: 'Membina beberapa outlet' },
      { value: 'kitchen', label: 'Kitchen', hint: 'Gudang pusat / dapur' },
    ],
  },
  {
    title: 'Manajemen',
    roles: [
      { value: 'area_manager', label: 'Area Manager', hint: 'Memantau satu area' },
      { value: 'regional_manager', label: 'Regional Manager', hint: 'Memantau satu regional' },
    ],
  },
  {
    title: 'Kantor pusat',
    roles: [
      { value: 'admin_hr', label: 'Admin HR', hint: 'Karyawan & absensi' },
      { value: 'admin_finance', label: 'Admin Finance', hint: 'Keuangan' },
      { value: 'purchasing', label: 'Purchasing', hint: 'Pembelian & PO' },
      { value: 'staff_pusat', label: 'Staff Pusat', hint: 'Staf kantor pusat' },
    ],
  },
  {
    title: 'Khusus',
    roles: [
      { value: 'mitra', label: 'Mitra', hint: 'Mitra / investor outlet' },
      { value: 'owner', label: 'Owner', hint: 'Akses penuh' },
      { value: 'admin', label: 'Admin', hint: 'Akses penuh & pengaturan' },
      { value: 'kiosk', label: 'Mesin Kiosk', hint: 'Akun perangkat kiosk' },
    ],
  },
]

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_GROUPS.flatMap(g => g.roles.map(r => [r.value, r.label])),
)

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function roleTone(role: string): string {
  if (role === 'admin' || role === 'owner') return 'bg-suka-brown/10 text-suka-brown ring-suka-brown/15'
  if (['leader', 'area_manager', 'regional_manager'].includes(role)) return 'bg-amber-50 text-amber-800 ring-amber-200'
  if (role === 'kiosk') return 'bg-sky-50 text-sky-800 ring-sky-200'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

const isAllAccess = (role: string) => role === 'admin' || role === 'owner'

function initials(u: UserProfile): string {
  const base = (u.name || u.username || '?').trim()
  const parts = base.split(/[\s_.-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/* ───────────────────────── Dropdown filter ───────────────────────── */

type FilterOption = { value: string; label: string; count: number }

function FilterDropdown({
  icon,
  allLabel,
  allCount,
  value,
  options,
  onChange,
  searchPlaceholder,
  label,
}: {
  icon: ReactNode
  allLabel: string
  allCount: number
  value: string
  options: FilterOption[]
  onChange: (v: string) => void
  searchPlaceholder?: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (v: string) => { onChange(v); setOpen(false); setQuery('') }
  const selected = options.find(o => o.value === value)
  const shown = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl border bg-white pl-3 pr-2.5 text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/30 ${
          selected ? 'border-suka-orange/60 text-suka-brown' : 'border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        <span className={selected ? 'text-suka-orange' : 'text-slate-400'}>{icon}</span>
        <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? allLabel}</span>
        {selected ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Hapus filter ${label}`}
            onClick={e => { e.stopPropagation(); pick('') }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pick('') } }}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-full min-w-[17rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_-12px_rgba(64,10,7,0.25)] sm:left-auto sm:right-0">
          {searchPlaceholder && (
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-suka-orange/20"
                />
              </div>
            </div>
          )}
          <div role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1.5">
            {query === '' && (
              <DropdownItem active={!value} label={allLabel} count={allCount} onClick={() => pick('')} bold />
            )}
            {shown.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm font-medium text-slate-500">Tidak ditemukan</p>
            ) : (
              shown.map(o => (
                <DropdownItem key={o.value} active={value === o.value} label={o.label} count={o.count} onClick={() => pick(o.value)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DropdownItem({ active, label, count, onClick, bold }: { active: boolean; label: string; count: number; onClick: () => void; bold?: boolean }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
        active ? 'bg-suka-orange/10 text-suka-brown' : 'text-slate-700 hover:bg-slate-50'
      } ${bold ? 'font-bold' : 'font-medium'}`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-white text-suka-brown' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
      <Check className={`h-4 w-4 shrink-0 ${active ? 'text-suka-orange' : 'text-transparent'}`} />
    </button>
  )
}

/* ───────────────────────── Halaman ───────────────────────── */

export default function UsersView({ initialUsers, initialOutlets }: UsersViewProps) {
  const router = useRouter()
  const { showConfirm } = useDialogStore()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'kiosk'>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterOutletId, setFilterOutletId] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Picker outlet di modal
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [dropdownSearch, setDropdownSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Form state
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<string>('crew')
  const [outletId, setOutletId] = useState('')
  const [outletIds, setOutletIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [inactiveReason, setInactiveReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isMultiOutletRole = MULTI_OUTLET_ROLES.includes(role)
  const outletName = useMemo(() => new Map(initialOutlets.map(o => [o.id, o.name])), [initialOutlets])

  // Indeks dibangun SEKALI per data (bukan per ketikan): teks cari lowercase,
  // himpunan outlet, dan nama outlet tambahan untuk kolom "+N".
  const index = useMemo(() => {
    const m = new Map<string, UserIndex>()
    for (const u of initialUsers) {
      const outlets = new Set<string>()
      if (u.outlet_id) outlets.add(u.outlet_id)
      for (const so of u.staff_outlets ?? []) outlets.add(so.outlet_id)
      const extraNames: string[] = []
      for (const id of outlets) {
        if (id === u.outlet_id) continue
        const n = outletName.get(id)
        if (n) extraNames.push(n)
      }
      m.set(u.id, {
        hay: [u.username, u.name, u.outlets?.name, roleLabel(u.role)].filter(Boolean).join('\n').toLowerCase(),
        outlets,
        extraNames,
        active: u.is_active !== false,
      })
    }
    return m
  }, [initialUsers, outletName])

  const tabUsers = useMemo(
    () => initialUsers.filter(u => (activeTab === 'kiosk' ? u.role === 'kiosk' : u.role !== 'kiosk')),
    [initialUsers, activeTab],
  )
  const kioskCount = useMemo(() => initialUsers.filter(u => u.role === 'kiosk').length, [initialUsers])

  // Hitungan per outlet / peran / aktif: satu lintasan, hanya saat tab/data berubah.
  const { activeCount, outletOptions, roleOptions } = useMemo(() => {
    const perOutlet = new Map<string, number>()
    const perRole = new Map<string, number>()
    let active = 0
    for (const u of tabUsers) {
      const info = index.get(u.id)!
      if (info.active) active++
      perRole.set(u.role, (perRole.get(u.role) ?? 0) + 1)
      for (const id of info.outlets) perOutlet.set(id, (perOutlet.get(id) ?? 0) + 1)
    }
    return {
      activeCount: active,
      outletOptions: initialOutlets.map(o => ({ value: o.id, label: o.name, count: perOutlet.get(o.id) ?? 0 })),
      roleOptions: [...perRole.entries()]
        .map(([value, count]) => ({ value, label: roleLabel(value), count }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }
  }, [tabUsers, index, initialOutlets])

  // Input cari tetap responsif; penyaringan daftar dikerjakan dengan prioritas
  // rendah dan bisa disela ketikan berikutnya.
  const deferredQuery = useDeferredValue(searchQuery)
  const q = deferredQuery.trim().toLowerCase()
  const isStale = deferredQuery !== searchQuery
  const filteredUsers = useMemo(
    () =>
      tabUsers.filter(u => {
        const info = index.get(u.id)!
        if (filterOutletId && !info.outlets.has(filterOutletId)) return false
        if (filterRole && u.role !== filterRole) return false
        if (statusFilter === 'active' && !info.active) return false
        if (statusFilter === 'inactive' && info.active) return false
        return !q || info.hay.includes(q)
      }),
    [tabUsers, index, filterOutletId, filterRole, statusFilter, q],
  )

  const hasFilter = !!(searchQuery.trim() || filterOutletId || filterRole || statusFilter !== 'all')
  const resetFilters = () => {
    setSearchQuery('')
    setFilterOutletId('')
    setFilterRole('')
    setStatusFilter('all')
  }

  const switchTab = (tab: 'users' | 'kiosk') => {
    setActiveTab(tab)
    setFilterRole('')
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openModal = useCallback((user?: UserProfile) => {
    if (user) {
      setEditingUser(user)
      setFullName(user.name || user.username)
      setUsername(user.username)
      setPassword('') // Password kosongkan saat edit
      setRole(user.role)
      setOutletId(user.outlet_id || '')
      setOutletIds(user.staff_outlets?.map(so => so.outlet_id) || (user.outlet_id ? [user.outlet_id] : []))
      setIsActive(user.is_active ?? true)
      setInactiveReason(user.inactive_reason || '')
    } else {
      setEditingUser(null)
      setFullName('')
      setUsername('')
      setPassword('')
      setRole(activeTab === 'kiosk' ? 'kiosk' : 'crew')
      // Bila sedang menyaring satu outlet, akun baru langsung diarahkan ke outlet itu.
      const preset = filterOutletId || initialOutlets[0]?.id || ''
      setOutletId(preset)
      setOutletIds(preset ? [preset] : [])
      setIsActive(true)
      setInactiveReason('')
    }
    setShowPassword(false)
    setDropdownSearch('')
    setIsDropdownOpen(false)
    setError('')
    setIsModalOpen(true)
  }, [activeTab, filterOutletId, initialOutlets])

  function chooseRole(next: string) {
    setRole(next)
    // Pindah ke role satu-outlet: sisakan outlet utama saja.
    if (!MULTI_OUTLET_ROLES.includes(next) && outletIds.length > 1 && outletId) {
      setOutletIds([outletId])
    }
  }

  function toggleOutlet(id: string) {
    if (isMultiOutletRole) {
      const isSelected = outletIds.includes(id)
      const next = isSelected ? outletIds.filter(x => x !== id) : [...outletIds, id]
      setOutletIds(next)
      if (next.length > 0 && !next.includes(outletId)) setOutletId(next[0])
      else if (next.length === 0) setOutletId('')
    } else {
      setOutletId(id)
      setOutletIds([id])
      setIsDropdownOpen(false)
      setDropdownSearch('')
    }
  }

  function toggleAllOutlets() {
    if (outletIds.length === initialOutlets.length) {
      setOutletIds([])
      setOutletId('')
    } else {
      const allIds = initialOutlets.map(o => o.id)
      setOutletIds(allIds)
      setOutletId(allIds[0] || '')
    }
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim(),
          username,
          password: password || undefined,
          role,
          outlet_id: outletId,
          outlet_ids: isMultiOutletRole ? outletIds : undefined,
          is_active: isActive,
          inactive_reason: !isActive ? inactiveReason : null,
        }),
      })

      // Respons bisa saja bukan JSON (mis. halaman error 500 dari Next) —
      // jangan sampai sebab aslinya hilang jadi "Gagal menghubungi server".
      const raw = await res.text()
      let data: { error?: string } = {}
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = { error: `Server membalas respons tidak valid (HTTP ${res.status})` }
      }

      if (!res.ok) {
        setError(data.error || `Terjadi kesalahan (HTTP ${res.status})`)
        toast.error(data.error || `Terjadi kesalahan (HTTP ${res.status})`)
      } else {
        toast.success(editingUser ? 'Pengguna berhasil diperbarui!' : 'Pengguna berhasil ditambahkan!')
        setIsModalOpen(false)
        setFullName('')
        setUsername('')
        setPassword('')
        router.refresh() // Refresh list via server components
      }
    } catch {
      setError('Gagal menghubungi server')
      toast.error('Gagal menghubungi server')
    }

    setIsSubmitting(false)
  }

  const handleDeleteUser = useCallback(async (u: UserProfile) => {
    const confirmed = await showConfirm(`Hapus akun "${u.username}"? Pengguna ini tidak bisa login lagi.`)
    if (!confirmed) return

    setDeletingId(u.id)
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error || 'Gagal menghapus pengguna')
      } else {
        toast.success('Pengguna berhasil dihapus!')
        router.refresh()
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setDeletingId(null)
    }
  }, [showConfirm, router])

  const outletSummary = isMultiOutletRole
    ? outletIds.length === initialOutlets.length && initialOutlets.length > 0
      ? 'Semua outlet'
      : outletIds.length > 0
        ? `${outletIds.length} outlet dipilih`
        : 'Pilih outlet…'
    : outletName.get(outletId) || 'Pilih outlet…'
  const pickerOutlets = initialOutlets.filter(o => o.name.toLowerCase().includes(dropdownSearch.toLowerCase()))

  return (
    <div className="mx-auto w-full max-w-6xl animate-fade-in space-y-6 pb-16">
      {/* ── Header ── */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-wide text-suka-brown sm:text-4xl">Pengguna POS</h1>
          <p className="mt-1 max-w-xl text-sm font-medium text-slate-500">
            Kelola akun login kasir, leader, staf pusat, dan mesin kiosk.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total', value: tabUsers.length, tone: 'bg-white text-suka-brown ring-1 ring-slate-200/70', filter: 'all' as const },
              { label: 'Aktif', value: activeCount, tone: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100', filter: 'active' as const },
              { label: 'Nonaktif', value: tabUsers.length - activeCount, tone: 'bg-rose-50 text-rose-800 ring-1 ring-rose-100', filter: 'inactive' as const },
            ].map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
                aria-pressed={statusFilter === s.filter && s.filter !== 'all'}
                title={`Tampilkan ${s.label.toLowerCase()}`}
                className={`min-w-[5.5rem] cursor-pointer rounded-2xl px-4 py-2.5 text-left transition-shadow duration-150 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40 ${s.tone} ${
                  statusFilter === s.filter && s.filter !== 'all' ? 'outline outline-2 outline-offset-2 outline-suka-orange' : ''
                }`}
              >
                <dt className="text-[11px] font-bold uppercase tracking-wide opacity-80">{s.label}</dt>
                <dd className="font-display text-2xl leading-none">{s.value}</dd>
              </button>
            ))}
          </dl>
          <button
            onClick={() => openModal()}
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-suka-brown px-5 text-sm font-bold text-white shadow-sm transition-colors duration-150 hover:bg-suka-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/50 active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            {activeTab === 'kiosk' ? 'Tambah Kiosk' : 'Tambah Akun'}
          </button>
        </div>
      </header>

      {/* ── Tab ── */}
      <div role="tablist" aria-label="Jenis akun" className="flex gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/70 sm:inline-flex">
        {([
          ['users', 'Pengguna', <Users key="i" className="h-4 w-4" />, initialUsers.length - kioskCount],
          ['kiosk', 'Mesin Kiosk', <MonitorSmartphone key="i" className="h-4 w-4" />, kioskCount],
        ] as const).map(([value, label, icon, count]) => {
          const active = activeTab === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(value)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors duration-150 sm:flex-none ${
                active ? 'bg-suka-brown text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {icon}
              {label}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Toolbar filter ── */}
      <div className="space-y-3">
        <div className={`grid gap-2.5 ${activeTab === 'users' ? 'sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]' : 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'}`}>
          <div className={`relative ${activeTab === 'users' ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Cari pengguna"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama, username, outlet…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15"
            />
          </div>
          <FilterDropdown
            label="Outlet"
            icon={<Store className="h-4 w-4" />}
            allLabel="Semua outlet"
            allCount={tabUsers.length}
            value={filterOutletId}
            options={outletOptions}
            onChange={setFilterOutletId}
            searchPlaceholder="Cari outlet…"
          />
          {activeTab === 'users' && (
            <FilterDropdown
              label="Peran"
              icon={<ShieldCheck className="h-4 w-4" />}
              allLabel="Semua peran"
              allCount={tabUsers.length}
              value={filterRole}
              options={roleOptions}
              onChange={setFilterRole}
            />
          )}
        </div>

        <div className="flex min-h-[28px] flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-sm font-medium text-slate-500" aria-live="polite">
            {hasFilter ? (
              <>Menampilkan <span className="font-bold text-slate-900">{filteredUsers.length}</span> dari {tabUsers.length} akun</>
            ) : (
              <><span className="font-bold text-slate-900">{tabUsers.length}</span> akun</>
            )}
          </p>
          {hasFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-suka-brown transition-colors hover:bg-suka-orange/10"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset filter
            </button>
          )}
        </div>
      </div>

      {/* ── Daftar ── */}
      {filteredUsers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            {hasFilter ? <Filter className="h-5 w-5 text-slate-400" /> : <Users className="h-5 w-5 text-slate-400" />}
          </div>
          <p className="text-sm font-bold text-slate-700">{hasFilter ? 'Tidak ada akun yang cocok' : 'Belum ada akun'}</p>
          <p className="mt-1 text-sm text-slate-500">
            {hasFilter ? 'Coba ubah kata kunci atau filter.' : 'Tambahkan akun pertama untuk mulai.'}
          </p>
          {hasFilter ? (
            <button type="button" onClick={resetFilters} className="mt-4 cursor-pointer text-sm font-bold text-suka-brown underline-offset-4 hover:underline">
              Reset filter
            </button>
          ) : (
            <button type="button" onClick={() => openModal()} className="mt-4 cursor-pointer text-sm font-bold text-suka-brown underline-offset-4 hover:underline">
              Tambah akun
            </button>
          )}
        </div>
      ) : (
        <UserList
          users={filteredUsers}
          index={index}
          deletingId={deletingId}
          stale={isStale}
          onEdit={openModal}
          onDelete={handleDeleteUser}
        />
      )}

      {/* ── Modal tambah / ubah ── */}
      {isModalOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-suka-ink/50 p-2 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget && !isSubmitting) setIsModalOpen(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            className="relative my-auto flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in sm:h-auto sm:max-h-[92vh] sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id="user-form-title" className="font-display text-2xl leading-tight tracking-wide text-suka-brown">
                  {editingUser ? 'Ubah akun' : 'Akun baru'}
                </h2>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                  {editingUser ? `@${editingUser.username}` : 'Isi data login & penempatan outlet'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <form id="user-form" onSubmit={handleSaveUser} className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              {error && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                  {error}
                </div>
              )}

              <FormSection title="Identitas">
                <Field id="user-fullname" label="Nama lengkap" icon={<User className="h-4 w-4" />}>
                  <input
                    id="user-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className={inputCls}
                    placeholder="Misal: Budi Santoso"
                    autoComplete="name"
                  />
                </Field>
                <Field id="user-username" label="Username login" icon={<User className="h-4 w-4" />}>
                  <input
                    id="user-username"
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className={inputCls}
                    placeholder={role === 'kiosk' ? 'Misal: kiosk_sudirman1' : 'Misal: budi_santoso'}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  id="user-password"
                  label="Password"
                  hint={editingUser ? 'Kosongkan bila tidak diubah' : 'Minimal 6 karakter'}
                  icon={<Lock className="h-4 w-4" />}
                  trailing={
                    <button
                      type="button"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      onClick={() => setShowPassword(s => !s)}
                      className="flex h-full cursor-pointer items-center px-3.5 text-slate-400 transition-colors hover:text-suka-brown"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                >
                  <input
                    id="user-password"
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={6}
                    className={`${inputCls} pr-11`}
                    placeholder={editingUser ? '••••••' : 'Minimal 6 karakter'}
                    autoComplete="new-password"
                  />
                </Field>
              </FormSection>

              <FormSection title="Peran">
                <div className="space-y-3">
                  {ROLE_GROUPS.map(g => (
                    <div key={g.title}>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.title}</p>
                      <div role="radiogroup" aria-label={`Peran ${g.title}`} className="grid grid-cols-2 gap-2">
                        {g.roles.map(r => {
                          const active = role === r.value
                          return (
                            <button
                              key={r.value}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => chooseRole(r.value)}
                              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40 ${
                                active ? 'border-suka-orange bg-suka-orange/5' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-suka-orange' : 'border-slate-300'}`}>
                                {active && <span className="h-2 w-2 rounded-full bg-suka-orange" />}
                              </span>
                              <span className="min-w-0">
                                <span className={`block truncate text-sm font-bold ${active ? 'text-suka-brown' : 'text-slate-800'}`}>{r.label}</span>
                                <span className="block truncate text-[11px] font-medium text-slate-500">{r.hint}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </FormSection>

              <FormSection title="Penempatan" hint={isMultiOutletRole ? 'Bisa pilih lebih dari satu outlet' : 'Satu outlet'}>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isDropdownOpen}
                    onClick={() => setIsDropdownOpen(o => !o)}
                    className={`flex h-12 w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-white px-3.5 text-left text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/30 ${
                      isDropdownOpen ? 'border-suka-orange' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Store className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className={`min-w-0 flex-1 truncate ${outletId || outletIds.length ? 'text-slate-900' : 'text-slate-400'}`}>{outletSummary}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_-12px_rgba(64,10,7,0.25)]">
                      <div className="border-b border-slate-100 p-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Cari outlet…"
                            value={dropdownSearch}
                            onChange={e => setDropdownSearch(e.target.value)}
                            className="w-full rounded-lg bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium outline-none focus:ring-2 focus:ring-suka-orange/20"
                          />
                        </div>
                      </div>
                      <div role="listbox" aria-multiselectable={isMultiOutletRole} className="max-h-60 overflow-y-auto p-1.5">
                        {isMultiOutletRole && dropdownSearch === '' && (
                          <button
                            type="button"
                            onClick={toggleAllOutlets}
                            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-slate-900 hover:bg-slate-50"
                          >
                            <CheckMark checked={outletIds.length === initialOutlets.length && initialOutlets.length > 0} />
                            Pilih semua outlet
                          </button>
                        )}
                        {pickerOutlets.length === 0 ? (
                          <p className="px-3 py-4 text-center text-sm font-medium text-slate-500">Outlet tidak ditemukan</p>
                        ) : (
                          pickerOutlets.map(o => {
                            const isSelected = isMultiOutletRole ? outletIds.includes(o.id) : outletId === o.id
                            return (
                              <button
                                key={o.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => toggleOutlet(o.id)}
                                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                                  isSelected && !isMultiOutletRole ? 'bg-suka-orange/10 text-suka-brown' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {isMultiOutletRole && <CheckMark checked={isSelected} />}
                                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                                {isSelected && !isMultiOutletRole && <Check className="h-4 w-4 shrink-0 text-suka-orange" />}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {isMultiOutletRole && outletIds.length > 0 && outletIds.length < initialOutlets.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {outletIds.map(id => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-xs font-semibold text-slate-700">
                        {outletName.get(id) ?? 'Outlet nonaktif'}
                        <button
                          type="button"
                          aria-label={`Lepas ${outletName.get(id) ?? 'outlet'}`}
                          onClick={() => toggleOutlet(id)}
                          className="cursor-pointer rounded-full p-0.5 text-slate-400 hover:bg-white hover:text-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </FormSection>

              {editingUser && (
                <FormSection title="Status">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{isActive ? 'Akun aktif' : 'Akun nonaktif'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{isActive ? 'Bisa dipakai untuk login' : 'Tidak bisa login sampai diaktifkan lagi'}</p>
                    </div>
                    <Switch checked={isActive} onChange={setIsActive} label="Status akun aktif" />
                  </div>
                  {!isActive && (
                    <div>
                      <label htmlFor="inactive-reason" className="mb-1.5 block text-sm font-bold text-slate-700">Alasan dinonaktifkan</label>
                      <textarea
                        id="inactive-reason"
                        required
                        value={inactiveReason}
                        onChange={e => setInactiveReason(e.target.value)}
                        rows={2}
                        placeholder="Contoh: resign, cuti panjang…"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                  )}
                </FormSection>
              )}
            </form>

            {/* Footer */}
            <div className="flex shrink-0 gap-2.5 border-t border-slate-100 bg-slate-50/80 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:py-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="min-h-12 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={isSubmitting || !outletId}
                className="flex min-h-12 flex-[2] cursor-pointer items-center justify-center gap-2 rounded-xl bg-suka-brown px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-suka-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : editingUser ? 'Simpan perubahan' : 'Buat akun'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ───────────────────────── Bagian kecil ───────────────────────── */

const inputCls =
  'h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15'

function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
        {hint && <span className="text-xs font-semibold text-suka-orange">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Field({ id, label, hint, icon, trailing, children }: { id: string; label: string; hint?: string; icon: ReactNode; trailing?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold text-slate-700">{label}</label>
        {hint && <span className="text-xs font-medium text-slate-400">{hint}</span>}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">{icon}</span>
        {children}
        {trailing && <span className="absolute inset-y-0 right-0 flex items-center">{trailing}</span>}
      </div>
    </div>
  )
}

function UserIdentity({ u }: { u: UserProfile }) {
  const active = u.is_active !== false
  const showName = !!u.name && u.name !== u.username
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
          active ? 'bg-suka-orange/15 text-suka-brown' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {u.role === 'kiosk' ? <MonitorSmartphone className="h-4 w-4" /> : initials(u)}
      </span>
      <div className="min-w-0">
        <p className={`truncate text-sm font-bold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{showName ? u.name : u.username || 'Tanpa username'}</p>
        <p className="truncate text-xs font-medium text-slate-500">@{u.username || '—'}</p>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${roleTone(role)}`}>
      {roleLabel(role)}
    </span>
  )
}

function OutletCell({ u, extraNames }: { u: UserProfile; extraNames: string[] }) {
  if (isAllAccess(u.role)) {
    return <span className="text-sm font-medium italic text-slate-400">Semua outlet</span>
  }
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm font-medium text-slate-700">
      <Store className="h-4 w-4 shrink-0 text-slate-400" />
      {u.outlets?.name ? (
        <span className="truncate">{u.outlets.name}</span>
      ) : (
        <span className="italic text-rose-500">Outlet tidak ditemukan</span>
      )}
      {extraNames.length > 0 && (
        <span title={extraNames.join(', ')} className="shrink-0 cursor-help rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
          +{extraNames.length}
        </span>
      )}
    </span>
  )
}

const ROW_GRID = 'md:grid md:grid-cols-[minmax(0,1.5fr)_8.5rem_minmax(0,1.4fr)_7rem_9rem] md:items-center md:gap-4'

// Satu markup responsif per pengguna (bukan tabel + kartu mobile yang dirender
// dua kali). Di-memo agar ketikan di kolom cari / form modal tidak merender
// ulang daftar yang tidak berubah.
const UserList = memo(function UserList({
  users,
  index,
  deletingId,
  stale,
  onEdit,
  onDelete,
}: {
  users: UserProfile[]
  index: Map<string, UserIndex>
  deletingId: string | null
  stale: boolean
  onEdit: (u: UserProfile) => void
  onDelete: (u: UserProfile) => void
}) {
  return (
    <section
      aria-label="Daftar akun"
      aria-busy={stale}
      className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 transition-opacity duration-150 ${stale ? 'opacity-70' : ''}`}
    >
      <div aria-hidden className={`hidden border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 ${ROW_GRID}`}>
        <span>Pengguna</span>
        <span>Peran</span>
        <span>Outlet</span>
        <span>Status</span>
        <span />
      </div>
      <ul className="divide-y divide-slate-100">
        {users.map(u => (
          <UserRow key={u.id} u={u} info={index.get(u.id)!} deleting={deletingId === u.id} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  )
})

const UserRow = memo(function UserRow({
  u,
  info,
  deleting,
  onEdit,
  onDelete,
}: {
  u: UserProfile
  info: UserIndex
  deleting: boolean
  onEdit: (u: UserProfile) => void
  onDelete: (u: UserProfile) => void
}) {
  return (
    <li
      className={`space-y-3 p-4 transition-colors duration-150 [contain-intrinsic-size:auto_76px] [content-visibility:auto] hover:bg-suka-cream md:space-y-0 md:px-6 md:py-3.5 ${ROW_GRID} ${
        info.active ? '' : 'bg-slate-50/40'
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <UserIdentity u={u} />
        <span className="md:hidden"><StatusBadge u={u} /></span>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:contents">
        <div><RoleBadge role={u.role} /></div>
        <div className="min-w-0"><OutletCell u={u} extraNames={info.extraNames} /></div>
      </div>
      <div className="hidden md:block"><StatusBadge u={u} /></div>
      <RowActions u={u} deleting={deleting} onEdit={onEdit} onDelete={onDelete} />
    </li>
  )
})

function StatusBadge({ u }: { u: UserProfile }) {
  const active = u.is_active !== false
  return (
    <span
      title={!active && u.inactive_reason ? `Alasan: ${u.inactive_reason}` : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  )
}

function RowActions({ u, deleting, onEdit, onDelete }: { u: UserProfile; deleting: boolean; onEdit: (u: UserProfile) => void; onDelete: (u: UserProfile) => void }) {
  if (u.role === 'admin') {
    return <p className="text-xs font-medium text-slate-400 md:text-right">Dikelola sistem</p>
  }
  const base = 'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40 disabled:cursor-wait disabled:opacity-60'
  return (
    <div className="flex items-center gap-1.5 md:justify-end">
      <button type="button" onClick={() => onEdit(u)} aria-label={`Ubah ${u.username}`} className={`${base} flex-1 text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 md:flex-none`}>
        <Pencil className="h-3.5 w-3.5" /> Ubah
      </button>
      <button
        type="button"
        onClick={() => onDelete(u)}
        disabled={deleting}
        aria-label={`Hapus ${u.username}`}
        title="Hapus akun"
        className={`${base} w-9 px-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600`}
      >
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  )
}
