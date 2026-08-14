// @ts-nocheck
'use client'

import React, { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { Button } from '@suka/design-system'
import type { BahanBakuThreshold } from '@/hooks/useOutletThresholds'

interface ThresholdTableProps {
  rows: BahanBakuThreshold[]
  onSave: (id: string, type: 'angka' | 'persentase' | null, pct: number | null, ideal: number | null) => void
  saving: boolean
}

export function ThresholdTable({ rows, onSave, saving }: ThresholdTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [draftIdeal, setDraftIdeal] = useState('')
  const [draftType, setDraftType] = useState<'angka' | 'persentase'>('angka')
  const [draftPct, setDraftPct] = useState('')

  const startEdit = (row: BahanBakuThreshold) => {
    setEditingId(row.id)
    setDraftIdeal(row.outlet_stok_ideal ? String(row.outlet_stok_ideal) : '')
    setDraftType(row.outlet_threshold_type || 'angka')
    setDraftPct(row.outlet_threshold_persentase ? String(row.outlet_threshold_persentase) : '')
  }

  const handleSave = (id: string) => {
    onSave(
      id,
      draftType,
      draftPct ? Number(draftPct) : null,
      draftIdeal ? Number(draftIdeal) : null
    )
    setEditingId(null)
  }

  const handleReset = (id: string) => {
    // Save with nulls to reset to global default
    onSave(id, null, null, null)
    setEditingId(null)
  }

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
            <th className="px-4 py-3 font-bold w-[250px]">Nama Bahan Baku</th>
            <th className="px-4 py-3 font-bold text-center w-[150px]">Global Default</th>
            <th className="px-4 py-3 font-bold">Stok Ideal (Kitchen)</th>
            <th className="px-4 py-3 font-bold">Threshold (Kitchen)</th>
            <th className="px-4 py-3 font-bold text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {rows.map(row => {
            const isEditing = editingId === row.id
            const hasOverride = row.outlet_stok_ideal !== null || row.outlet_threshold_type !== null

            return (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-900">{row.nama}</div>
                  <div className="text-xs text-slate-500">{row.kategori || '-'}</div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md inline-block">
                    {row.global_stok_ideal ? `${row.global_stok_ideal} ${row.satuan}` : '-'}
                    <br />
                    {row.global_threshold_type === 'persentase' && row.global_threshold_persentase
                      ? `(${row.global_threshold_persentase}%)`
                      : '(Angka)'}
                  </div>
                </td>

                <td className="px-4 py-3">
                  {isEditing ? (
                    <div className="flex gap-2 items-center">
                      <input 
                        type="number"
                        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                        value={draftIdeal}
                        onChange={e => setDraftIdeal(e.target.value)}
                        placeholder="Default"
                      />
                      <span className="text-xs text-gray-500">{row.satuan}</span>
                    </div>
                  ) : (
                    <div className="font-semibold text-slate-900">
                      {row.outlet_stok_ideal ? (
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {row.outlet_stok_ideal} {row.satuan}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Ikut Default</span>
                      )}
                    </div>
                  )}
                </td>

                <td className="px-4 py-3">
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <select 
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm bg-white outline-none focus:border-blue-500"
                        value={draftType}
                        onChange={e => setDraftType(e.target.value as 'angka' | 'persentase')}
                      >
                        <option value="angka">Angka Tetap</option>
                        <option value="persentase">Persentase (%)</option>
                      </select>
                      {draftType === 'persentase' && (
                        <input 
                          type="number"
                          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                          value={draftPct}
                          onChange={e => setDraftPct(e.target.value)}
                          placeholder="%"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="font-semibold text-slate-900">
                      {row.outlet_threshold_type ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {row.outlet_threshold_type === 'persentase' 
                            ? `${row.outlet_threshold_persentase}%` 
                            : 'Angka Tetap'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Ikut Default</span>
                      )}
                    </div>
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  {isEditing ? (
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => handleSave(row.id)}
                        disabled={saving}
                        className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        disabled={saving}
                        className="p-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      {hasOverride && (
                        <button 
                          onClick={() => {
                            if(confirm('Reset ke settingan default pusat?')) handleReset(row.id)
                          }}
                          disabled={saving}
                          className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          Reset
                        </button>
                      )}
                      <button 
                        onClick={() => startEdit(row)}
                        disabled={saving}
                        className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

