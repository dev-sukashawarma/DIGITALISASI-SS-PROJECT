import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

// Mock the hooks
vi.mock('@/hooks/useMonitoringData');

// Mock the dashboard components
vi.mock('../SPVDashboard', () => ({
  SPVDashboard: () => <div data-testid="spv-dashboard">SPV Monitoring Dashboard</div>,
}));

vi.mock('../CrewDashboard', () => ({
  CrewDashboard: () => <div data-testid="crew-dashboard">Crew Monitoring Dashboard</div>,
}));

import { MonitoringPage } from '../MonitoringPage';
import * as AuthContext from '@/context/AuthContext';

const queryClient = new QueryClient();

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('MonitoringPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders SPV dashboard for SPV role', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      session: null,
      user: { id: 'user1' },
      outletStaff: {
        id: 'user1',
        outlet_id: 'outlet1',
        name: 'John SPV',
        role: 'spv',
        status: 'active',
      },
      loading: false,
      signOut: vi.fn(),
    } as any);

    render(<MonitoringPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('spv-dashboard')).toBeInTheDocument();
    });
  });

  it('renders Crew dashboard for crew role', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      session: null,
      user: { id: 'user2' },
      outletStaff: {
        id: 'user2',
        outlet_id: 'outlet1',
        name: 'Jane Crew',
        role: 'crew',
        status: 'active',
      },
      loading: false,
      signOut: vi.fn(),
    } as any);

    render(<MonitoringPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('crew-dashboard')).toBeInTheDocument();
    });
  });

  it('shows error when not authenticated', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      session: null,
      user: null,
      outletStaff: null,
      loading: false,
      signOut: vi.fn(),
    } as any);

    render(<MonitoringPage />, { wrapper });
    expect(screen.getByText(/Not authenticated or profile not found/i)).toBeInTheDocument();
  });

  it('shows loading state while loading', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      session: null,
      user: null,
      outletStaff: null,
      loading: true,
      signOut: vi.fn(),
    } as any);

    render(<MonitoringPage />, { wrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders Crew dashboard for kasir role', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      session: null,
      user: { id: 'user3' },
      outletStaff: {
        id: 'user3',
        outlet_id: 'outlet1',
        name: 'Bob Kasir',
        role: 'kasir',
        status: 'active',
      },
      loading: false,
      signOut: vi.fn(),
    } as any);

    render(<MonitoringPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('crew-dashboard')).toBeInTheDocument();
    });
  });

  it('renders Crew dashboard for kepala_outlet role', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      session: null,
      user: { id: 'user4' },
      outletStaff: {
        id: 'user4',
        outlet_id: 'outlet1',
        name: 'Alice Kepala',
        role: 'kepala_outlet',
        status: 'active',
      },
      loading: false,
      signOut: vi.fn(),
    } as any);

    render(<MonitoringPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('crew-dashboard')).toBeInTheDocument();
    });
  });
});
