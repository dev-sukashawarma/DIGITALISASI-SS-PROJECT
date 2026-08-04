'use client'

import React, { useEffect, useState } from 'react'
import { fetchUsersGlobal, changeUserRoleGlobal, moveUserOutletGlobal } from '../actions/userActions'
import { Search, ShieldAlert, UserCog, Building2, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Role } from '@suka/auth'

export default function GlobalUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await fetchUsersGlobal()
      setUsers(data)
    } catch (err: any) {
      toast.error('Failed to load users: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setProcessingId(userId)
    try {
      await changeUserRoleGlobal(userId, newRole)
      toast.success('User role updated successfully')
      loadUsers() // refresh
    } catch (err: any) {
      toast.error('Failed to update role: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleOutletChange = async (userId: string, newOutletId: string | null) => {
    setProcessingId(userId)
    try {
      await moveUserOutletGlobal(userId, newOutletId)
      toast.success('User outlet updated successfully')
      loadUsers() // refresh
    } catch (err: any) {
      toast.error('Failed to update outlet: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const roles: Role[] = [
    'admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'leader', 'crew', 'kiosk', 
    'kitchen', 'mitra', 'staff_pusat', 'admin_finance', 'area_manager', 'purchasing', 'developer'
  ]

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <UserCog className="text-indigo-500" /> Global Users
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Bypass limits to manage any user and role.</p>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-md border border-white/60 rounded-full shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text"
            placeholder="Search name or username..."
            className="bg-transparent border-none outline-none text-sm text-slate-700 w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/50 text-slate-700 font-bold uppercase text-xs tracking-wider border-b border-white/60">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Outlet ID (Manual Edit)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              <AnimatePresence>
                {filteredUsers.map((user) => (
                  <motion.tr 
                    key={user.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-white/40 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{user.name}</div>
                      <div className="text-xs text-slate-500">@{user.username || 'unknown'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={processingId === user.id}
                      >
                        {roles.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-slate-400" />
                        <input 
                          type="text" 
                          defaultValue={user.outlet_id || ''} 
                          className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-700 w-full max-w-[200px] outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          placeholder="null"
                          onBlur={(e) => {
                            const val = e.target.value.trim()
                            if (val !== (user.outlet_id || '')) {
                              handleOutletChange(user.id, val === '' ? null : val)
                            }
                          }}
                          disabled={processingId === user.id}
                        />
                        {processingId === user.id && <Loader2 size={16} className="animate-spin text-indigo-500" />}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 pl-6">
                        {user.outlets?.name || 'No Outlet Bound'}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-medium">
              No users found matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
