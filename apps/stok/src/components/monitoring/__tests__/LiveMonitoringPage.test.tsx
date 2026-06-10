import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LiveMonitoringPage } from '../LiveMonitoringPage';
import * as hook from '@/hooks/useMonitoringData';

vi.mock('@/hooks/useMonitoringData');


let mockQueryState = {
  data: [
    { id: '1', nama: 'SUKA SHAWARMA KITCHEN' },
    { id: '2', nama: 'SUKA SHAWARMA SUDIRMAN' }
  ] as any[] | undefined,
  isLoading: false,
};

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn((options: any) => {
      if (options.queryKey && options.queryKey[1] === 'outletsList') {
        return {
          data: mockQueryState.data,
          isLoading: mockQueryState.isLoading,
          isError: false,
        };
      }
      return { data: null, isLoading: true };
    }),
  };
});

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('LiveMonitoringPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryState.data = [
      { id: '1', nama: 'SUKA SHAWARMA KITCHEN' },
      { id: '2', nama: 'SUKA SHAWARMA SUDIRMAN' }
    ];
    mockQueryState.isLoading = false;
  });

  it('renders loading state when loading and data is null', () => {
    mockQueryState.isLoading = true;
    mockQueryState.data = [];

    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: null,
    } as any);

    render(<LiveMonitoringPage />, { wrapper });
    expect(screen.getByText(/Menghubungkan/i)).toBeInTheDocument();
  });

  it('renders outlets list and stats bar correctly when data is loaded', () => {
    const mockItems = [
      {
        outlet_id: '1',
        outlet_name: 'SUKA SHAWARMA KITCHEN',
        bahan_baku_id: 'bb1',
        item_name: 'Ayam',
        current_qty: 2,
        threshold: 30,
        status: 'below' as const,
        is_flagged: false,
        last_updated: '2026-06-10T10:00:00Z',
        last_opname_date: null,
      },
      {
        outlet_id: '2',
        outlet_name: 'SUKA SHAWARMA SUDIRMAN',
        bahan_baku_id: 'bb2',
        item_name: 'Bawang',
        current_qty: 12,
        threshold: 10,
        status: 'ok' as const,
        is_flagged: false,
        last_updated: '2026-06-10T10:00:00Z',
        last_opname_date: null,
      }
    ];

    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: { items: mockItems, lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<LiveMonitoringPage />, { wrapper });

    expect(screen.getByText('LIVE STOCK MONITORING BOARD')).toBeInTheDocument();
    expect(screen.getByText('KITCHEN')).toBeInTheDocument();
    expect(screen.getByText('SUDIRMAN')).toBeInTheDocument();
    expect(screen.getByText('Ayam')).toBeInTheDocument();
    expect(screen.getByText('Semua Aman')).toBeInTheDocument(); // Sudirman has no issues
  });

  it('toggles sound button state when clicked', () => {
    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: { items: [], lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<LiveMonitoringPage />, { wrapper });
    
    const soundBtn = screen.getByRole('button', { name: /Alarm On/i });
    expect(soundBtn).toBeInTheDocument();

    fireEvent.click(soundBtn);
    expect(screen.getByRole('button', { name: /Alarm Muted/i })).toBeInTheDocument();
  });
});
