'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  Trash2,
  Minimize2,
  ChevronDown,
  RefreshCw,
  Flame,
  Lightbulb,
  TrendingUp,
  Volume2,
} from 'lucide-react'
import { askNayraAction, ChatMessage } from '@/app/actions/nayra-chat'

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'Halo Kak! Aku **Nayra**, Marketing & Communication Bot Suka Shawarma! 🌯✨\n\nAda yang bisa Nayra bantu seputar ide konten viral, hook 3 detik, audit draf video, atau strategi promo hari ini?',
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  },
]

const QUICK_PROMPTS = [
  { label: '🌯 3 Ide Konten TikTok', prompt: 'Beri 3 ide konten TikTok viral untuk Suka Shawarma minggu ini' },
  { label: '🎯 Hook 3 Detik', prompt: 'Buatkan 3 hook 3 detik pembuka video kuliner yang scroll-stopping' },
  { label: '📈 Tips Naikkan Views', prompt: 'Bagaimana tips meningkatkan watch-time & views draf video marcom?' },
  { label: '📢 Draf Caption Promo', prompt: 'Buatkan draf caption & hashtag Instagram promo shawarma hemat' },
]

export default function NayraBotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [showSpeechBubble, setShowSpeechBubble] = useState(true)
  const [speechBubbleText, setSpeechBubbleText] = useState(
    'Halo! Nayra siap bantu strategi marketing & konten! ✨'
  )
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load chat history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nayra_marcom_chat')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // Save chat history to localStorage
  useEffect(() => {
    try {
      if (messages.length > 1) {
        localStorage.setItem('nayra_marcom_chat', JSON.stringify(messages))
      }
    } catch {
      // ignore
    }
  }, [messages])

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, isMinimized, isLoading])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150)
      setShowSpeechBubble(false)
    }
  }, [isOpen, isMinimized])

  // Periodic speech bubble tips
  useEffect(() => {
    const tips = [
      'Mau Nayra bantu buat hook 3 detik video TikTok? 🎯',
      'Lagi butuh ide promo atau caption Instagram? Tanya Nayra ya! 🌯',
      'Yuk evaluasi draf video konten kamu biar makin viral! ✨',
      'Ada yang mau didiskusikan seputar strategi marcom hari ini? 💡',
    ]

    const interval = setInterval(() => {
      if (!isOpen) {
        const randomTip = tips[Math.floor(Math.random() * tips.length)]
        setSpeechBubbleText(randomTip)
        setShowSpeechBubble(true)
        setTimeout(() => setShowSpeechBubble(false), 8000)
      }
    }, 45000)

    return () => clearInterval(interval)
  }, [isOpen])

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim()
    if (!text || isLoading) return

    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: time }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputValue('')
    setIsLoading(true)

    try {
      const res = await askNayraAction(newMessages)
      if (res.success && res.reply) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } else {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: res.error || 'Maaf Kak, Nayra sedang ada kendala teknis. Coba lagi sebentar ya!',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } catch {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Maaf Kak, koneksi sedang terputus. Silakan coba lagi ya!',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  // Clear chat
  const handleClearChat = () => {
    if (confirm('Hapus riwayat obrolan dengan Nayra?')) {
      setMessages(INITIAL_MESSAGES)
      localStorage.removeItem('nayra_marcom_chat')
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end select-none">
      {/* Speech Bubble Sapaan */}
      {!isOpen && showSpeechBubble && (
        <div
          onClick={() => setIsOpen(true)}
          className="mb-2 mr-2 p-3 bg-white border border-[#EFE8DE] rounded-2xl shadow-xl max-w-xs text-xs font-semibold text-stone-800 cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 relative group hover:border-[#D9480F]/50 transition-all"
        >
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#D9480F] shrink-0 mt-0.5" />
            <p className="leading-snug text-stone-700">{speechBubbleText}</p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowSpeechBubble(false)
              }}
              className="text-stone-400 hover:text-stone-600 ml-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {/* Arrow */}
          <div className="absolute -bottom-1.5 right-8 w-3 h-3 bg-white border-r border-b border-[#EFE8DE] rotate-45" />
        </div>
      )}

      {/* Floating Mascot Character Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative group cursor-pointer focus:outline-none transition-transform active:scale-95"
          aria-label="Buka Chat Nayra Bot MARCOM"
        >
          {/* Glowing Aura Ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#D9480F]/30 to-purple-500/20 blur-md group-hover:blur-lg transition-all" />

          {/* Nayra Character Image */}
          <div className="relative w-20 h-28 sm:w-24 sm:h-32 transition-transform duration-300 group-hover:-translate-y-1">
            <Image
              src="/nayra/nayra_hero.png"
              alt="Nayra Marketing Bot"
              fill
              className="object-contain drop-shadow-2xl"
              priority
            />
          </div>

          {/* Status Badge */}
          <div className="absolute bottom-1 right-2 bg-white/95 backdrop-blur-xs border border-[#EFE8DE] rounded-full px-2 py-0.5 flex items-center gap-1 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-stone-800 tracking-tight">Nayra</span>
          </div>
        </button>
      )}

      {/* Chat Window Panel */}
      {isOpen && (
        <div
          className={`w-[90vw] sm:w-[410px] bg-white rounded-3xl border border-[#EFE8DE] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 animate-in fade-in zoom-in-95 ${
            isMinimized ? 'h-14' : 'h-[560px] max-h-[82vh]'
          }`}
        >
          {/* Header Panel */}
          <div className="bg-gradient-to-r from-[#1A1715] to-[#292524] text-white p-3.5 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-white/10 p-0.5 border border-white/20 overflow-hidden shrink-0">
                <Image
                  src="/nayra/nayra_avatar.png"
                  alt="Nayra Avatar"
                  fill
                  className="object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#1A1715] rounded-full" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-xs sm:text-sm tracking-tight text-white">
                    Nayra
                  </h3>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#D9480F] text-white font-bold">
                    MARCOM AI
                  </span>
                </div>
                <p className="text-[10px] text-stone-300">
                  {isLoading ? 'Sedang merancang respon...' : 'Online • Siap membantu kampanye'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-stone-300">
              <button
                type="button"
                onClick={handleClearChat}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Hapus riwayat obrolan"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title={isMinimized ? 'Perbesar panel' : 'Kecilkan panel'}
              >
                {isMinimized ? <ChevronDown className="w-4 h-4 rotate-180" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Body & Messages */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAF8F5]/60 text-xs">
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user'
                  return (
                    <div
                      key={index}
                      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="relative w-7 h-7 rounded-lg overflow-hidden shrink-0 mt-0.5 border border-[#EFE8DE] shadow-2xs">
                          <Image
                            src="/nayra/nayra_avatar.png"
                            alt="Nayra"
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}

                      <div
                        className={`max-w-[82%] rounded-2xl p-3 leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-gradient-to-r from-[#D9480F] to-[#EA580C] text-white shadow-xs font-medium rounded-tr-xs'
                            : 'bg-white border border-[#EFE8DE] text-stone-800 shadow-2xs font-normal rounded-tl-xs'
                        }`}
                      >
                        <div>{msg.content}</div>
                        {msg.timestamp && (
                          <div
                            className={`text-[9px] mt-1 text-right font-mono ${
                              isUser ? 'text-white/70' : 'text-stone-400'
                            }`}
                          >
                            {msg.timestamp}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-2.5 items-start">
                    <div className="relative w-7 h-7 rounded-lg overflow-hidden shrink-0 mt-0.5 border border-[#EFE8DE]">
                      <Image
                        src="/nayra/nayra_avatar.png"
                        alt="Nayra"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="bg-white border border-[#EFE8DE] rounded-2xl rounded-tl-xs p-3 shadow-2xs flex items-center gap-2 text-stone-500">
                      <div className="flex space-x-1">
                        <span className="w-1.5 h-1.5 bg-[#D9480F] rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-[#D9480F] rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-[#D9480F] rounded-full animate-bounce" />
                      </div>
                      <span className="text-[11px] font-medium text-stone-500">
                        Nayra sedang berpikir...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="px-3 py-2 bg-white border-t border-[#EFE8DE]/80 overflow-x-auto flex gap-1.5 no-scrollbar shrink-0">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(qp.prompt)}
                    disabled={isLoading}
                    className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-[#FAF8F5] hover:bg-[#FFF4ED] hover:border-[#D9480F]/40 border border-[#EFE8DE] text-[10px] font-bold text-stone-700 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>

              {/* Input Footer */}
              <div className="p-3 bg-white border-t border-[#EFE8DE] shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSendMessage()
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ketik pertanyaan untuk Nayra..."
                    disabled={isLoading}
                    className="flex-1 px-3.5 py-2 text-xs border border-[#EFE8DE] rounded-2xl bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#D9480F] transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="w-8 h-8 rounded-xl bg-[#D9480F] hover:bg-[#C03E0B] text-white flex items-center justify-center transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
                <div className="mt-1 text-[9px] text-center text-stone-400">
                  Nayra Marketing & Communication Bot • Suka Shawarma
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
