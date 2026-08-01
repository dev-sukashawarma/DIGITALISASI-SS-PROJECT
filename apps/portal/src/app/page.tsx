'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseBrowserClient, getOutletStaff } from '@suka/auth'
import { Button, Input } from '@suka/design-system'
import { LogIn, AlertCircle, Loader2, ShieldCheck, CheckCircle2, MapPin, QrCode, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    let email = identifier.trim()
    if (!email.includes('@')) {
      const { data: staffMatch } = await supabase
        .from('outlet_staff')
        .select('email')
        .eq('username', email)
        .maybeSingle()
      if (staffMatch?.email) {
        email = staffMatch.email
      } else {
        email = `${email}@outlet.local`
      }
    }
    const cleanPassword = password.trim()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: cleanPassword })
    if (error) {
      setLoading(false)
      const hint = !identifier.includes('@') ? ' Jika Anda admin/owner/leader/regional manager, gunakan email lengkap.' : ''
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

    if (['admin', 'owner', 'mitra', 'korlap', 'purchasing'].includes(staff.role)) {
      const host = typeof window !== 'undefined' ? window.location.hostname : ''
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
      const adminUrl = process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD || (isLocal ? 'http://localhost:3005' : 'https://admin.sukashawarma.com')
      window.location.href = adminUrl
      return
    }
    
    router.push('/launcher')
  }

  return (
    <main className="h-[100dvh] w-full flex flex-col md:flex-row relative bg-suka-cream overflow-hidden overscroll-none bg-grain select-none">
      {/* Floating Animated Blobs */}
      <div className="absolute top-[-15%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-suka-orange/15 blur-[120px] animate-blob-1 pointer-events-none z-0" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-suka-brown/10 blur-[120px] animate-blob-2 pointer-events-none z-0" />

      {/* Left Column - Branding (Desktop Only) */}
      <div className="hidden md:flex md:w-1/2 bg-suka-brown relative flex-col justify-between p-12 lg:p-16 overflow-hidden z-10 border-r border-suka-brown/20 shadow-2xl shadow-suka-brown/50">
        {/* Glow overlay inside the left section */}
        <div className="absolute inset-0 bg-gradient-to-br from-suka-brown via-suka-brown to-suka-ink opacity-95 z-0" />
        <div className="absolute top-[20%] right-[-10%] w-72 h-72 bg-suka-orange/20 rounded-full blur-[80px]" />
        
        <div className="relative z-10 flex flex-col h-full justify-between">
          {/* Logo & Small Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl p-1.5 shadow-lg shadow-suka-ink/30 border border-white/10 flex items-center justify-center">
              <Image src="/logo.png" alt="Suka Shawarma Logo" width={48} height={48} priority className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-wider text-white font-display">
                SUKA SHAWARMA
              </h2>
              <p className="text-[10px] font-bold text-suka-orange uppercase tracking-widest leading-none mt-0.5">
                Superapp Portal
              </p>
            </div>
          </div>

          {/* Slogan & Benefit Cards */}
          <div className="space-y-8 my-auto">
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-5xl font-black text-suka-cream leading-tight font-display tracking-wide">
                Arsitektur Sistem <br />
                <span className="text-suka-orange">Operasional Outlet</span>
              </h1>
              <p className="text-sm text-suka-gray-300 font-medium max-w-md leading-relaxed">
                Platform SSO terpadu untuk efisiensi transaksi, kehadiran wajah, manajemen inventaris, dan distribusi bahan baku di 19 outlet Jabodetabek.
              </p>
            </div>

            {/* Feature lists in glassmorphic cards */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm max-w-md hover:bg-white/10 transition-colors duration-300">
                <div className="w-10 h-10 rounded-xl bg-suka-orange/20 text-suka-orange flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">SSO Gerbang Tunggal</p>
                  <p className="text-xs text-suka-gray-400 font-medium mt-0.5">Satu akun untuk seluruh aplikasi suite operasional.</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm max-w-md hover:bg-white/10 transition-colors duration-300">
                <div className="w-10 h-10 rounded-xl bg-suka-orange/20 text-suka-orange flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Proteksi Akses & RLS</p>
                  <p className="text-xs text-suka-gray-400 font-medium mt-0.5">Keamanan data level tinggi menggunakan Row Level Security Supabase.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Left Column Footer */}
          <div className="flex justify-between items-center text-[10px] text-suka-gray-400 font-semibold border-t border-white/10 pt-4">
            <p>DevAI Sukashawarma 2026</p>
            <p className="flex items-center gap-1"><MapPin size={10} className="text-suka-orange" /> 19 Outlet Jabodetabek</p>
          </div>
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="w-full md:w-1/2 min-h-full flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 z-10">
        <div className="w-full max-w-md">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="flex flex-col items-center text-center space-y-2 md:hidden mb-8">
            <div className="w-20 h-20 flex items-center justify-center mb-1 bg-white p-2.5 rounded-3xl shadow-md border border-suka-orange/10">
              <Image src="/logo.png" alt="Suka Shawarma Logo" width={80} height={80} priority className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-extrabold text-suka-brown tracking-tight font-display">
              SUKA SHAWARMA
            </h1>
            <p className="text-[10px] font-bold text-suka-orange uppercase tracking-widest">
              Superapp Portal
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white/70 backdrop-blur-md border border-suka-orange/15 rounded-3xl p-6 sm:p-8 shadow-xl shadow-suka-brown/5 space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-suka-brown font-display tracking-wide">Masuk Sistem</h2>
              <p className="text-xs sm:text-sm text-suka-gray-500 font-semibold">Masuk dengan email atau username akun Anda</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <Input
                  id="identifier"
                  type="text"
                  label="Email atau Username"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="nama@sukashawarma.com / kasir_sudirman"
                  className="bg-white/50 border border-suka-gray-200 focus:border-suka-orange/50 focus:ring-2 focus:ring-suka-orange/20 rounded-xl transition-all duration-200 placeholder:text-suka-gray-400 text-sm py-2.5"
                />
              </div>

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  label="Kata Sandi"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="bg-white/50 border border-suka-gray-200 focus:border-suka-orange/50 focus:ring-2 focus:ring-suka-orange/20 rounded-xl transition-all duration-200 placeholder:text-suka-gray-400 text-sm py-2.5 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 bottom-[11px] text-suka-gray-400 hover:text-suka-orange transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-2xl bg-red-50/80 border border-red-200/50 p-3.5 text-xs sm:text-sm text-red-700 backdrop-blur-sm">
                  <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5 animate-pulse" />
                  <p className="font-semibold leading-tight">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-suka-orange hover:bg-orange-600 transition-all font-semibold rounded-xl text-white shadow-lg shadow-suka-orange/20 hover:shadow-orange-500/30 active:scale-[0.98] mt-2 text-sm sm:text-base cursor-pointer"
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

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-suka-gray-200/60"></div>
              <span className="flex-shrink-0 mx-4 text-suka-gray-400 text-xs font-semibold uppercase tracking-wider">Mode Perangkat</span>
              <div className="flex-grow border-t border-suka-gray-200/60"></div>
            </div>

            <button
              type="button"
              onClick={() => {
                const host = typeof window !== 'undefined' ? window.location.hostname : ''
                const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
                const kasirUrl = process.env.NEXT_PUBLIC_APP_URL_POS_KASIR || (isLocal ? 'http://localhost:3004' : 'https://pos.sukashawarma.com')
                window.location.href = `${kasirUrl}/kiosk/qr-login`
              }}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-suka-orange/30 text-suka-orange bg-suka-orange/5 hover:bg-suka-orange/10 hover:border-suka-orange/50 transition-all font-bold rounded-xl active:scale-[0.98] text-sm sm:text-base cursor-pointer"
            >
              <QrCode size={18} />
              <span>Buka Scanner Kiosk</span>
            </button>
          </div>

          {/* Trademark Mobile */}
          <p className="text-center text-[10px] text-suka-gray-400 font-semibold pt-6 md:hidden">
            DevAI Sukashawarma 2026
          </p>
        </div>
      </div>
    </main>
  )
}

