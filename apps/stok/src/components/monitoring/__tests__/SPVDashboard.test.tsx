import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the Supabase queries module before importing hooks
vi.mock('@/lib/queries/monitoring', () => ({
  fetchSPVMonitoringData: vi.fn(),
  fetchLeaderMonitoringData: vi.fn(),
  fetchCrewMonitoringData: vi.fn(),
  fetchOpnameStatus: vi.fn(),
}));

vi.mock('@/hooks/useMonitoringData');

vi.mock('@suka/auth', () => ({
  useAuth: () => ({
    outletStaff: { name: 'Supervisor Test' },
    loading: false,
  }),
}));

vi.mock('@/hooks/usePermintaan', () => ({
  useApprovalList: () => ({
    permintaan: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../permintaan/ApprovalList', () => ({
  ApprovalList: () => <div data-testid="approval-list">ApprovalList Component</div>,
}));
vi.mock('../SPVTable', () => ({
  SPVTable: ({ items, tab, onRowClick: _onRowClick }: any) => (
    <div data-testid="spv-table">
      SPVTable: {tab}, items: {items.length}
    </div>
  ),
}));
vi.mock('../SPVTabs', () => ({
  SPVTabs: ({ activeTab, onTabChange: _onTabChange, alertCount }: any) => (
    <div data-testid="spv-tabs">
      SPVTabs: {activeTab}, alerts: {alertCount}
    </div>
  ),
}));
vi.mock('../MonitoringDetailModal', () => ({
  MonitoringDetailModal: ({ item, isOpen, onClose: _onClose }: any) => (
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
    vi.mocked(hook.useRecentLedger).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    vi.mocked(hook.useStockoutForecast).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    vi.mocked(hook.useWasteToday).mockReturnValue({
      data: { count: 0, entries: [] },
      isLoading: false,
      isError: false,
    } as any);
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
    expect(screen.getByText(/Memuat/)).toBeInTheDocument();
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
    expect(screen.getByText(/Koneksi tidak stabil/)).toBeInTheDocument();
  });

  it('renders SPVTable and SPVTabs components', () => {
    const mockItems = [{
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
    }];
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

  it('uses useSPVMonitoringData (enabled) and useLeaderMonitoringData (disabled) when rendered without allowedOutletIds', () => {
    const spvReturn = {
      data: { items: [], lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any;
    vi.mocked(hook.useSPVMonitoringData).mockReturnValue(spvReturn);
    vi.mocked(hook.useLeaderMonitoringData).mockReturnValue({ ...spvReturn, data: { items: [{ outlet_id: 'should-not-be-used' }] } } as any);

    render(<SPVDashboard />, { wrapper });

    expect(hook.useSPVMonitoringData).toHaveBeenCalledWith(true);
    expect(hook.useLeaderMonitoringData).toHaveBeenCalledWith(false);
  });

  it('uses useLeaderMonitoringData (enabled) and useSPVMonitoringData (disabled) when rendered with allowedOutletIds', () => {
    const mockItems = [{
      outlet_id: 'outlet-a',
      outlet_name: 'Outlet A',
      bahan_baku_id: 'bb1',
      item_name: 'Minyak',
      current_qty: 8,
      threshold: 15,
      status: 'below' as const,
      is_flagged: false,
      last_updated: '2026-06-10T10:00:00Z',
      last_opname_date: null,
    }];
    const leaderReturn = {
      data: { items: mockItems, lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any;
    vi.mocked(hook.useLeaderMonitoringData).mockReturnValue(leaderReturn);
    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({ ...leaderReturn, data: { items: [] } } as any);

    render(<SPVDashboard allowedOutletIds={['outlet-a']} />, { wrapper });

    expect(hook.useLeaderMonitoringData).toHaveBeenCalledWith(true);
    expect(hook.useSPVMonitoringData).toHaveBeenCalledWith(false);
    // Renders the leader query's data (1 item), not the disabled spv query's data (0 items)
    expect(screen.getByTestId('spv-table')).toHaveTextContent('items: 1');
  });

  it('renders KPI widgets and right sidebar widgets on Overview tab', () => {
    const mockItems = [{
      outlet_id: 'outlet-a',
      outlet_name: 'SUKA SHAWARMA OUTLET A',
      bahan_baku_id: 'bb1',
      item_name: 'Minyak',
      current_qty: 8,
      threshold: 15,
      status: 'below' as const,
      is_flagged: false,
      last_updated: '2026-06-10T10:00:00Z',
      last_opname_date: null,
    }];
    vi.mocked(hook.useSPVMonitoringData).mockReturnValue({
      data: { items: mockItems, lastFetched: '2026-06-10T10:00:00Z' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      autoRefresh: { pause: vi.fn(), resume: vi.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    vi.mocked(hook.useStockoutForecast).mockReturnValue({
      data: [{
        outlet_id: 'outlet-a',
        outlet_name: 'SUKA SHAWARMA OUTLET A',
        bahan_baku_id: 'bb1',
        item_name: 'Minyak',
        satuan: 'kg',
        current_qty: 8,
        threshold: 15,
        daily_rate: 10,
        days_left: 0.5,
      }],
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(hook.useRecentLedger).mockReturnValue({
      data: [{
        id: 'log-1',
        outlet_id: 'outlet-a',
        outlet_name: 'SUKA SHAWARMA OUTLET A',
        bahan_baku_id: 'bb1',
        item_name: 'Minyak',
        satuan: 'kg',
        tipe: 'pemakaian',
        qty: -5,
        catatan: 'Pemakaian harian',
        saldo_sesudah: 8,
        created_at: new Date().toISOString(),
      }],
      isLoading: false,
      isError: false,
    } as any);

    render(<SPVDashboard />, { wrapper });

    // Verify presence of forecast widget headers/texts
    expect(screen.getByText('Prediksi Habis (<24j)')).toBeInTheDocument();
    expect(screen.getByText('Live Activity')).toBeInTheDocument();
    expect(screen.getByText('Sisa 12 jam (8 kg)')).toBeInTheDocument();
  });
});
