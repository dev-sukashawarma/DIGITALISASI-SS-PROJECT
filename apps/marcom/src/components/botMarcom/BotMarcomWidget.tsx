'use client'

import React, { useState } from 'react'
import { PanelBotMarcom } from './PanelBotMarcom'

export function BotMarcomWidget() {
  const [buka, setBuka] = useState(false)

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {buka && (
        <div className="mb-3">
          <PanelBotMarcom onTutup={() => setBuka(false)} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setBuka(!buka)}
        aria-label="Buka Chat Bot Marcom"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/80"
      >
        {buka ? (
          <span className="text-xl font-bold">✕</span>
        ) : (
          <>
            <span className="text-2xl animate-pulse">🤖</span>
            {/* Online Indicator Badge */}
            <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
            </span>
          </>
        )}

        {/* Hover Tooltip saat tertutup */}
        {!buka && (
          <span className="absolute right-16 top-1/2 -translate-y-1/2 rounded-lg bg-stone-900/90 text-white text-[11px] font-medium py-1 px-2.5 shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Tanya Bot Marcom
          </span>
        )}
      </button>
    </div>
  )
}
