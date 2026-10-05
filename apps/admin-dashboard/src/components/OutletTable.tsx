'use client'

import {
  Store,
  MapPin,
  ExternalLink,
  Clock,
  CircleDollarSign,
  Pencil,
  Power,
  Trash2,
  AlertTriangle,
  SearchX,
  Building2,
  Users,
} from 'lucide-react'
import type { Outlet } from '@/lib/types'
import { LABEL_TIPE_OUTLET, labelNonOutlet } from '@/lib/outletType'

function hasValidCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
}

function getTypeBadge(type?: string) {
  if (type === 'mitra') {
    return {
      label: LABEL_TIPE_OUTLET.mitra,
      className: 'bg-cyan-50 text-cyan-800 border-cyan-200/80',
      Icon: Users,
    }
  }
  if (type === 'internal') {
    return {
      label: LABEL_TIPE_OUTLET.internal,
      className: 'bg-orange-50 text-orange-800 border-orange-200/80',
      Icon: Store,
    }
  }
  // Gudang, marketplace, tes, dll. — bukan outlet.
  return {
    label: labelNonOutlet(type),
    className: 'bg-suka-gray-50 text-suka-gray-500 border-suka-gray-200',
    Icon: Building2,
  }
}

export function OutletTable({
  rows,
  onEdit,
  onToggleActive,
  onDelete,
  onManageInvestment,
  onResetFilter,
}: {
  rows: Outlet[]
  onEdit?: (o: Outlet) => void
  onToggleActive?: (o: Outlet) => void
  onDelete?: (o: Outlet) => void
  onManageInvestment?: (o: Outlet) => void
  onResetFilter?: () => void
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-suka-gray-300 bg-white p-8 sm:p-12 text-center shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-suka-orange flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
          <SearchX className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-suka-ink">Tidak ada outlet yang sesuai</h3>
        <p className="text-xs sm:text-sm text-suka-gray-500 mt-1 max-w-sm mx-auto">
          Tidak ditemukan data yang cocok dengan kata kunci atau filter saat ini.
        </p>
        {onResetFilter && (
          <button
            type="button"
            onClick={onResetFilter}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-suka-gray-100 hover:bg-suka-gray-200 text-xs font-semibold text-suka-ink transition-colors min-h-[40px]"
          >
            Reset Filter
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Desktop Table View (>= md) ── */}
      <div className="hidden md:block overflow-hidden rounded-3xl border border-suka-gray-200/80 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-suka-gray-50/80 border-b border-suka-gray-200 text-[11px] font-bold uppercase tracking-wider text-suka-gray-500">
              <tr>
                <th className="px-5 py-3.5">Outlet & Alamat</th>
                <th className="px-4 py-3.5">Tipe</th>
                <th className="px-4 py-3.5">Lokasi GPS</th>
                <th className="px-4 py-3.5">Operasional</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {rows.map((o) => {
                const typeBadge = getTypeBadge(o.type)
                const hasCoords = hasValidCoordinates(o.lat, o.lng)
                const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${o.lat},${o.lng}` : null

                return (
                  <tr
                    key={o.id}
                    className="hover:bg-orange-50/30 transition-colors group"
                  >
                    {/* Name, Slug, & Address */}
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-suka-brown flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                          {o.name ? o.name.charAt(0).toUpperCase() : 'O'}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-suka-ink text-sm group-hover:text-suka-brown transition-colors">
                              {o.name}
                            </span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-suka-gray-100 text-suka-gray-600 border border-suka-gray-200/60">
                              {o.slug}
                            </span>
                          </div>
                          <p className="text-xs text-suka-gray-500 line-clamp-1 max-w-xs lg:max-w-md">
                            {o.address || <span className="italic text-suka-gray-400">Belum ada alamat</span>}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Tipe Badge */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeBadge.className}`}>
                        <typeBadge.Icon className="w-3.5 h-3.5" />
                        {typeBadge.label}
                      </span>
                    </td>

                    {/* Lokasi GPS */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {hasCoords && mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/coord inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-suka-gray-50 hover:bg-orange-50 text-suka-gray-600 hover:text-suka-orange border border-suka-gray-200/80 hover:border-orange-200 transition-colors font-mono text-xs"
                          title="Buka titik koordinat di Google Maps"
                        >
                          <MapPin className="w-3.5 h-3.5 text-suka-orange shrink-0" />
                          <span>{o.lat.toFixed(4)}, {o.lng.toFixed(4)}</span>
                          <ExternalLink className="w-3 h-3 text-suka-gray-400 group-hover/coord:text-suka-orange shrink-0" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEdit && onEdit(o)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-colors"
                          title="Klik untuk mengatur titik lokasi outlet"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Belum diatur</span>
                        </button>
                      )}
                    </td>

                    {/* Jam Operasional */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {o.open_hour && o.close_hour ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-suka-gray-600">
                          <Clock className="w-3.5 h-3.5 text-suka-gray-400 shrink-0" />
                          <span>{o.open_hour.slice(0, 5)} – {o.close_hour.slice(0, 5)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-suka-gray-400 font-mono">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {o.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          Pending
                        </span>
                      ) : o.is_active || o.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          <span className="inline-flex rounded-full h-2 w-2 bg-gray-400" />
                          Nonaktif
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onManageInvestment && o.type === 'mitra' && (
                          <button
                            type="button"
                            title="Kelola Modal Mitra"
                            onClick={() => onManageInvestment(o)}
                            className="p-2 rounded-xl text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 border border-transparent hover:border-cyan-200 transition-colors"
                          >
                            <CircleDollarSign size={17} />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            title="Edit Data Outlet"
                            onClick={() => onEdit(o)}
                            className="p-2 rounded-xl text-suka-gray-600 hover:text-suka-ink hover:bg-suka-gray-100 border border-transparent hover:border-suka-gray-200 transition-colors"
                          >
                            <Pencil size={17} />
                          </button>
                        )}
                        {onToggleActive && (
                          <button
                            type="button"
                            title={
                              o.status === 'pending'
                                ? 'Aktifkan Cabang'
                                : o.is_active
                                ? 'Nonaktifkan Outlet'
                                : 'Aktifkan Outlet'
                            }
                            onClick={() => onToggleActive(o)}
                            className={`p-2 rounded-xl border border-transparent transition-colors ${
                              o.status === 'pending'
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                                : o.is_active
                                ? 'text-suka-gray-500 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-200'
                                : 'text-suka-gray-500 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200'
                            }`}
                          >
                            <Power size={17} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            title="Nonaktifkan & Hapus (Soft Delete)"
                            onClick={() => onDelete(o)}
                            className="p-2 rounded-xl text-suka-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile Card View (< md) ── */}
      <div className="md:hidden space-y-3">
        {rows.map((o) => {
          const typeBadge = getTypeBadge(o.type)
          const hasCoords = hasValidCoordinates(o.lat, o.lng)
          const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${o.lat},${o.lng}` : null

          return (
            <div
              key={o.id}
              className="bg-white rounded-2xl border border-suka-gray-200/80 p-4 shadow-xs space-y-3"
            >
              {/* Card Header: Avatar, Name, Slug, and Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-suka-brown flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                    {o.name ? o.name.charAt(0).toUpperCase() : 'O'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-suka-ink leading-snug truncate">
                      {o.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-suka-gray-100 text-suka-gray-600 border border-suka-gray-200/60">
                        {o.slug}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${typeBadge.className}`}>
                        <typeBadge.Icon className="w-3 h-3" />
                        {typeBadge.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Pill */}
                <div className="shrink-0">
                  {o.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Pending
                    </span>
                  ) : o.is_active || o.status === 'active' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      Nonaktif
                    </span>
                  )}
                </div>
              </div>

              {/* Card Details: Address & Operasional */}
              <div className="space-y-1.5 text-xs text-suka-gray-600 pt-1">
                {o.address ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-suka-gray-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">{o.address}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-suka-gray-400 italic">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>Belum ada alamat</span>
                  </div>
                )}

                {o.open_hour && o.close_hour && (
                  <div className="flex items-center gap-2 text-suka-gray-500">
                    <Clock className="w-3.5 h-3.5 text-suka-gray-400 shrink-0" />
                    <span>Jam Operasional: {o.open_hour.slice(0, 5)} – {o.close_hour.slice(0, 5)}</span>
                  </div>
                )}
              </div>

              {/* GPS Link or Alert */}
              <div className="pt-1">
                {hasCoords && mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50/70 hover:bg-orange-100/70 border border-orange-200/70 text-suka-orange text-xs font-semibold transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>Buka Google Maps ({o.lat.toFixed(4)}, {o.lng.toFixed(4)})</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-0.5" />
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Titik GPS belum diatur</span>
                  </div>
                )}
              </div>

              {/* Mobile Touch Action Buttons (Min height 44px) */}
              <div className="pt-2 border-t border-suka-gray-100 flex flex-col gap-2">
                {onManageInvestment && o.type === 'mitra' && (
                  <button
                    type="button"
                    onClick={() => onManageInvestment(o)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    <CircleDollarSign className="w-4 h-4" />
                    Kelola Modal Mitra
                  </button>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(o)}
                      className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-suka-ink bg-suka-gray-50 hover:bg-suka-gray-100 border border-suka-gray-200 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Pencil className="w-3.5 h-3.5 text-suka-gray-500" />
                      Edit
                    </button>
                  )}
                  {onToggleActive && (
                    <button
                      type="button"
                      title={o.status === 'pending' ? 'Aktifkan Cabang' : o.is_active ? 'Nonaktifkan Cabang' : 'Aktifkan Cabang'}
                      onClick={() => onToggleActive(o)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors shadow-2xs ${
                        o.is_active
                          ? 'text-amber-800 bg-amber-50 hover:bg-amber-100/70 border-amber-200'
                          : o.status === 'pending'
                          ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {o.status === 'pending' ? 'Aktifkan' : o.is_active ? 'Nonaktif' : 'Aktifkan'}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      title="Nonaktifkan & Hapus (Soft Delete)"
                      onClick={() => onDelete(o)}
                      className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-red-600 bg-red-50/50 hover:bg-red-50 border border-red-200 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
