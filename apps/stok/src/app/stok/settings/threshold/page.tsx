'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { ThresholdPage } from '@/components/settings/ThresholdPage'

export default function ThresholdSettingsPage() {
  const { outletStaff, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && outletStaff && outletStaff.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [loading, outletStaff, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Memuat…</p>
      </div>
    )
  }

  if (!outletStaff || outletStaff.role !== 'admin') {
    return null
  }

  return <ThresholdPage />
}
