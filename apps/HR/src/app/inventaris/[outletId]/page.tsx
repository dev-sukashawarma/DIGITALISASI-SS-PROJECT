import InventarisReportView from '@/components/modules/inventaris/InventarisReportView'

export default async function InventarisOutletReportPage({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = await params
  return <InventarisReportView outletId={outletId} />
}
