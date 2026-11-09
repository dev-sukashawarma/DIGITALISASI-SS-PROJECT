import { supabaseAdmin } from '@/lib/server/telegram'

export interface KonfigurasiVoiceServer {
  elevenlabsApiKey: string
  elevenlabsVoiceId: string
  elevenlabsModel: string
  geminiApiKey: string
  aiBaseUrl: string
  aiApiKey: string
}

const DEFAULT_AI_BASE_URL = 'http://76.13.193.138:20128/v1'
const DEFAULT_AI_API_KEY = 'sk-09f612c52578948f-zfpefg-d18a0fd3'
const DEFAULT_ELEVEN_VOICE_ID = 'R2tdno8o9nwUiDvfnMIJ'
const DEFAULT_ELEVEN_MODEL = 'eleven_flash_v2_5'

const CACHE_TTL_SUKSES_MS = 5 * 60 * 1000
const CACHE_TTL_GAGAL_MS = 15 * 1000

let cacheDb: Partial<KonfigurasiVoiceServer> | null = null
let cacheBerlakuSampai = 0
let inFlightPromise: Promise<Partial<KonfigurasiVoiceServer>> | null = null

export function resetCacheVoiceConfigServer() {
  cacheDb = null
  cacheBerlakuSampai = 0
  inFlightPromise = null
}

async function muatDariSupabase(): Promise<Partial<KonfigurasiVoiceServer>> {
  const sekarang = Date.now()
  if (cacheDb && sekarang < cacheBerlakuSampai) {
    return cacheDb
  }
  if (inFlightPromise) {
    return inFlightPromise
  }

  inFlightPromise = (async () => {
    try {
      const admin = supabaseAdmin(2_500)
      const { data, error } = await admin
        .from('jarvis_voice_config')
        .select(
          'elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_model, gemini_api_key, ai_base_url, ai_api_key'
        )
        .eq('id', 'default')
        .maybeSingle()

      if (error || !data) {
        cacheDb = {}
        cacheBerlakuSampai = Date.now() + CACHE_TTL_GAGAL_MS
        return cacheDb
      }

      cacheDb = {
        elevenlabsApiKey:
          typeof data.elevenlabs_api_key === 'string' ? data.elevenlabs_api_key.trim() : '',
        elevenlabsVoiceId:
          typeof data.elevenlabs_voice_id === 'string' ? data.elevenlabs_voice_id.trim() : '',
        elevenlabsModel:
          typeof data.elevenlabs_model === 'string' ? data.elevenlabs_model.trim() : '',
        geminiApiKey:
          typeof data.gemini_api_key === 'string' ? data.gemini_api_key.trim() : '',
        aiBaseUrl:
          typeof data.ai_base_url === 'string' ? data.ai_base_url.trim() : '',
        aiApiKey:
          typeof data.ai_api_key === 'string' ? data.ai_api_key.trim() : '',
      }
      cacheBerlakuSampai = Date.now() + CACHE_TTL_SUKSES_MS
      return cacheDb
    } catch (err) {
      console.warn('[voiceConfig] Gagal membaca jarvis_voice_config dari Supabase:', (err as Error)?.message)
      cacheDb = {}
      cacheBerlakuSampai = Date.now() + CACHE_TTL_GAGAL_MS
      return cacheDb
    } finally {
      inFlightPromise = null
    }
  })()

  return inFlightPromise
}

/**
 * Mengambil konfigurasi suara & AI gateway J.A.R.V.I.S. dengan prioritas:
 * 1. Environment variables container (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, dst.)
 * 2. Tabel server-only `public.jarvis_voice_config` di Supabase (RLS terkunci khusus `service_role`)
 *    sehingga container produksi (Coolify) otomatis memakai ElevenLabs Alif HD yang konsisten.
 */
export async function ambilKonfigurasiVoiceServer(): Promise<KonfigurasiVoiceServer> {
  const envElevenKey = (process.env.ELEVENLABS_API_KEY || '').trim()
  const envElevenVoice = (process.env.ELEVENLABS_VOICE_ID || '').trim()
  const envGeminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()
  const envAiBase = (process.env.AI_BASE_URL || '').trim()
  const envAiKey = (process.env.AI_API_KEY || '').trim()

  // Jika env ElevenLabs sudah tersedia lengkap, tidak perlu kueri DB sama sekali
  const db: Partial<KonfigurasiVoiceServer> =
    envElevenKey && envAiBase && envAiKey ? {} : await muatDariSupabase()

  return {
    elevenlabsApiKey: envElevenKey || db.elevenlabsApiKey || '',
    elevenlabsVoiceId: envElevenVoice || db.elevenlabsVoiceId || DEFAULT_ELEVEN_VOICE_ID,
    elevenlabsModel: db.elevenlabsModel || DEFAULT_ELEVEN_MODEL,
    geminiApiKey: envGeminiKey || db.geminiApiKey || '',
    aiBaseUrl: (envAiBase || db.aiBaseUrl || DEFAULT_AI_BASE_URL).replace(/\/+$/, ''),
    aiApiKey: envAiKey || db.aiApiKey || DEFAULT_AI_API_KEY,
  }
}
