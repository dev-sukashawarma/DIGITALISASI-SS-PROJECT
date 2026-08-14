'use client'

import React, { useState } from 'react'
import { Key, Plus, Copy, Trash2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export default function APIKeysPage() {
  const [keys, setKeys] = useState([
    { id: 1, name: 'Production Dashboard V2', key: 'sk_live_...x8f9', created: '2025-10-12', lastUsed: '2 mins ago' },
    { id: 2, name: 'Analytics Worker', key: 'sk_live_...3k9d', created: '2026-01-05', lastUsed: '1 hour ago' },
  ])
  const [showKey, setShowKey] = useState<number | null>(null)

  const handleCopy = () => {
    toast.success('API Key copied to clipboard')
  }

  const handleDelete = (id: number) => {
    setKeys(keys.filter(k => k.id !== id))
    toast.success('API Key revoked')
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Key className="text-indigo-500" /> API Keys
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage developer API keys for external integrations.</p>
        </div>
        
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-md font-bold text-sm transition-colors active:scale-95">
          <Plus size={16} /> Generate New Key
        </button>
      </div>

      <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/50 text-slate-700 font-bold uppercase text-xs tracking-wider border-b border-white/60">
              <tr>
                <th className="px-6 py-4">Key Name</th>
                <th className="px-6 py-4">Secret Key</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Last Used</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              <AnimatePresence>
                {keys.map((k) => (
                  <motion.tr 
                    key={k.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-white/40 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{k.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono bg-slate-100 px-3 py-1.5 rounded-lg w-fit">
                        {showKey === k.id ? 'sk_live_5893jd839dk92kx8f9' : k.key}
                        <button onClick={() => setShowKey(showKey === k.id ? null : k.id)} className="text-slate-400 hover:text-indigo-500 ml-2">
                          {showKey === k.id ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">{k.created}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">{k.lastUsed}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={handleCopy} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Copy">
                          <Copy size={16} />
                        </button>
                        <button onClick={() => handleDelete(k.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Revoke">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {keys.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-medium">
              No API keys found. Generate a new one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
