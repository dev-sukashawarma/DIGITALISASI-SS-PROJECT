'use client'

import { useActionState } from 'react'
import { signIn } from '@/app/actions/auth'
import { Flame, ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react'

const initialState = {
  error: '',
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState)

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] py-12 px-4 sm:px-6 lg:px-8 selection:bg-amber-200 selection:text-amber-950">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-[#EFE8DE]">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E8590C] via-[#D9480F] to-[#9C3106] text-white shadow-lg shadow-orange-950/20 ring-4 ring-[#FFF4ED]">
            <Flame className="w-7 h-7 text-amber-100 fill-amber-200" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFF4ED] text-[#D9480F] text-[11px] font-extrabold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3 h-3" />
              <span>Internal Ops Desk</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1715] tracking-tight">
              Suka Shawarma
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-stone-500 font-medium">
              Sistem Digitalisasi Marcom & Tracking Influencer
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-5" action={formAction}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email-address"
                className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5"
              >
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                  placeholder="admin@sukashawarma.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5"
              >
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                  placeholder="••••••••••••"
                />
              </div>
            </div>
          </div>

          {state?.error && (
            <div className="text-red-700 text-xs text-center bg-red-50 border border-red-200 p-3 rounded-xl font-medium">
              {state.error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 text-sm font-bold rounded-xl text-white bg-[#D9480F] hover:bg-[#B83808] focus:outline-none focus:ring-2 focus:ring-[#D9480F]/30 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              <span>{isPending ? 'Memproses Masuk...' : 'Masuk ke Dashboard'}</span>
              {!isPending && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          <div className="text-center pt-2">
            <span className="text-[11px] text-stone-400">
              Akses terbatas untuk tim manajemen & operasional Suka Shawarma.
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
