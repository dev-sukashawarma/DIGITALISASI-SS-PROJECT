'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient, getOutletStaff, normalizeLoginIdentifier } from '@suka/auth'
import { Button, Input } from '@suka/design-system'
import { LogIn, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const email = normalizeLoginIdentifier(identifier)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      const hint = !identifier.includes('@') ? ' Jika Anda admin/owner, gunakan email lengkap.' : ''
      setError(`Email atau kata sandi salah.${hint}`)
      return
    }

    // Verifikasi status staff sebelum masuk — akun nonaktif/cuti tidak boleh lanjut
    const { staff, error: staffError } = await getOutletStaff(supabase, data.user.id)
    if (staffError) console.error('getOutletStaff error:', staffError)
    
    if (!staff) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Akun Anda belum terdaftar sebagai staff. Hubungi admin.')
      return
    }
    if (staff.status !== 'active') {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Akun Anda nonaktif. Hubungi admin untuk mengaktifkan kembali.')
      return
    }

    router.push('/launcher')
  }

  return (
    <main className="flex min-h-dvh w-screen items-center justify-center py-8 px-4 sm:px-6 bg-gradient-to-br from-suka-cream via-white to-suka-cream/30">
      <div className="w-full max-w-md space-y-4 sm:space-y-6 flex flex-col justify-center my-auto">
        <div className="flex flex-col items-center text-center space-y-1 sm:space-y-2 mb-2 sm:mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-1">
            <img src="/logo.png" alt="Suka Shawarma Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-suka-brown tracking-tight font-display">
            SUKA SHAWARMA
          </h1>
          <p className="text-[10px] sm:text-xs font-semibold text-suka-orange uppercase tracking-widest">
            Superapp
          </p>
        </div>

        <div className="bg-white border border-suka-orange/10 rounded-3xl p-6 sm:p-8 shadow-xl shadow-suka-brown/5 space-y-5 sm:space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-suka-brown">Masuk Sistem</h2>
            <p className="text-sm text-suka-gray-500">Masuk dengan email atau username akun Anda</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <Input
              id="identifier"
              type="text"
              label="Email atau Username"
              required
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="nama@sukashawarma.com / kasir_sudirman"
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

        {/* Trademark */}
        <p className="text-center text-[10px] text-suka-gray-400 font-semibold pt-2">
          DevAI Sukashawarma 2026
        </p>
      </div>
    </main>
  )
}

