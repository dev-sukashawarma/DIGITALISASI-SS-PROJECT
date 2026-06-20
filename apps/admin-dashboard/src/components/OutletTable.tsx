'use client'
import { Pencil, Power, Trash2 } from 'lucide-react'
import type { Outlet } from '@/lib/types'

export function OutletTable({
  rows, onEdit, onToggleActive, onDelete,
}: {
  rows: Outlet[]
  onEdit: (o: Outlet) => void
  onToggleActive: (o: Outlet) => void
  onDelete: (o: Outlet) => void
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl bg-suka-gray-50 p-6 text-center text-sm text-gray-500">Tidak ada outlet.</p>
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-suka-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-suka-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">Koordinat</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-t border-suka-gray-200">
              <td className="px-4 py-3 font-medium text-suka-ink">{o.name}</td>
              <td className="px-4 py-3 text-gray-500">{o.slug}</td>
              <td className="px-4 py-3 text-gray-500">{o.lat}, {o.lng}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                  {o.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-3 text-gray-500">
                  <button title="Edit" onClick={() => onEdit(o)}><Pencil size={16} /></button>
                  <button title={o.is_active ? 'Nonaktifkan' : 'Aktifkan'} onClick={() => onToggleActive(o)}><Power size={16} /></button>
                  <button title="Hapus permanen" onClick={() => onDelete(o)} className="text-red-500"><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
