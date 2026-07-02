"use client"

import * as React from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'

export interface ServerErrorProps {
  error: Error & { digest?: string; statusCode?: number }
  reset: () => void
  homeUrl?: string
}

export function ServerError({ error, reset, homeUrl = '/' }: ServerErrorProps) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error('Next.js Error Boundary Caught:', error)
  }, [error])

  let statusCode = error.statusCode || 500
  if (error.message.includes('503')) statusCode = 503
  if (error.message.includes('501')) statusCode = 501
  if (error.message.includes('403')) statusCode = 403
  if (error.message.includes('404')) statusCode = 404

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-red-50 p-8 flex justify-center border-b border-red-100">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center animate-pulse shadow-inner">
            <AlertTriangle className="w-12 h-12 text-red-600" />
          </div>
        </div>
        <div className="p-8 text-center">
          <h1 className="text-6xl font-black text-gray-900 mb-2">{statusCode}</h1>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Oops! Terjadi Kesalahan Server</h2>
          <div className="bg-gray-100 p-3 rounded-lg mb-8 inline-block max-w-full overflow-hidden text-ellipsis">
            <code className="text-gray-600 text-xs font-mono">{error.message || 'Internal Server Error'}</code>
          </div>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            Maaf, sistem sedang mengalami kendala teknis atau sedang dalam perbaikan. Tim kami sedang berusaha memperbaikinya sesegera mungkin.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="w-full py-3.5 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 duration-200"
            >
              <RefreshCcw className="w-5 h-5" />
              Coba Muat Ulang
            </button>
            <button
              onClick={() => window.location.href = homeUrl}
              className="w-full py-3.5 px-4 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 active:scale-95 duration-200"
            >
              <Home className="w-5 h-5" />
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
