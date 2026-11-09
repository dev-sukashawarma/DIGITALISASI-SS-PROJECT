import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ambilKonfigurasiVoiceServer, resetCacheVoiceConfigServer } from './voiceConfig'
import { supabaseAdmin } from '@/lib/server/telegram'

vi.mock('@/lib/server/telegram', () => ({
  supabaseAdmin: vi.fn(),
}))

describe('voiceConfig server', () => {
  const envAsli = { ...process.env }

  beforeEach(() => {
    resetCacheVoiceConfigServer()
    vi.clearAllMocks()
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_VOICE_ID
    delete process.env.AI_BASE_URL
    delete process.env.AI_API_KEY
    delete process.env.GEMINI_API_KEY
  })

  afterEach(() => {
    process.env = { ...envAsli }
    resetCacheVoiceConfigServer()
  })

  it('memuat konfigurasi ElevenLabs dari tabel Supabase jarvis_voice_config saat env container kosong (Coolify) dan menyimpan cache di memori', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        elevenlabs_api_key: 'sk_test_supabase_elevenlabs_key',
        elevenlabs_voice_id: 'R2tdno8o9nwUiDvfnMIJ',
        elevenlabs_model: 'eleven_flash_v2_5',
        gemini_api_key: null,
        ai_base_url: 'http://76.13.193.138:20128/v1/',
        ai_api_key: 'sk-router-key',
      },
      error: null,
    })

    vi.mocked(supabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: maybeSingleMock,
          }),
        }),
      }),
    } as unknown as ReturnType<typeof supabaseAdmin>)

    const cfg1 = await ambilKonfigurasiVoiceServer()
    expect(cfg1.elevenlabsApiKey).toBe('sk_test_supabase_elevenlabs_key')
    expect(cfg1.elevenlabsVoiceId).toBe('R2tdno8o9nwUiDvfnMIJ')
    expect(cfg1.elevenlabsModel).toBe('eleven_flash_v2_5')
    expect(cfg1.aiBaseUrl).toBe('http://76.13.193.138:20128/v1')
    expect(maybeSingleMock).toHaveBeenCalledTimes(1)

    // Panggilan ke-2 harus memakai cache memori tanpa kueri ulang ke database
    const cfg2 = await ambilKonfigurasiVoiceServer()
    expect(cfg2.elevenlabsApiKey).toBe('sk_test_supabase_elevenlabs_key')
    expect(maybeSingleMock).toHaveBeenCalledTimes(1)
  })

  it('mengutamakan env lokal langsung tanpa kueri Supabase jika env lengkap', async () => {
    process.env.ELEVENLABS_API_KEY = 'sk_env_direct'
    process.env.ELEVENLABS_VOICE_ID = 'custom_voice_env'
    process.env.AI_BASE_URL = 'http://localhost:20128/v1'
    process.env.AI_API_KEY = 'sk_ai_direct'

    const cfg = await ambilKonfigurasiVoiceServer()
    expect(cfg.elevenlabsApiKey).toBe('sk_env_direct')
    expect(cfg.elevenlabsVoiceId).toBe('custom_voice_env')
    expect(supabaseAdmin).not.toHaveBeenCalled()
  })
})
