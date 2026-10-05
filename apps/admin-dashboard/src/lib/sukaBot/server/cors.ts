const DEFAULT_ORIGINS = ['https://app.sukashawarma.com', 'http://localhost:3010']

function daftar(env: string | undefined): string[] {
  return env ? env.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS
}

export function originDiizinkan(origin: string | null, env: string | undefined = process.env.SUKA_BOT_ALLOWED_ORIGINS): boolean {
  return !!origin && daftar(env).includes(origin)
}

export function headerCors(origin: string | null, env: string | undefined = process.env.SUKA_BOT_ALLOWED_ORIGINS): Record<string, string> {
  if (!originDiizinkan(origin, env)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}
