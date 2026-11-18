import { DetailReturVendor } from './DetailReturVendor'

export const dynamic = 'force-dynamic'

export default async function DetailReturVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DetailReturVendor id={id} />
}
