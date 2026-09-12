'use client'
import { useState } from 'react'
import { useAuth } from '@suka/auth'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'
import { TerimaVendorForm } from '@/components/stok/TerimaVendorForm'
import { useDaftarTerimaVendorSaya, useKoreksiTerimaVendor } from '@/hooks/useTerimaVendor'
import { canCatatTerimaVendor } from '@/lib/stok/approver'

// WIB = UTC+7. Nilai ini hanya dipakai sebagai parameter query (bukan
// dirender ke DOM), jadi lazy initializer useState (sekali saat render
// pertama) cukup aman -- berbeda dari tanggal di TerimaVendorForm yang
// dirender ke <input value>, di sana wajib lewat useEffect.
function tanggalWIB(offsetHari: number): string {
  return new Date(Date.now() + 7 * 3600 * 1000 - offsetHari * 86400000).toISOString().slice(0, 10)
}

const STATUS_LABEL: Record<string, string> = {
  dicatat: 'Menunggu nota',
  disahkan: 'Disahkan',
  ditolak: 'Ditolak',
}

export default function TerimaVendorPage() {
  const { outletStaff } = useAuth()
  const [rentang] = useState(() => ({ dari: tanggalWIB(6), sampai: tanggalWIB(0) }))
  const { data: baris = [] } = useDaftarTerimaVendorSaya(rentang.dari, rentang.sampai)
  const koreksi = useKoreksiTerimaVendor()

  // Selalu outlet SENDIRI -- sengaja tidak memakai OutletSwitcher (useOutletScope):
  // RPC mencatat ke outlet_staff.outlet_id apa pun yang dipilih di UI, jadi
  // memilih outlet lain di sini hanya akan mencatat ke outlet sendiri juga
  // (menyesatkan). Lihat spec §6: crew hanya boleh mencatat untuk outletnya.
  const outletId = outletStaff?.outlet_id ?? null

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#701604] mx-auto" />
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Memuat…</p>
        </div>
      </div>
    )
  }

  if (!canCatatTerimaVendor(outletId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1] text-center px-6">
        <p className="text-xs font-bold text-gray-500">Akun tidak terhubung ke outlet mana pun.</p>
      </div>
    )
  }

  const ubah = async (id: string, qtyLama: number, satuan: string) => {
    const s = window.prompt(`Jumlah yang benar (${satuan}):`, String(qtyLama))
    if (s == null) return
    const n = Number(s)
    if (!(n > 0)) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }
    try {
      await koreksi.mutateAsync({ id, qty: n })
      toast.success('Dikoreksi — stok ikut menyesuaikan')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight truncate">
              Terima dari Vendor
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
              Catat kiriman langsung vendor (mis. sayur Pak Aziz)
            </p>
          </div>
          <UserAvatarDropdown />
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
          <TerimaVendorForm outletId={outletId!} />

          <section>
            <h2 className="text-xs font-bold uppercase text-[#544437] mb-2">7 Hari Terakhir</h2>
            <ul className="space-y-2">
              {baris.map((b) => (
                <li
                  key={b.id}
                  className="bg-white rounded-xl p-3 border border-[#d9c2b2]/40 flex items-center justify-between text-sm gap-2"
                >
                  <span className="min-w-0 truncate">
                    {b.tanggal_terima} · {b.bahan_nama} · {b.qty.toLocaleString('id-ID')} {b.satuan}
                  </span>
                  <span className="flex gap-2 items-center shrink-0">
                    <span className="text-xs text-[#544437]/80">{STATUS_LABEL[b.status] ?? b.status}</span>
                    {b.status === 'dicatat' && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#904d00] underline"
                        onClick={() => ubah(b.id, b.qty, b.satuan)}
                      >
                        Koreksi
                      </button>
                    )}
                  </span>
                </li>
              ))}
              {baris.length === 0 && <li className="text-xs text-gray-500">Belum ada catatan.</li>}
            </ul>
          </section>
        </main>
      </div>
    </AppLayout>
  )
}
