'use client'

import React, { useState, useEffect, useRef } from 'react'
import { IsiPesan } from './IsiPesan'
import { QuickChips } from './QuickChips'
import { kirimPesanBotMarcom } from '@/app/actions/botMarcom'

export interface PesanItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  waktu: string
}

interface PanelBotMarcomProps {
  onTutup: () => void
}

const PESAN_AWAL: PesanItem = {
  id: 'pesan-awal',
  role: 'assistant',
  content:
    'Halo! Saya **Bot Marcom Suka Shawarma** 🍗✨\n\n' +
    'Saya terhubung langsung ke data operasional Marcom dan siap membantu Anda:\n' +
    '- Cek jadwal & status konten TikTok/IG Reels\n' +
    '- Pantau review draft & visit endorsement KOL\n' +
    '- Analisis metrik performa views, reach, dan ER%\n' +
    '- Cek sisa budget marketing & status ads\n' +
    '- Pantau promo & event yang aktif di outlet\n\n' +
    'Ada yang bisa saya bantu hari ini?',
  waktu: 'Baru saja',
}

const STORAGE_KEY = 'ss_marcom_bot_history'

export function PanelBotMarcom({ onTutup }: PanelBotMarcomProps) {
  const [messages, setMessages] = useState<PesanItem[]>([PESAN_AWAL])
  const [inputPesan, setInputPesan] = useState('')
  const [loading, setLoading] = useState(false)
  const pesanEndRef = useRef<HTMLDivElement>(null)

  // Load history dari localStorage saat mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch (_) {
      // Abaikan jika localStorage tidak tersedia
    }
  }, [])

  // Simpan history ke localStorage setiap update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch (_) {
      // Abaikan
    }
  }, [messages])

  // Scroll otomatis ke bawah
  useEffect(() => {
    pesanEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleKirim = async (teks: string) => {
    const bersih = teks.trim()
    if (!bersih || loading) return

    const now = new Date()
    const waktuStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`

    const userMsg: PesanItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: bersih,
      waktu: waktuStr,
    }

    const riwayatKirim = [...messages, userMsg]
    setMessages(riwayatKirim)
    setInputPesan('')
    setLoading(true)

    try {
      const res = await kirimPesanBotMarcom(
        bersih,
        riwayatKirim.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }))
      )

      const botMsg: PesanItem = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.success && res.balasan
          ? res.balasan
          : res.error || 'Maaf, terjadi kendala saat memproses pertanyaan Anda.',
        waktu: waktuStr,
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: 'Maaf, terjadi kesalahan koneksi internal. Silakan coba kembali.',
          waktu: waktuStr,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = () => {
    setMessages([PESAN_AWAL])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (_) {}
  }

  return (
    <div className="flex flex-col h-[520px] w-[360px] sm:w-[410px] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-stone-800 animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base font-bold shadow-inner">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">Bot Marcom</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </div>
            <p className="text-[11px] text-orange-100 font-light">
              Asisten Cerdas Marketing Suka Shawarma
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClearHistory}
            title="Bersihkan riwayat percakapan"
            className="p-1.5 text-orange-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            🧹
          </button>
          <button
            type="button"
            onClick={onTutup}
            title="Tutup jendela chat"
            className="p-1.5 text-orange-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer font-bold text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-stone-50/60 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                msg.role === 'user'
                  ? 'bg-orange-600 text-white rounded-br-2xs'
                  : 'bg-white border border-stone-200 text-stone-800 rounded-bl-2xs'
              }`}
            >
              <IsiPesan teks={msg.content} role={msg.role} />
            </div>
            <span className="text-[10px] text-stone-400 mt-1 px-1">
              {msg.waktu}
            </span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-stone-500 bg-white border border-stone-200 rounded-2xl px-3.5 py-2.5 w-fit shadow-xs">
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"></span>
            </span>
            <span className="text-[11px] text-stone-600">
              Bot Marcom sedang memproses data...
            </span>
          </div>
        )}

        <div ref={pesanEndRef} />
      </div>

      {/* Quick Chips & Footer Input */}
      <div className="p-3 bg-white border-t border-stone-100 flex flex-col gap-2">
        <QuickChips onPilih={(prompt) => handleKirim(prompt)} disabled={loading} />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleKirim(inputPesan)
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPesan}
            onChange={(e) => setInputPesan(e.target.value)}
            placeholder="Tanyakan jadwal, endorsement, budget, promo..."
            disabled={loading}
            className="flex-1 rounded-xl border border-stone-200 px-3.5 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !inputPesan.trim()}
            className="rounded-xl bg-orange-600 px-3.5 py-2 text-white font-medium text-xs hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer shadow-xs shrink-0"
          >
            Kirim
          </button>
        </form>
      </div>
    </div>
  )
}
