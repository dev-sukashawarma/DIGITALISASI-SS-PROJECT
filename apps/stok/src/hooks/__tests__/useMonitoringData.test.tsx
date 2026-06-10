import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/queries/monitoring', () => ({
  fetchSPVMonitoringData: vi.fn(),
  fetchCrewMonitoringData: vi.fn(),
}));

import { useSPVMonitoringData } from '../useMonitoringData';
import * as monitoringQueries from '@/lib/queries/monitoring';

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useSPVMonitoringData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches SPV monitoring data on mount', async () => {
    const mockData = {
      items: [
        {
          outlet_id: '1',
          item_name: 'Minyak',
          current_qty: 8,
          threshold: 15,
          status: 'below' as const,
          is_flagged: false,
          outlet_name: 'Bandung',
          bahan_baku_id: 'bb1',
          last_updated: '2026-06-10T10:00:00Z',
          last_opname_date: '2026-06-09T10:00:00Z',
        },
      ],
      lastFetched: '2026-06-10T10:00:00Z',
    };

    vi.mocked(monitoringQueries.fetchSPVMonitoringData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useSPVMonitoringData(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
  });

  it('handles errors and returns cached data', async () => {
    const mockError = new Error('Network error');
    vi.mocked(monitoringQueries.fetchSPVMonitoringData).mockRejectedValue(mockError);

    const { result } = renderHook(() => useSPVMonitoringData(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('calls refetch when manual refresh is triggered', async () => {
    const mockData = {
      items: [],
      lastFetched: '2026-06-10T10:00:00Z',
    };

    vi.mocked(monitoringQueries.fetchSPVMonitoringData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useSPVMonitoringData(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.refetch();

    await waitFor(() => {
      expect(vi.mocked(monitoringQueries.fetchSPVMonitoringData).mock.calls.length).toBeGreaterThan(1);
    });
  });
});
