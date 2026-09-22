'use client'

import { useState, useEffect } from 'react'
import {
  X,
  ExternalLink,
  Play,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  Eye,
  RefreshCw,
  AlertCircle,
  Video,
} from 'lucide-react'
import { PlatformIcon } from '@/components/icons/SocialIcons'
import {
  SerializedEndorsement,
  SerializedEndorsementPost,
  getPlatformBadgeConfig,
} from './EndorsementList'
import { resolveVideoEmbedInfo } from '@/app/actions/endorsements'

interface VideoPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  endorsement: SerializedEndorsement | null
  initialPostId?: string | null
}

function getLocalEmbedUrl(url: string): { embedUrl: string | null; platform: string } {
  const trimmed = (url || '').trim()
  const lower = trimmed.toLowerCase()

  if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
    const m = trimmed.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/i)
    if (m && m[2]) {
      return { embedUrl: `https://www.instagram.com/reel/${m[2]}/embed/`, platform: 'IG_REEL' }
    }
  }

  if (lower.includes('tiktok.com')) {
    const m = trimmed.match(/\/video\/(\d+)/i)
    if (m && m[1]) {
      return { embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`, platform: 'TIKTOK' }
    }
  }

  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    const shortsMatch = trimmed.match(/\/shorts\/([A-Za-z0-9_-]+)/i)
    if (shortsMatch && shortsMatch[1]) {
      return {
        embedUrl: `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}?autoplay=1&rel=0`,
        platform: 'YOUTUBE_SHORTS',
      }
    }
    const vMatch = trimmed.match(/(?:v=|\/)([A-Za-z0-9_-]{11})(?:\?|&|$)/i)
    if (vMatch && vMatch[1]) {
      return {
        embedUrl: `https://www.youtube-nocookie.com/embed/${vMatch[1]}?autoplay=1&rel=0`,
        platform: 'YOUTUBE_SHORTS',
      }
    }
  }

  if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
    return {
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false`,
      platform: 'FACEBOOK',
    }
  }

  return { embedUrl: null, platform: 'UNKNOWN' }
}

export default function VideoPreviewModal({
  isOpen,
  onClose,
  endorsement,
  initialPostId,
}: VideoPreviewModalProps) {
  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Normalize posts list
  const posts: Array<
    SerializedEndorsementPost | {
      id: string
      platform: string
      postUrl: string
      customPlatformName?: string | null
      views?: number
      likes?: number
      comments?: number
      shares?: number
      saves?: number
    }
  > =
    endorsement?.posts && endorsement.posts.length > 0
      ? endorsement.posts
      : endorsement?.postUrl
      ? [
          {
            id: 'default',
            platform: endorsement.type || 'TIKTOK',
            postUrl: endorsement.postUrl,
            customPlatformName: null,
            views: endorsement.finalViews || 0,
            likes: endorsement.likes || 0,
            comments: endorsement.comments || 0,
            shares: endorsement.shares || 0,
            saves: endorsement.saves || 0,
          },
        ]
      : []

  // Initialize active post
  useEffect(() => {
    if (!isOpen || !endorsement) return

    if (initialPostId && posts.some((p) => p.id === initialPostId)) {
      setActivePostId(initialPostId)
    } else if (posts.length > 0) {
      setActivePostId(posts[0].id)
    } else {
      setActivePostId(null)
    }
  }, [isOpen, endorsement, initialPostId])

  // Resolve embed URL whenever active post changes
  useEffect(() => {
    if (!isOpen || !activePostId) return

    const currentPost = posts.find((p) => p.id === activePostId)
    if (!currentPost || !currentPost.postUrl) {
      setEmbedUrl(null)
      setIsLoading(false)
      setErrorMessage('Link postingan video tidak ditemukan.')
      return
    }

    setIframeLoaded(false)
    setErrorMessage(null)

    // Check instant local resolution
    const local = getLocalEmbedUrl(currentPost.postUrl)
    if (local.embedUrl) {
      setEmbedUrl(local.embedUrl)
      setIsLoading(false)
      return
    }

    // Otherwise, resolve via server action (for short URLs like vt.tiktok.com)
    let isMounted = true
    setIsLoading(true)

    resolveVideoEmbedInfo(currentPost.postUrl, currentPost.platform)
      .then((res) => {
        if (!isMounted) return
        if (res.canEmbed && res.embedUrl) {
          setEmbedUrl(res.embedUrl)
        } else {
          setEmbedUrl(null)
          setErrorMessage('Platform ini tidak mendukung embed langsung atau membutuhkan otentikasi.')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('Failed to resolve video embed:', err)
        setEmbedUrl(null)
        setErrorMessage('Gagal memuat pratinjau video.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, activePostId])

  if (!isOpen || !endorsement) return null

  const activePost = posts.find((p) => p.id === activePostId) || posts[0]
  const pConfig = activePost
    ? getPlatformBadgeConfig(activePost.platform, activePost.customPlatformName)
    : { label: 'Video', shortLabel: 'Video', badgeClass: 'bg-stone-800 text-white' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-[#181615] border border-stone-800 text-stone-100 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800/80 flex items-center justify-between bg-stone-900/60 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-stone-900 border border-stone-700/80 text-white flex items-center justify-center shrink-0 shadow-xs">
              <PlatformIcon platform={activePost?.platform || ''} className="w-5 h-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-sm sm:text-base truncate">
                  {endorsement.kol.name}
                </h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${pConfig.badgeClass}`}>
                  <PlatformIcon platform={activePost?.platform || ''} className="w-3 h-3 shrink-0" />
                  <span>{pConfig.shortLabel}</span>
                </span>
              </div>
              <p className="text-xs text-stone-400 truncate mt-0.5">
                Cabang: <strong className="text-stone-300">{endorsement.outlet.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activePost?.postUrl && (
              <a
                href={activePost.postUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors"
                title={`Buka di ${pConfig.label}`}
              >
                <span>Buka Asli</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Multi-Platform Post Switcher (Tabs) */}
        {posts.length > 1 && (
          <div className="px-4 py-2.5 bg-stone-950/60 border-b border-stone-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
            <span className="text-[11px] font-medium text-stone-400 shrink-0">Platform:</span>
            {posts.map((p) => {
              const conf = getPlatformBadgeConfig(p.platform, p.customPlatformName)
              const isActive = p.id === activePostId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePostId(p.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-[#D9480F] text-white shadow-sm'
                      : 'bg-stone-800/80 text-stone-300 hover:bg-stone-700 hover:text-white'
                  }`}
                >
                  <PlatformIcon platform={p.platform} className="w-3.5 h-3.5 shrink-0" />
                  <span>{conf.shortLabel}</span>
                  <span className="text-[10px] opacity-75 font-mono">
                    ({(p.views || 0).toLocaleString('id-ID')})
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Video Canvas Body */}
        <div className="p-3 sm:p-5 flex flex-col items-center justify-center bg-stone-950/40 overflow-y-auto flex-1">
          {/* Smartphone Frame Container */}
          <div className="w-full max-w-[340px] sm:max-w-[360px] aspect-[9/16] max-h-[540px] sm:max-h-[580px] bg-black rounded-2xl overflow-hidden relative border border-stone-800 shadow-2xl flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-[#D9480F] animate-spin" />
                <p className="text-xs text-stone-400 font-medium">Menyiapkan pemutar video...</p>
              </div>
            ) : embedUrl ? (
              <>
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 space-y-2">
                    <RefreshCw className="w-6 h-6 text-[#D9480F] animate-spin" />
                    <span className="text-[11px] text-stone-400">Memuat konten video...</span>
                  </div>
                )}
                <iframe
                  src={embedUrl}
                  className="w-full h-full border-0 rounded-2xl"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onLoad={() => setIframeLoaded(true)}
                  title={`Video ${endorsement.kol.name} (${pConfig.label})`}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-300">
                  <PlatformIcon platform={activePost?.platform || ''} className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-stone-200 text-sm">Pratinjau Tidak Tersedia</h4>
                  <p className="text-xs text-stone-400 max-w-[240px]">
                    {errorMessage || 'Video ini memerlukan pembukaan langsung di platform aplikasi resminya.'}
                  </p>
                </div>
                {activePost?.postUrl && (
                  <a
                    href={activePost.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D9480F] hover:bg-[#B83808] text-white text-xs font-bold transition-all shadow-md"
                  >
                    <PlatformIcon platform={activePost.platform} className="w-3.5 h-3.5" />
                    <span>Tonton di {pConfig.label}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>

          <p className="text-[11px] text-stone-400 text-center mt-3 max-w-xs">
            Memutar via embed resmi <strong className="text-stone-300">{pConfig.label}</strong>. Jika video terhenti atau dibatasi kebijakan privasi browser, gunakan tombol &quot;Buka Asli&quot;.
          </p>
        </div>

        {/* Footer: Live Metrics Summary */}
        {activePost && (
          <div className="p-3.5 sm:p-4 border-t border-stone-800/80 bg-stone-900/60 flex items-center justify-between gap-2 flex-wrap flex-shrink-0 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-800 text-stone-200 font-mono font-bold" title="Views">
                <Eye className="w-3 h-3 text-stone-400" />
                <span>{(activePost.views || 0).toLocaleString('id-ID')}</span>
              </span>
              {(activePost.likes || 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/60 border border-rose-800/50 text-rose-300 font-mono font-semibold" title="Likes">
                  <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
                  <span>{(activePost.likes || 0).toLocaleString('id-ID')}</span>
                </span>
              )}
              {(activePost.comments || 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/60 border border-blue-800/50 text-blue-300 font-mono font-semibold" title="Comments">
                  <MessageSquare className="w-3 h-3 text-blue-400" />
                  <span>{(activePost.comments || 0).toLocaleString('id-ID')}</span>
                </span>
              )}
              {(activePost.shares || 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-mono font-semibold" title="Shares">
                  <Share2 className="w-3 h-3 text-emerald-400" />
                  <span>{(activePost.shares || 0).toLocaleString('id-ID')}</span>
                </span>
              )}
              {(activePost.saves || 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-300 font-mono font-semibold" title="Saves">
                  <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>{(activePost.saves || 0).toLocaleString('id-ID')}</span>
                </span>
              )}
            </div>

            {activePost.postUrl && (
              <a
                href={activePost.postUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#D9480F] hover:underline font-bold flex items-center gap-1 ml-auto"
              >
                <span>Buka Link Tab Baru</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
