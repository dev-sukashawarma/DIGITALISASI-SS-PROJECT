'use client'
import { useState } from 'react'
import { Button } from '@suka/design-system'
import { OutletMultiSelect } from './OutletMultiSelect'
import type { Outlet, StaffFormValues, Role } from '@/lib/types'

const ROLES: Role[] = ['admin', 'owner', 'spv', 'leader', 'kasir', 'crew', 'kiosk']

export function StaffForm({
  outlets, onSubmit, submitting, initial,
}: {
  outlets: Outlet[]
  onSubmit: (values: StaffFormValues) => void
  submitting: boolean
  initial?: Partial<StaffFormValues>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? 'sukashawarma123')
  const [role, setRole] = useState<Role>(initial?.role ?? 'crew')
  const [outletId, setOutletId] = useState(initial?.outlet_id ?? (outlets[0]?.id ?? ''))
  const [outletIds, setOutletIds] = useState<string[]>(initial?.outlet_ids ?? [])

  const inputCls = 'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange'
  const labelCls = 'mb-1 block text-sm font-medium text-gray-700'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ name, username, password, role, outlet_id: outletId, outlet_ids: outletIds })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="sf-name" className={labelCls}>Nama Lengkap</label>
        <input id="sf-name" className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="sf-username" className={labelCls}>Username</label>
        <input id="sf-username" className={inputCls} required value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
      </div>
      <div>
        <label htmlFor="sf-password" className={labelCls}>Password Sementara</label>
        <input id="sf-password" className={inputCls} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="sf-role" className={labelCls}>Role</label>
        <select id="sf-role" className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="sf-outlet" className={labelCls}>Outlet Home</label>
        <select id="sf-outlet" className={inputCls} value={outletId} onChange={(e) => setOutletId(e.target.value)}>
          {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      {role === 'leader' && (
        <div>
          <label className={labelCls}>Outlet Binaan</label>
          <OutletMultiSelect outlets={outlets} selected={outletIds} onChange={setOutletIds} />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={submitting} className="rounded-xl">
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}
