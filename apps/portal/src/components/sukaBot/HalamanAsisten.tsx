'use client'
import { useEffect, useState } from 'react'
import AvatarSukaBot, { type Pose } from './AvatarSukaBot'
import PanelSukaBot from './PanelSukaBot'

/** Isi /asisten (cek role admin/owner/developer dilakukan di page.tsx sebelum ini dirender). */
export default function HalamanAsisten({ apiBase }: { apiBase: string }) {
  const [pose, setPose] = useState<Pose>('rekap')
  const [ketukan, setKetukan] = useState(0)
  // Default desktop agar render server & klien sama; HP disetel setelah mount.
  const [tinggi, setTinggi] = useState(180)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const atur = () => setTinggi(mq.matches ? 110 : 180)
    atur()
    mq.addEventListener('change', atur)
    return () => mq.removeEventListener('change', atur)
  }, [])

  return (
    <div className="flex flex-col md:flex-row md:items-end gap-4">
      <button type="button" aria-label="SUKA Bot" onClick={() => setKetukan((n) => n + 1)} className="self-center md:self-end shrink-0">
        <AvatarSukaBot pose={pose} tinggi={tinggi} ketukan={ketukan} />
      </button>
      <div className="flex-1 min-w-0">
        <PanelSukaBot apiBase={apiBase} penuh onPose={setPose} />
      </div>
    </div>
  )
}
