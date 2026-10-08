'use client'

import React from 'react'

interface IsiPesanProps {
  teks: string
  role: 'user' | 'assistant'
}

export function IsiPesan({ teks, role }: IsiPesanProps) {
  // Format teks dengan baris baru dan cetak tebal sederhana
  const renderParagraf = (konten: string) => {
    const baris = konten.split('\n')

    return baris.map((b, idx) => {
      // Baris kosong
      if (!b.trim()) {
        return <div key={idx} className="h-2" />
      }

      // Bullet point
      if (b.trim().startsWith('- ') || b.trim().startsWith('* ')) {
        const itemTeks = b.trim().slice(2)
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-2 my-0.5">
            <span className="text-orange-500 font-bold">•</span>
            <span>{parseFormatTeks(itemTeks)}</span>
          </div>
        )
      }

      // Paragraf biasa
      return (
        <p key={idx} className="my-0.5 leading-relaxed">
          {parseFormatTeks(b)}
        </p>
      )
    })
  }

  // Parse markdown bold **teks**
  const parseFormatTeks = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-semibold text-stone-900">
            {part.slice(2, -2)}
          </strong>
        )
      }
      return part
    })
  }

  return (
    <div
      className={`text-xs md:text-sm ${
        role === 'user'
          ? 'text-white'
          : 'text-stone-800'
      }`}
    >
      {renderParagraf(teks)}
    </div>
  )
}
