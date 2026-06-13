'use client'

import { useState, useRef } from 'react'
import type { ThresholdItem } from '@/lib/queries/threshold'

interface Props {
  item: ThresholdItem
  onSave: (bahanBakuId: string, value: number) => Promise<void>
  onReset: (bahanBakuId: string) => Promise<void>
}

export function ThresholdRow({ item, onSave, onReset }: Props) {
  const activeValue = item.outlet_threshold ?? item.default_reorder_point
  const hasOverride = item.outlet_threshold !== null

  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(String(activeValue))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setInputVal(String(activeValue))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitEdit = async () => {
    const parsed = parseFloat(inputVal)
    if (isNaN(parsed) || parsed < 0) {
      setError('Angka tidak valid')
      return
    }
    if (parsed === activeValue) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(item.bahan_baku_id, parsed)
    } catch {
      setError('Gagal menyimpan')
      setInputVal(String(activeValue))
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  const handleReset = async () => {
    setSaving(true)
    try {
      await onReset(item.bahan_baku_id)
    } catch {
      setError('Gagal reset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-2 text-xs text-gray-500 capitalize">{item.kategori}</td>
      <td className="px-4 py-2 font-medium text-gray-900">{item.nama}</td>
      <td className="px-4 py-2 text-gray-500 text-sm">{item.satuan}</td>
      <td className="px-4 py-2 text-gray-400 text-sm">{item.default_reorder_point}</td>
      <td className="px-4 py-2">
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            min={0}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="w-24 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        ) : (
          <button
            onClick={startEdit}
            className={`text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors ${
              hasOverride ? 'text-gray-900 font-semibold' : 'text-gray-400'
            }`}
            title="Klik untuk edit"
          >
            {activeValue}
            {!hasOverride && <span className="ml-1 text-xs text-gray-400">(default)</span>}
          </button>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </td>
      <td className="px-4 py-2">
        {hasOverride && (
          <button
            onClick={handleReset}
            disabled={saving}
            className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </td>
    </tr>
  )
}
