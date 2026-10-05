'use client'
import { useCallback, useEffect, useState } from 'react'
import { bacaSetelan, type Setelan } from './avatar/setelan'

const KUNCI_SETELAN = 'sukaBot.setelan'

function baca(): Setelan {
  try { return bacaSetelan(localStorage.getItem(KUNCI_SETELAN)) } catch { return bacaSetelan(null) }
}

/** Setelan widget per perangkat — ukuran yang nyaman bergantung layar. Hanya dipakai di klien (widget ssr:false). */
export function useSetelan(): { setelan: Setelan; ubah: (perubahan: Partial<Setelan>) => void } {
  const [setelan, setSetelan] = useState<Setelan>(baca)
  useEffect(() => {
    try { localStorage.setItem(KUNCI_SETELAN, JSON.stringify(setelan)) } catch { /* abaikan */ }
  }, [setelan])
  const ubah = useCallback((perubahan: Partial<Setelan>) => setSetelan((s) => ({ ...s, ...perubahan })), [])
  return { setelan, ubah }
}
