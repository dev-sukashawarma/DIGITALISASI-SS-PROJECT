'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@suka/auth'
import { Button, Input } from '@suka/design-system'
import { Flame, LogIn, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/launcher')
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-suka-cream via-white to-suka-cream/30">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-suka-orange/10 flex items-center justify-center text-suka-orange shadow-inner shadow-suka-orange/5 animate-pulse">
            <Flame size={36} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-extrabold text-suka-brown tracking-tight font-display">
            SUKA SHAWARMA
          </h1>
          <p className="text-xs font-semibold text-suka-orange uppercase tracking-widest">
            Portal Operasional Outlet
          </p>
        </div>

        <div className="bg-white border border-suka-orange/10 rounded-3xl p-8 shadow-xl shadow-suka-brown/5 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-suka-brown">Masuk Sistem</h2>
            <p className="text-sm text-suka-gray-500">Gunakan akun email terdaftar Anda</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              type="email"
              label="Email Staff"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@sukashawarma.com"
              className="bg-suka-gray-50/50 focus:bg-white"
            />

            <Input
              id="password"
              type="password"
              label="Kata Sandi"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              className="bg-suka-gray-50/50 focus:bg-white"
            />

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-700">
                <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
                <p className="font-medium leading-tight">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-suka-orange hover:bg-orange-600 transition-all font-semibold rounded-xl text-white shadow-lg shadow-suka-orange/20 hover:shadow-orange-500/30 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Memproses Masuk...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Masuk ke Portal</span>
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}

