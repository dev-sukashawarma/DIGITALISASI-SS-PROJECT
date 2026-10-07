'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronUp, MessageCircle, X } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'
import { bacaBesar, bacaPosisi, jepitKeLayar, posisiPanelDekatTombol, simpanBesar, simpanPosisi, ukuranPanel, type Titik, type Ukuran } from '@/lib/botHrd/posisi'
import { useGeser } from './useGeser'

// Panel dimuat saat dibuka saja (tak menambah bundel halaman awal).
const PanelBotHrd = dynamic(() => import('./PanelBotHrd').then((m) => m.PanelBotHrd), { ssr: false })

const ROLE_BOT = new Set(['ADMIN_HR', 'OWNER', 'ADMIN', 'DEVELOPER'])

const UKURAN_TOMBOL: Ukuran = { lebar: 56, tinggi: 56 }
const LEBAR_DESKTOP = 640 // sm: panel penuh layar di bawah ini (tanpa geser)

const layarSaatIni = (): Ukuran => ({ lebar: window.innerWidth, tinggi: window.innerHeight })

/**
 * Tombol & panel bisa digeser. Posisi TOMBOL disimpan per perangkat (localStorage,
 * 'botHrd.posisi'); posisi PANEL diturunkan dari tombol setiap kali dibuka (di atas/kiri
 * tombol, dibalik bila tak muat) lalu bisa digeser lewat header selama terbuka.
 */
export function BotHrdWidget() {
  const { role } = useRole()
  const [buka, setBuka] = useState(false)
  // Diminimize: panel tetap ter-mount (percakapan & aksi berjalan tak terputus), tampil sebagai bar kecil.
  const [kecil, setKecil] = useState(false)
  const [posisiTombol, setPosisiTombol] = useState<Titik | null>(null) // null = posisi bawaan (CSS)
  const [posisiPanel, setPosisiPanel] = useState<Titik | null>(null)
  const [desktop, setDesktop] = useState(true)
  const [besar, setBesar] = useState(false)
  const besarRef = useRef(false)
  besarRef.current = besar
  const ukuranPanelDesktop = useCallback((): Ukuran => ukuranPanel(besarRef.current, layarSaatIni()), [])
  const tombolRef = useRef<HTMLButtonElement>(null)

  // Pulihkan posisi tersimpan setelah mount (SSR aman) + pantau ukuran layar.
  useEffect(() => {
    setBesar(bacaBesar(window.localStorage))
    const tersimpan = bacaPosisi(window.localStorage)
    if (tersimpan) setPosisiTombol(jepitKeLayar(tersimpan, UKURAN_TOMBOL, layarSaatIni()))
    const mq = window.matchMedia(`(min-width: ${LEBAR_DESKTOP}px)`)
    const ubahMq = () => setDesktop(mq.matches)
    ubahMq()
    mq.addEventListener('change', ubahMq)
    const saatResize = () => {
      const layar = layarSaatIni()
      setPosisiTombol((p) => (p ? jepitKeLayar(p, UKURAN_TOMBOL, layar) : p))
      setPosisiPanel((p) => (p ? jepitKeLayar(p, ukuranPanelDesktop(), layar) : p))
    }
    window.addEventListener('resize', saatResize)
    return () => {
      mq.removeEventListener('change', ubahMq)
      window.removeEventListener('resize', saatResize)
    }
  }, [])

  const ambilPosisiTombol = useCallback((): Titik | null => {
    const r = tombolRef.current?.getBoundingClientRect()
    return r ? { x: r.left, y: r.top } : null
  }, [])

  const geserTombol = useGeser({
    ambilPosisi: ambilPosisiTombol,
    ambilUkuran: () => UKURAN_TOMBOL,
    onUbah: setPosisiTombol,
    onSelesai: (pos, bergeser) => {
      if (bergeser) simpanPosisi(window.localStorage, pos)
    },
  })

  const geserPanel = useGeser({
    ambilPosisi: () => posisiPanel,
    ambilUkuran: ukuranPanelDesktop,
    onUbah: setPosisiPanel,
    aktif: desktop,
  })

  // Bar minimize punya ukuran sendiri agar bisa digeser sampai tepi bawah layar.
  const UKURAN_BAR: Ukuran = { lebar: 256, tinggi: 44 }
  const geserBar = useGeser({
    ambilPosisi: () => posisiPanel,
    ambilUkuran: () => UKURAN_BAR,
    onUbah: setPosisiPanel,
    aktif: desktop,
  })

  function pulihkan() {
    // Saat dibuka kembali, pastikan panel penuh tetap muat di layar dari posisi bar.
    setPosisiPanel((p) => (p ? jepitKeLayar(p, ukuranPanelDesktop(), layarSaatIni()) : p))
    setKecil(false)
  }

  function toggleBesar() {
    const baru = !besar
    besarRef.current = baru
    setBesar(baru)
    simpanBesar(window.localStorage, baru)
    setPosisiPanel((p) => (p ? jepitKeLayar(p, ukuranPanelDesktop(), layarSaatIni()) : p))
  }

  function bukaPanel() {
    if (geserTombol.pernahGeser()) return // klik susulan setelah geseran bukan niat membuka
    if (window.innerWidth >= LEBAR_DESKTOP) {
      const t = ambilPosisiTombol() ?? { x: window.innerWidth - 80, y: window.innerHeight - 80 }
      setPosisiPanel(posisiPanelDekatTombol(t, UKURAN_TOMBOL, ukuranPanelDesktop(), layarSaatIni()))
    }
    setBuka(true)
  }

  if (!role || !ROLE_BOT.has(role)) return null

  const stylePanel =
    desktop && posisiPanel
      ? { left: posisiPanel.x, top: posisiPanel.y, width: ukuranPanelDesktop().lebar, height: ukuranPanelDesktop().tinggi }
      : undefined

  return (
    <>
      {buka && (
        <div className={`${desktop ? 'fixed z-50' : 'fixed inset-0 z-50'} ${kecil ? 'hidden' : ''}`} style={stylePanel}>
          <PanelBotHrd
            onTutup={() => {
              setKecil(false)
              setBuka(false)
            }}
            onMinimize={() => setKecil(true)}
            besar={besar}
            onToggleBesar={desktop ? toggleBesar : undefined}
            gagangGeser={desktop ? geserPanel.bind : undefined}
          />
        </div>
      )}
      {buka && kecil && (
        <div
          {...(desktop ? geserBar.bind : {})}
          style={desktop && posisiPanel ? { left: posisiPanel.x, top: posisiPanel.y } : undefined}
          className={`fixed z-50 flex w-64 touch-none select-none items-center gap-2 rounded-xl bg-[#4A1713] py-2 pl-3 pr-1.5 text-white shadow-lg ${
            desktop && posisiPanel ? 'cursor-grab' : 'bottom-24 right-4'
          }`}
        >
          <MessageCircle className="h-4 w-4 shrink-0 text-suka-orange" />
          {/* Judul = area geser; tombol ⌃ untuk membuka kembali. */}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">Bot HRD</span>
          <button type="button" onClick={pulihkan} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Buka kembali" title="Buka kembali">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setKecil(false)
              setBuka(false)
            }}
            className="rounded-lg p-1.5 hover:bg-white/10"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {!buka && (
        <button
          ref={tombolRef}
          type="button"
          {...geserTombol.bind}
          onClick={bukaPanel}
          style={posisiTombol ? { left: posisiTombol.x, top: posisiTombol.y } : undefined}
          className={`fixed z-40 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-suka-orange text-white shadow-lg transition-transform hover:scale-105 ${
            posisiTombol ? '' : 'bottom-24 right-4 lg:bottom-6 lg:right-6'
          }`}
          aria-label="Buka Bot HRD"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </>
  )
}
