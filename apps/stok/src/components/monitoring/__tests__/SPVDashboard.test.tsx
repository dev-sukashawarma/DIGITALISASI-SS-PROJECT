import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the Supabase queries module before importing hooks
vi.mock('@/lib/queries/monitoring', () => ({
  fetchSPVMonitoringData: vi.fn(),
  fetchCrewMonitoringData: vi.fn(),
}));

vi.mock('@/hooks/useMonitoringData');
vi.mock('../SPVTable', () => ({
  SPVTable: ({ items, tab, onRowClick }: any) => (
    <div data-testid="spv-table">
      SPVTable: {tab}, items: {items.length}
    </div>
  ),
}));
vi.mock('../SPVTabs', () => ({
  SPVTabs: ({ activeTab, onTabChange, alertCount }: any) => (
    <div data-testid="spv-tabs">
      SPVTabs: {activeTab}, alerts: {alertCount}
    </div>
  ),
}));
vi.mock('../MonitoringDetailModal', () => ({
  MonitoringDetailModal: ({ item, isOpen, onClose }: any) => (
    isOpen && (
      <div data-testid="monitoring-detail-modal">
        MonitoringDetailModal for {item?.item_name}
      </div>
    )
  ),
}));

import { SPVDashboard } from '../SPVDashboard';
import * as hook from '@/hooks/useMonitoringData';

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('SPVDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when loading', () => {
    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: null,
    } as any);

    render(<SPVDashboard />, { wrapper });
    expect(screen.getByText('Loading monitoring data...')).toBeInTheDocument();
  });

  it('renders dashboard with title and controls', () => {
    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: { items: [], lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<SPVDashboard />, { wrapper });
    expect(screen.getByText('SPV Monitoring Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('shows error message when connection fails', () => {
    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: { items: [], lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<SPVDashboard />, { wrapper });
    expect(screen.getByText(/Connection unstable/)).toBeInTheDocument();
  });

  it('renders SPVTable and SPVTabs components', () => {
    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: { items: [], lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<SPVDashboard />, { wrapper });
    expect(screen.getByTestId('spv-table')).toBeInTheDocument();
    expect(screen.getByTestId('spv-tabs')).toBeInTheDocument();
  });

  it('calculates alert count correctly', () => {
    const mockItems = [
      {
        outlet_id: '1',
        outlet_name: 'Bandung',
        bahan_baku_id: 'bb1',
        item_name: 'Minyak',
        current_qty: 8,
        threshold: 15,
        status: 'below' as const,
        is_flagged: false,
        last_updated: '2026-06-10T10:00:00Z',
        last_opname_date: null,
      },
      {
        outlet_id: '1',
        outlet_name: 'Bandung',
        bahan_baku_id: 'bb2',
        item_name: 'Garam',
        current_qty: 20,
        threshold: 15,
        status: 'ok' as const,
        is_flagged: true,
        last_updated: '2026-06-10T10:00:00Z',
        last_opname_date: null,
      },
      {
        outlet_id: '1',
        outlet_name: 'Bandung',
        bahan_baku_id: 'bb3',
        item_name: 'Tepung',
        current_qty: 15,
        threshold: 15,
        status: 'ok' as const,
        is_flagged: false,
        last_updated: '2026-06-10T10:00:00Z',
        last_opname_date: null,
      },
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

    render(<SPVDashboard />, { wrapper });
    // Alert count should be 2 (1 below + 1 flagged)
    expect(screen.getByTestId('spv-tabs')).toHaveTextContent('alerts: 2');
  });

  it('displays last updated timestamp', () => {
    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: { items: [], lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<SPVDashboard />, { wrapper });
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('pause button text changes based on autoRefresh state', () => {
    const pauseMock = vi.fn();
    const resumeMock = vi.fn();

    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: { items: [], lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: {
        pause: pauseMock,
        resume: resumeMock,
        isPaused: () => true,
      },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<SPVDashboard />, { wrapper });
    expect(screen.getByText('Resume (30s)')).toBeInTheDocument();
  });
});
