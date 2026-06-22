import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/queries/monitoring', () => ({
  fetchSPVMonitoringData: vi.fn(),
  fetchLeaderMonitoringData: vi.fn(),
  fetchCrewMonitoringData: vi.fn(),
}));

import { useSPVMonitoringData, useLeaderMonitoringData } from '../useMonitoringData';
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

  it('returns cached data when error occurs after prior successful fetch', async () => {
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
    vi.mocked(monitoringQueries.fetchSPVMonitoringData)
      .mockResolvedValueOnce(mockData) // First call succeeds
      .mockRejectedValueOnce(new Error('Network')); // Second call fails

    const { result } = renderHook(() => useSPVMonitoringData(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockData));

    result.current.refetch();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.data).toEqual(mockData); // Still has cached
    });
  });

  it('pause and resume controls work correctly', async () => {
    const mockData = { items: [], lastFetched: '2026-06-10T10:00:00Z' };
    vi.mocked(monitoringQueries.fetchSPVMonitoringData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useSPVMonitoringData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.autoRefresh.pause();
    expect(result.current.autoRefresh.isPaused()).toBe(true);

    result.current.autoRefresh.resume();
    expect(result.current.autoRefresh.isPaused()).toBe(false);
  });

  it('resets isError to false when refetch is triggered', async () => {
    const mockError = new Error('Network error');
    vi.mocked(monitoringQueries.fetchSPVMonitoringData).mockRejectedValue(mockError);

    const { result } = renderHook(() => useSPVMonitoringData(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    vi.mocked(monitoringQueries.fetchSPVMonitoringData).mockResolvedValue({
      items: [],
      lastFetched: '2026-06-10T10:00:00Z',
    });
    result.current.refetch();

    await waitFor(() => expect(result.current.isError).toBe(false)); // Should reset
  });
});

describe('useLeaderMonitoringData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches leader-scoped monitoring data via fetchLeaderMonitoringData (not fetchSPVMonitoringData)', async () => {
    const mockData = {
      items: [
        {
          outlet_id: 'outlet-a',
          item_name: 'Minyak',
          current_qty: 8,
          threshold: 15,
          status: 'below' as const,
          is_flagged: false,
          outlet_name: 'Outlet A',
          bahan_baku_id: 'bb1',
          last_updated: '2026-06-10T10:00:00Z',
          last_opname_date: '2026-06-09T10:00:00Z',
        },
      ],
      lastFetched: '2026-06-10T10:00:00Z',
    };

    vi.mocked(monitoringQueries.fetchLeaderMonitoringData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useLeaderMonitoringData(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockData);
    expect(monitoringQueries.fetchLeaderMonitoringData).toHaveBeenCalled();
    expect(monitoringQueries.fetchSPVMonitoringData).not.toHaveBeenCalled();
  });

  it('does not fetch when enabled=false', async () => {
    vi.mocked(monitoringQueries.fetchLeaderMonitoringData).mockResolvedValue({
      items: [],
      lastFetched: '2026-06-10T10:00:00Z',
    });

    const { result } = renderHook(() => useLeaderMonitoringData(false), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(monitoringQueries.fetchLeaderMonitoringData).not.toHaveBeenCalled();
  });
});
