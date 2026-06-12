'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sandwich, Loader2, AlertCircle, Eye, EyeOff, Lock, User, ArrowRight, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/components/BrandContext'
import Link from 'next/link'

export default function UnifiedLoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { brandName, brandLogo } = useBrand()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    const supabase = createClient()
    
    // Smart Detection: Pseudo-Email
    let loginEmail = identifier.trim()
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@outlet.local`
    }

    const { error: authError, data: authData } = await supabase.auth.signInWithPassword({ 
      email: loginEmail, 
      password 
    })

    if (authError || !authData.user) {
      setError('Username/Email atau password salah')
      setLoading(false)
      return
    }

    // Fetch Profile Role to determine redirect
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profileData) {
      // Fallback redirect if profile not found (maybe they are admin created raw in auth?)
      router.push('/admin')
      router.refresh()
      return
    }

    // Role-based Redirect
    if (profileData.role === 'admin') {
      router.push('/admin')
    } else if (profileData.role === 'kasir') {
      router.push('/kasir')
    } else if (profileData.role === 'kiosk') {
      router.push('/')
    } else {
      router.push('/')
    }
    
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] relative overflow-hidden selection:bg-amber-100 p-4">
      
      {/* Subtle Background Decorations */}
      <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-amber-400/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Centered Login Card */}
      <div className="w-full max-w-[420px] bg-white rounded-[2rem] shadow-2xl shadow-amber-900/5 border border-amber-100/50 p-8 sm:p-10 relative z-10 animate-fade-up">
        
        {/* Logo */}
        <div className="flex justify-center mb-6">
          {brandLogo ? (
            <img src={brandLogo} alt="Logo" className="w-16 h-16 object-cover rounded-2xl shadow-lg shadow-amber-500/20" />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sandwich className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">{brandName} POS</h2>
          <p className="text-gray-500 mt-2 text-sm font-medium">Masuk sebagai Admin, Kasir, atau Device.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Identifier Input */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700 ml-1">Email atau Username</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin@shawarma.com / kasir_sudirman"
                className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-2 border-transparent text-gray-900 rounded-2xl placeholder-gray-400 focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all font-medium"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700 ml-1">Kata Sandi</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
              </div>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="block w-full pl-11 pr-12 py-3.5 bg-gray-50 border-2 border-transparent text-gray-900 rounded-2xl placeholder-gray-400 focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all font-medium tracking-wide"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
              >
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100/50 rounded-xl p-4 text-red-600 text-sm font-medium animate-fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-black rounded-2xl text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-900/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden mt-4"
          >
            {/* Button shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            
            {loading ? (
              <span className="flex items-center gap-2 relative z-10">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                Masuk...
              </span>
            ) : (
              <span className="flex items-center gap-2 relative z-10">
                Masuk ke Dashboard
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </span>
            )}
          </button>
        </form>

        {/* Panduan Link */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <Link href="/panduan" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-amber-600 transition-colors">
            <BookOpen className="w-4 h-4" />
            <span>Bingung cara pakai? <span className="underline decoration-amber-500/30 underline-offset-4">Baca Buku Panduan</span></span>
          </Link>
        </div>

      </div>
    </div>
  )
}
