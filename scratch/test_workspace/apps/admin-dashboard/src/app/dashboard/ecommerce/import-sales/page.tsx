import ImportSalesView from './ImportSalesView'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ImportSalesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Penjualan E-Commerce</h1>
        <p className="mt-1 text-sm text-gray-500">Upload laporan dari TikTokShop untuk dicatat sebagai penjualan SS Online</p>
      </div>
      
      <ImportSalesView />
    </div>
  )
}
