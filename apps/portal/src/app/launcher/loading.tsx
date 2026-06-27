import React from 'react'
import { Skeleton } from '@suka/design-system'

export default function LauncherLoading() {
  return (
    <main className="h-full w-full bg-suka-cream/50 relative overflow-y-auto overflow-x-hidden bg-grain select-none py-8 md:py-12 px-4 sm:px-6">
      {/* Background soft glowing blur blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-orange/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-brown/5 blur-[120px] pointer-events-none z-0" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        
        {/* Unified Glassmorphic Profile & Workspace Card Skeleton */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-suka-brown via-suka-ink to-suka-brown p-5 sm:p-6 text-white shadow-xl shadow-suka-brown/15 border border-white/10">
          <div className="absolute right-0 top-0 -mt-6 -mr-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute left-1/3 bottom-0 -mb-10 w-48 h-48 bg-suka-orange/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="p-0.5 rounded-full ring-2 ring-white/30 flex-shrink-0">
                <Skeleton className="h-[50px] w-[50px] rounded-full bg-white/10" />
              </div>
              <div className="min-w-0 space-y-2.5">
                <Skeleton className="h-4.5 w-24 bg-white/10 rounded-md" />
                <Skeleton className="h-6 w-40 bg-white/10 rounded-md" />
                <Skeleton className="h-3.5 w-32 bg-white/10 rounded-md" />
              </div>
            </div>
            
            <div className="shrink-0">
              <Skeleton className="h-10 w-20 bg-white/10 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Applications Grid Skeleton */}
        <section className="space-y-4">
          <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-suka-orange border-b border-suka-orange/10 pb-2">
            Aplikasi Anda
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-suka-brown/10 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-2xl" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Skeleton */}
        <footer className="pt-6 border-t border-suka-orange/10 flex flex-wrap justify-between items-center text-[10px] text-suka-gray-400 font-bold gap-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-20" />
        </footer>
      </div>
    </main>
  )
}
