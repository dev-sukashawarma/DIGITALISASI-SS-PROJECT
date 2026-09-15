'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Loader2,
  X,
  Scale,
  FileText,
  Maximize2,
  Truck,
  Clock,
  Save,
} from 'lucide-react'
import { useReturActions } from '@/hooks/useRetur'
import { ReturStok } from '@/types/retur'

export function ModalVerifikasiKitchen({
  retur,
  isOpen,
  onClose,
}: {
  retur: ReturStok
  isOpen: boolean
  onClose: () => void
}) {
  const { verifikasiKitchen } = useReturActions()

  const isAlreadyReceived = retur.status === 'diterima_kitchen'

  // State untuk pilihan waktu pengiriman pengganti: 'sekarang' vs 'nanti'
  const [waktuPenggantian, setWaktuPenggantian] = useState<'sekarang' | 'nanti'>('sekarang')

  // State untuk bobot timbang ulang kitchen (default pre-filled sesuai klaim outlet atau timbangan tersimpan)
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    retur.items?.forEach((item) => {
      initial[item.id] = String(item.qty_diterima_kitchen ?? item.qty_klaim)
    })
    return initial
  })
  const [catatan, setCatatan] = useState(retur.catatan_kitchen ?? '')
  const [busy, setBusy] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null)

  if (!isOpen) return null

  const handleWeightChange = (itemId: string, value: string) => {
    setWeights((prev) => ({ ...prev, [itemId]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const verifiedItems: Array<{ id: string; qty_diterima_kitchen: number }> = []

    for (const item of retur.items ?? []) {
      const val = parseFloat(weights[item.id] ?? '0')
      if (isNaN(val) || val <= 0) {
        toast.error(`Kuantitas timbangan untuk ${item.bahan_baku?.nama ?? 'item'} harus valid`)
        return
      }
      verifiedItems.push({
        id: item.id,
        qty_diterima_kitchen: val,
      })
    }

    const kirimSekarang = isAlreadyReceived ? true : waktuPenggantian === 'sekarang'

    setBusy(true)
    try {
      const res: any = await verifikasiKitchen.mutateAsync({
        returId: retur.id,
        itemsVerified: verifiedItems,
        note: catatan.trim() || undefined,
        terbitkanSjSekarang: kirimSekarang,
      })

      if (kirimSekarang) {
        toast.success(
          `Surat Jalan Pengganti ${res?.nomor_surat_jalan ?? ''} berhasil diterbitkan!`
        )
      } else {
        toast.success(
          'Hasil verifikasi timbang fisik berhasil disimpan. Penggantian dapat dikirim sesuai jadwal berikutnya.'
        )
      }
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses verifikasi kitchen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#d9c2b2]/40 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <div>
            <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Central Kitchen Verification
            </span>
            <h3 className="font-extrabold text-[#1e1b15] text-base mt-1">
              {isAlreadyReceived
                ? 'Terbitkan Surat Jalan Pengganti'
                : 'Verifikasi Fisik & Opsi Pengiriman'}
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              Tiket: <span className="font-mono font-bold text-gray-800">{retur.nomor_retur}</span> · Outlet:{' '}
              <span className="font-bold text-gray-800">{retur.outlets?.name ?? 'Outlet'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner status jika sudah diterima fisik sebelumnya */}
        {isAlreadyReceived && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs mb-4 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 block">Fisik Sudah Diterima & Ditimbang Sebelumnya</span>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                Kuantitas fisik sudah tercatat. Klik tombol di bawah untuk menerbitkan Surat Jalan Pengganti resmi saat barang siap dikirim ke outlet.
              </p>
            </div>
          </div>
        )}

        {/* Informasi Logistik */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/70 text-xs mb-4 flex items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-2 flex-1">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase block">Kurir / Ekspedisi</span>
              <p className="font-bold text-gray-800 uppercase">{retur.jenis_logistik}</p>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase block">Nama Driver / Plat</span>
              <p className="font-bold text-gray-800">
                {retur.driver_nama ?? '—'} {retur.driver_plat_kendaraan ? `(${retur.driver_plat_kendaraan})` : ''}
              </p>
            </div>
            {retur.nomor_resi_order && (
              <div className="col-span-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">
                  Nomor Resi / Order ID Lalamove
                </span>
                <p className="font-mono font-black text-blue-900">{retur.nomor_resi_order}</p>
              </div>
            )}
          </div>

          {retur.foto_serah_terima_url && (
            <button
              type="button"
              onClick={() =>
                setSelectedPhoto({
                  url: retur.foto_serah_terima_url!,
                  title: `Bukti Serah Terima Kurir - ${retur.driver_nama}`,
                })
              }
              className="group relative w-12 h-12 rounded-xl overflow-hidden border border-blue-200 bg-black/5 hover:opacity-90 transition-all cursor-pointer shrink-0 shadow-2xs"
              title="Lihat foto serah terima kurir"
            >
              <img
                src={retur.foto_serah_terima_url}
                alt="Bukti kurir"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Maximize2 size={12} />
              </div>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-gray-700">
          <div>
            <h4 className="font-bold uppercase tracking-wider text-[11px] text-gray-600 mb-2">
              Input Hasil Timbang Ulang Kitchen
            </h4>
            <div className="space-y-3">
              {retur.items?.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Thumbnail Bukti Timbangan Outlet */}
                    {item.foto_fisik_url && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPhoto({
                            url: item.foto_fisik_url,
                            title: `Bukti Timbangan Outlet: ${item.bahan_baku?.nama ?? 'Bahan'} (${item.qty_klaim} ${item.bahan_baku?.satuan})`,
                          })
                        }
                        className="group relative w-14 h-14 rounded-xl overflow-hidden border border-amber-900/15 bg-black/5 hover:opacity-90 transition-all cursor-pointer shrink-0 shadow-2xs"
                        title="Klik untuk perbesar foto timbangan outlet"
                      >
                        <img
                          src={item.foto_fisik_url}
                          alt="Foto timbangan outlet"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 size={14} />
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white font-bold text-center py-0.5">
                          Timbangan
                        </div>
                      </button>
                    )}

                    <div className="min-w-0">
                      <span className="font-black text-sm text-gray-900 block truncate">
                        {item.bahan_baku?.nama ?? 'Bahan Baku'}
                      </span>
                      <span className="text-[11px] font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        Klaim Outlet: {item.qty_klaim} {item.bahan_baku?.satuan}
                      </span>
                      {item.alasan && (
                        <span className="text-[10px] text-gray-500 block mt-1">
                          Alasan: {item.alasan} {item.catatan ? `(${item.catatan})` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full sm:w-44 text-right shrink-0">
                    <label className="block text-[10px] text-gray-600 font-bold mb-1">
                      Fisik Kitchen ({item.bahan_baku?.satuan})
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={weights[item.id] ?? ''}
                        onChange={(e) => handleWeightChange(item.id, e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-amber-300 focus:outline-hidden focus:border-amber-600 text-sm font-mono font-bold bg-white text-right"
                        required
                      />
                      <Scale className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

            {/* Opsi Jadwal Pengiriman (hanya jika tiket belum di status diterima_kitchen) */}
            {!isAlreadyReceived && (
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-2">
                  Metode Pengiriman Barang Pengganti
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setWaktuPenggantian('sekarang')}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      waktuPenggantian === 'sekarang'
                        ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600/30'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="waktuPenggantian"
                      checked={waktuPenggantian === 'sekarang'}
                      onChange={() => setWaktuPenggantian('sekarang')}
                      className="mt-0.5 text-blue-800 focus:ring-blue-600"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        Kirim Hari Ini (Sekarang)
                      </span>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                        Kirim armada khusus hari ini & langsung terbitkan Surat Jalan Pengganti.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setWaktuPenggantian('nanti')}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      waktuPenggantian === 'nanti'
                        ? 'border-purple-600 bg-purple-50/60 ring-1 ring-purple-600/30'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="waktuPenggantian"
                      checked={waktuPenggantian === 'nanti'}
                      onChange={() => setWaktuPenggantian('nanti')}
                      className="mt-0.5 text-purple-800 focus:ring-purple-600"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        Gabung Kiriman Reguler (Otomatis)
                      </span>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                        Fisik disimpan di Kitchen. Otomatis disertakan saat kirim stok rutin ke outlet ini.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Catatan Kitchen */}
            <div>
              <label className="block mb-1 text-[11px] font-bold text-gray-700">
                Catatan Central Kitchen {waktuPenggantian === 'nanti' && !isAlreadyReceived ? '(Rencana Pengiriman)' : '(Opsional)'}
              </label>
              <textarea
                rows={2}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder={
                  waktuPenggantian === 'nanti' && !isAlreadyReceived
                    ? 'Contoh: Disertakan pada rute kirim rutin Rabu / Menunggu batch marinasi besok...'
                    : 'Catatan kondisi fisik / jadwal kirim pengganti...'
                }
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-hidden focus:border-blue-600 text-xs bg-white text-gray-800"
              />
            </div>

            {/* Penjelasan Tindakan */}
            {(isAlreadyReceived || waktuPenggantian === 'sekarang') ? (
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
                <FileText className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <p>
                  Sistem akan <strong>otomatis menerbitkan Surat Jalan Pengganti resmi</strong> dengan nomor dokumen unik. Tiket beralih ke status <em>SJ Pengganti OTW</em> dan selesai setelah diverifikasi kru outlet.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-[11px] text-purple-900 flex items-start gap-2">
                <Clock className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <p>
                  Tiket disimpan sebagai <strong>Tanggungan Penggantian Bahan</strong> untuk outlet ini. Sistem akan <strong>otomatis mengingatkan & menyertakan SJ Pengganti</strong> saat Kitchen memproses persetujuan stok reguler untuk outlet ini di menu <em>Permintaan</em>.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>

              {(isAlreadyReceived || waktuPenggantian === 'sekarang') ? (
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isAlreadyReceived ? 'Terbitkan SJ Pengganti Sekarang' : 'Setujui & Terbitkan SJ Pengganti'}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-800 hover:bg-purple-900 shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan untuk Pengiriman Reguler
                </button>
              )}
            </div>
          </form>
      </div>
    </div>

    {/* Lightbox Modal Bukti Foto */}
    {selectedPhoto && (
      <div
        className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        onClick={() => setSelectedPhoto(null)}
      >
        <div
          className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 bg-amber-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold truncate">
              <Scale size={16} className="text-amber-400 shrink-0" />
              <span className="truncate">{selectedPhoto.title}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-4 bg-[#1e1b15] flex items-center justify-center min-h-[300px]">
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.title}
              className="max-h-[70vh] w-auto object-contain rounded-lg"
            />
          </div>
          <div className="p-3 bg-amber-50/50 text-center text-xs text-gray-500 font-medium border-t border-amber-100">
            Perhatikan display timbangan digital dari outlet untuk mencocokkan gramatur sebelum input fisik kitchen.
          </div>
        </div>
      </div>
    )}
  </>
  )
}
