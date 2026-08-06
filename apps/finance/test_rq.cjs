// Using React Query v5 core to test invalidation with initialData
const { QueryClient, QueryObserver } = require('@tanstack/react-query');

const qc = new QueryClient();

let fetchCount = 0;
const observer = new QueryObserver(qc, {
  queryKey: ['petty_cash_topups', undefined, undefined],
  queryFn: () => {
    fetchCount++;
    return [{ id: 2, status: 'forwarded_to_finance' }];
  },
  initialData: [{ id: 1, status: 'forwarded_to_area_manager' }]
});

// Subscribe to trigger the query to be "active"
observer.subscribe((result) => {
  console.log('Observer data:', result.data);
});

console.log('Initial fetch count:', fetchCount);

// Simulate realtime event
console.log('Invalidating...');
qc.invalidateQueries({ queryKey: ['petty_cash_topups'] });

setTimeout(() => {
  console.log('Fetch count after invalidate:', fetchCount);
  console.log('Final data:', observer.getCurrentResult().data);
}, 500);
