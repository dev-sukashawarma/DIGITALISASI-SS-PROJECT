import { MonitoringPage } from '@/components/monitoring/MonitoringPage';

export const metadata = {
  title: 'Monitoring - Stok Management',
};

export default function Page() {
  return (
    <main className="max-w-7xl mx-auto p-4">
      <MonitoringPage />
    </main>
  );
}
