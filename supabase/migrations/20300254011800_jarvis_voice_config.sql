-- Konfigurasi server-side terpusat untuk engine suara J.A.R.V.I.S. (ElevenLabs Studio TTS & AI Audio Gateway)
-- agar container produksi (Coolify) langsung memakai suara ElevenLabs yang konsisten tanpa ekspos secret ke client.

CREATE TABLE IF NOT EXISTS public.jarvis_voice_config (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  elevenlabs_api_key text,
  elevenlabs_voice_id text NOT NULL DEFAULT 'R2tdno8o9nwUiDvfnMIJ',
  elevenlabs_model text NOT NULL DEFAULT 'eleven_flash_v2_5',
  gemini_api_key text,
  ai_base_url text,
  ai_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jarvis_voice_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.jarvis_voice_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.jarvis_voice_config TO service_role;

COMMENT ON TABLE public.jarvis_voice_config IS
  'Konfigurasi rahasia server-only untuk J.A.R.V.I.S. Voice (ElevenLabs TTS & AI Audio Gateway). Hanya dapat diakses oleh service_role.';

NOTIFY pgrst, 'reload schema';
