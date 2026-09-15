'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Loader2, X, ExternalLink, Scale } from 'lucide-react'
import { useReturActions } from '@/hooks/useRetur'
import { ReturStok } from '@/types/retur'

export function ModalApproveManager({
  retur,
  isOpen,
  onClose,
}: {
  retur: ReturStok
  isOpen: boolean
  onClose: () => void
}) {
  const { approveManager } = useReturActions()
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const [activePhoto, setActivePhoto] = useState<string | null>(null)

  if (!isOpen) return null

  const handleAction = async (approve: boolean) => {
    if (!approve && !catatan.trim()) {
      toast.error('Wajib mengisi alasan penolakan untuk kru outlet')
      return
    }

    setBusy(true)
    try {
      await approveManager.mutateAsync({
        returId: retur.id,
        approve,
        note: catatan.trim() || undefined,
      })

      if (approve) {
        toast.success('Pengajuan retur disetujui. Siap dijemput kurir.')
      } else {
        toast.info('Pengajuan retur ditolak & dialihkan resmi menjadi waste outlet.')
      }
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses persetujuan manager')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#d9c2b2]/40 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <div>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Persetujuan AM / RM
            </span>
            <h3 className="font-extrabold text-[#1e1b15] text-base mt-1">
              Validasi Klaim Retur {retur.nomor_retur}
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              Outlet: <span className="font-bold text-gray-800">{retur.outlets?.name ?? 'Outlet'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item list */}
        <div className="space-y-4 mb-5">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-600">
            Daftar Bahan Diajukan
          </h4>
          {retur.items?.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-amber-50/40 rounded-xl border border-amber-100/80 space-y-2 text-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-black text-sm text-gray-900">
                    {item.bahan_baku?.nama ?? 'Bahan Baku'}
                  </span>
                  <p className="text-[11px] text-amber-950 font-bold mt-0.5">
                    Alasan: <span className="underline">{item.alasan}</span>
                  </p>
                  {item.catatan && (
                    <p className="text-[11px] text-gray-600 italic">"{item.catatan}"</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 font-mono font-black text-amber-900 text-sm">
                    <Scale className="w-3.5 h-3.5" />
                    <span>
                      {item.qty_klaim.toLocaleString('id-ID')} {item.bahan_baku?.satuan}
                    </span>
                  </div>
                </div>
              </div>

              {/* Photos */}
              <div className="pt-2 border-t border-amber-100 flex gap-2">
                {!item.foto_timbangan_url || item.foto_timbangan_url === item.foto_fisik_url ? (
                  <div
                    onClick={() => setActivePhoto(item.foto_fisik_url)}
                    className="w-full cursor-pointer bg-white rounded-xl p-2 border border-gray-200 hover:border-amber-600 transition-colors flex items-center gap-3 shadow-2xs"
                  >
                    <img
                      src={item.foto_fisik_url}
                      alt="Foto Bahan di Atas Timbangan"
                      className="w-14 h-14 object-cover rounded-lg border border-amber-100"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800">Foto Bahan Baku di Atas Timbangan</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Fisik rusak & angka timbangan digital</p>
                      <span className="text-[10px] text-amber-700 font-black flex items-center gap-1 mt-1">
                        Perbesar Foto <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => setActivePhoto(item.foto_fisik_url)}
                      className="flex-1 cursor-pointer bg-white rounded-lg p-1.5 border border-gray-200 hover:border-amber-600 transition-colors flex items-center gap-2"
                    >
                      <img
                        src={item.foto_fisik_url}
                        alt="Foto Fisik"
                        className="w-10 h-10 object-cover rounded-md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-gray-700 truncate">Foto Fisik</p>
                        <span className="text-[9px] text-amber-700 font-semibold flex items-center gap-0.5">
                          Perbesar <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>

                    <div
                      onClick={() => setActivePhoto(item.foto_timbangan_url!)}
                      className="flex-1 cursor-pointer bg-white rounded-lg p-1.5 border border-gray-200 hover:border-amber-600 transition-colors flex items-center gap-2"
                    >
                      <img
                        src={item.foto_timbangan_url!}
                        alt="Foto Timbangan"
                        className="w-10 h-10 object-cover rounded-md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-gray-700 truncate">Foto Timbangan</p>
                        <span className="text-[9px] text-amber-700 font-semibold flex items-center gap-0.5">
                          Perbesar <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Catatan manager input */}
        <div className="mb-5">
          <label className="block mb-1 text-[11px] font-bold text-gray-700">
            Catatan Keputusan AM / RM (Wajib jika menolak)
          </label>
          <textarea
            rows={2}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan inspeksi / alasan keputusan..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-hidden focus:border-amber-600 text-xs text-gray-800 bg-white"
          />
        </div>

        {/* Decision buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => handleAction(false)}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            Tolak (Beban Waste Outlet)
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => handleAction(true)}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Setujui Klaim Retur
            </button>
          </div>
        </div>

        {/* Photo zoom modal overlay */}
        {activePhoto && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setActivePhoto(null)}
          >
            <div className="relative max-w-xl max-h-[85vh]">
              <img
                src={activePhoto}
                alt="Preview"
                className="max-w-full max-h-[85vh] object-contain rounded-xl"
              />
              <button
                onClick={() => setActivePhoto(null)}
                className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-full text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
