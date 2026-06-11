import { DetailOutletMonitoring } from '@/components/monitoring/DetailOutletMonitoring';

export const metadata = {
  title: 'Detail Outlet - Monitoring Stok',
};

export default async function DetailOutletPage({
  params
}: {
  params: Promise<{ 'outlet-id': string }>
}) {
  const { 'outlet-id': outletId } = await params;

  return (
    <main className="w-full min-h-screen bg-[#fff8f1]">
      <DetailOutletMonitoring outletId={outletId} />
    </main>
  );
}
