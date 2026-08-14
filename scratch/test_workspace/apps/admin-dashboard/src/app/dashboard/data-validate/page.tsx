import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import DataValidateClient from './components/DataValidateClient'
import { getOutletsForSelect } from './actions'

export const dynamic = 'force-dynamic'

export default async function DataValidatePage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div className="p-8 text-center text-gray-500">Akses ditolak. Sesi tidak valid.</div>
  }



  const outlets = await getOutletsForSelect()

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Validate</h1>
        <p className="text-muted-foreground mt-2">
          Cocokkan jumlah (QTY) item dari data export platform eksternal (misal: TikTok GO) dengan data di database.
        </p>
      </div>

      <DataValidateClient outlets={outlets || []} />
    </div>
  )
}
