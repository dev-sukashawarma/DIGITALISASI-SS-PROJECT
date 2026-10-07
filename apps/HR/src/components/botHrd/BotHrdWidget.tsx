'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { MessageCircle } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'
import { bacaPosisi, jepitKeLayar, posisiPanelDekatTombol, simpanPosisi, type Titik, type Ukuran } from '@/lib/botHrd/posisi'
import { useGeser } from './useGeser'

// Panel dimuat saat dibuka saja (tak menambah bundel halaman awal).
const PanelBotHrd = dynamic(() => import('./PanelBotHrd').then((m) => m.PanelBotHrd), { ssr: false })

const ROLE_BOT = new Set(['ADMIN_HR', 'OWNER', 'ADMIN', 'DEVELOPER'])

const UKURAN_TOMBOL: Ukuran = { lebar: 56, tinggi: 56 }
const LEBAR_DESKTOP = 640 // sm: panel penuh layar di bawah ini (tanpa geser)

const layarSaatIni = (): Ukuran => ({ lebar: window.innerWidth, tinggi: window.innerHeight })
const ukuranPanelDesktop = (): Ukuran => ({
  lebar: Math.min(400, window.innerWidth - 16),
  tinggi: Math.min(600, window.innerHeight - 32),
})

/**
 * Tombol & panel bisa digeser. Posisi TOMBOL disimpan per perangkat (localStorage,
 * 'botHrd.posisi'); posisi PANEL diturunkan dari tombol setiap kali dibuka (di atas/kiri
 * tombol, dibalik bila tak muat) lalu bisa digeser lewat header selama terbuka.
 */
export function BotHrdWidget() {
  const { role } = useRole()
  const [buka, setBuka] = useState(false)
  const [posisiTombol, setPosisiTombol] = useState<Titik | null>(null) // null = posisi bawaan (CSS)
  const [posisiPanel, setPosisiPanel] = useState<Titik | null>(null)
  const [desktop, setDesktop] = useState(true)
  const tombolRef = useRef<HTMLButtonElement>(null)

  // Pulihkan posisi tersimpan setelah mount (SSR aman) + pantau ukuran layar.
  useEffect(() => {
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
        <div className={desktop ? 'fixed z-50' : 'fixed inset-0 z-50'} style={stylePanel}>
          <PanelBotHrd onTutup={() => setBuka(false)} gagangGeser={desktop ? geserPanel.bind : undefined} />
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
