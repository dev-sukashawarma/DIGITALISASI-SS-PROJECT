import { MonitoringPage } from '@/components/monitoring/MonitoringPage';

export const metadata = {
  title: 'Monitoring - Stok Management',
};

export default function Page() {
  return (
    <main className="w-full min-h-screen bg-[#fff8f1]">
      <MonitoringPage />
    </main>
  );
}
