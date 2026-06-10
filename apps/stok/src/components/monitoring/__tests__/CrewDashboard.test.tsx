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
vi.mock('../CrewList', () => ({
  CrewList: ({ items, onItemClick }: any) => (
    <div data-testid="crew-list">
      CrewList: items: {items.length}
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

import { CrewDashboard } from '../CrewDashboard';
import * as hook from '@/hooks/useMonitoringData';

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('CrewDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when loading', () => {
    vi.mocked(hook.useCrewMonitoringData).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: null,
    } as any);

    render(<CrewDashboard />, { wrapper });
    expect(screen.getByText('Loading monitoring data...')).toBeInTheDocument();
  });

  it('renders crew dashboard with outlet name', () => {
    vi.mocked(hook.useCrewMonitoringData).mockReturnValue({
      data: {
        outlet_id: '1',
        outlet_name: 'Bandung',
        items: [],
        summary: { below_threshold: 0, flagged: 0, ok: 0, total: 0 },
        lastFetched: '2026-06-10T10:00:00Z',
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<CrewDashboard />, { wrapper });
    expect(screen.getByText('Bandung - Monitoring')).toBeInTheDocument();
    expect(screen.getByText(/Check stok status/)).toBeInTheDocument();
  });

  it('shows error message when connection fails', () => {
    vi.mocked(hook.useCrewMonitoringData).mockReturnValue({
      data: {
        outlet_id: '1',
        outlet_name: 'Bandung',
        items: [],
        summary: { below_threshold: 0, flagged: 0, ok: 0, total: 0 },
        lastFetched: '2026-06-10T10:00:00Z',
      },
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<CrewDashboard />, { wrapper });
    expect(screen.getByText(/Connection unstable/)).toBeInTheDocument();
  });

  it('renders CrewList component', () => {
    vi.mocked(hook.useCrewMonitoringData).mockReturnValue({
      data: {
        outlet_id: '1',
        outlet_name: 'Bandung',
        items: [],
        summary: { below_threshold: 0, flagged: 0, ok: 0, total: 0 },
        lastFetched: '2026-06-10T10:00:00Z',
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<CrewDashboard />, { wrapper });
    expect(screen.getByTestId('crew-list')).toBeInTheDocument();
  });

  it('displays last updated timestamp', () => {
    vi.mocked(hook.useCrewMonitoringData).mockReturnValue({
      data: {
        outlet_id: '1',
        outlet_name: 'Bandung',
        items: [],
        summary: { below_threshold: 0, flagged: 0, ok: 0, total: 0 },
        lastFetched: '2026-06-10T10:00:00Z',
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<CrewDashboard />, { wrapper });
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });
});
