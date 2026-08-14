'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'
import { LogOut } from 'lucide-react'

export function ConfirmLogoutDialog({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsLoggingOut(true)
    try {
      await onConfirm()
    } catch (e) {
      console.error('Logout failed:', e)
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xs md:max-w-sm rounded-3xl bg-white p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-2">
            <LogOut size={28} className={isLoggingOut ? 'animate-pulse' : ''} />
          </div>
          <h3 className="text-xl font-extrabold text-suka-brown">Yakin ingin keluar?</h3>
          <p className="text-sm font-medium text-suka-gray-500">
            Anda harus masuk kembali untuk mengakses Admin Hub.
          </p>
        </div>
        
        <div className="flex gap-3 pt-2">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onClose} 
            disabled={isLoggingOut}
            className="flex-1 rounded-2xl font-bold bg-gray-50 hover:bg-gray-100 text-suka-gray-600"
          >
            Batal
          </Button>
          <Button 
            type="button" 
            onClick={handleConfirm}
            disabled={isLoggingOut}
            className="flex-1 rounded-2xl font-bold bg-red-500 hover:bg-red-600 text-white border-0"
          >
            {isLoggingOut ? 'Keluar...' : 'Ya, Keluar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
