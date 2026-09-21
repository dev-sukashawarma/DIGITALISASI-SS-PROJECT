import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContentTypesWithCounts } from '@/app/actions/content'
import ContentSettingsView from './ContentSettingsView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Pengaturan & Master Data Tipe Konten | Suka Shawarma',
  description: 'Kelola master tipe konten dan taksonomi editorial untuk tim Marcom Suka Shawarma.',
}

export default async function ContentSettingsPage() {
  const user = await getCurrentUser()

  const [contentTypes, totalContents] = await Promise.all([
    getContentTypesWithCounts(),
    prisma.internalContent.count(),
  ])

  return (
    <ContentSettingsView
      initialTypes={contentTypes}
      totalContents={totalContents}
      userRole={user?.role || 'MARCOM'}
    />
  )
}
