'use client'

import { useState } from 'react'
import { ThresholdRow } from './ThresholdRow'
import type { ThresholdItem } from '@/lib/queries/threshold'

interface Props {
  items: ThresholdItem[]
  onSave: (bahanBakuId: string, value: number) => Promise<void>
  onReset: (bahanBakuId: string) => Promise<void>
}

export function ThresholdTable({ items, onSave, onReset }: Props) {
  const [activeKategori, setActiveKategori] = useState<string>('semua')

  const kategoriList = ['semua', ...Array.from(new Set(items.map(i => i.kategori))).sort()]

  const filtered = activeKategori === 'semua'
    ? items
    : items.filter(i => i.kategori === activeKategori)

  return (
    <div>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {kategoriList.map(k => (
          <button
            key={k}
            onClick={() => setActiveKategori(k)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
              activeKategori === k
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Kategori</th>
              <th className="px-4 py-3 text-left">Bahan Baku</th>
              <th className="px-4 py-3 text-left">Satuan</th>
              <th className="px-4 py-3 text-left">Default Global</th>
              <th className="px-4 py-3 text-left">Threshold Outlet</th>
              <th className="px-4 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Tidak ada bahan baku
                </td>
              </tr>
            ) : (
              filtered.map(item => (
                <ThresholdRow
                  key={item.bahan_baku_id}
                  item={item}
                  onSave={onSave}
                  onReset={onReset}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Klik angka di kolom "Threshold Outlet" untuk edit. Enter atau klik di luar untuk menyimpan.
      </p>
    </div>
  )
}
