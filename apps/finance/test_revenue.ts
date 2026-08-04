import { fetchOutletRevenue } from './src/app/actions/revenue';

async function run() {
  try {
    const data = await fetchOutletRevenue({
      startDate: '2026-08-01',
      endDate: '2026-08-04',
      selectedOutletId: 'all',
      selectedChannel: 'all'
    });
    console.log("Data count:", data.length);
    if (data.length > 0) {
      console.log("First item:", data[0]);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
