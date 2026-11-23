'use client'

import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  end: number
  duration?: number
  separator?: string
  prefix?: string
  suffix?: string
  decimals?: number
}

function formatWithSeparator(value: number, separator: string, decimals: number): string {
  const fixed = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()
  const [intPart, decPart] = fixed.split('.')
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  return decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt
}

export default function CountUp({
  end,
  duration = 0.8,
  separator = '.',
  prefix = '',
  suffix = '',
  decimals = 0,
}: CountUpProps) {
  const safeEnd = Number.isFinite(end) ? end : 0
  const [display, setDisplay] = useState<number>(safeEnd)
  const prevEndRef = useRef<number>(safeEnd)

  useEffect(() => {
    const startVal = prevEndRef.current
    const targetVal = safeEnd
    prevEndRef.current = targetVal

    if (startVal === targetVal || duration <= 0) {
      setDisplay(targetVal)
      return
    }

    let rafId = 0
    const startTime = performance.now()
    const totalMs = Math.max(150, duration * 1000)

    const tick = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(1, elapsed / totalMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(startVal + (targetVal - startVal) * eased)
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        setDisplay(targetVal)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [safeEnd, duration])

  return (
    <>
      {prefix}
      {formatWithSeparator(display, separator, decimals)}
      {suffix}
    </>
  )
}
