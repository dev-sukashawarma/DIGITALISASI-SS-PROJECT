import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the monitoring queries
vi.mock('@/lib/queries/monitoring', () => ({
  fetchItemDetail: vi.fn(),
}));

// Mock the StatusBadge component
vi.mock('../StatusBadge', () => ({
  StatusBadge: ({ status, isFlagged }: any) => (
    <div data-testid="status-badge">
      {status} {isFlagged && '(flagged)'}
    </div>
  ),
}));

import { MonitoringDetailModal } from '../MonitoringDetailModal';
import * as monitoringQueries from '@/lib/queries/monitoring';
import type { MonitoringItem } from '@/lib/types/monitoring';

const mockItem: MonitoringItem = {
  outlet_id: 'outlet1',
  outlet_name: 'Bandung',
  bahan_baku_id: 'bb1',
  item_name: 'Minyak Goreng',
  current_qty: 8,
  threshold: 15,
  status: 'below',
  is_flagged: false,
  last_updated: '2026-06-10T10:00:00Z',
  last_opname_date: '2026-06-08T14:30:00Z',
};

describe('MonitoringDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    vi.mocked(monitoringQueries.fetchItemDetail).mockResolvedValue({} as any);

    const { container } = render(
      <MonitoringDetailModal item={mockItem} isOpen={false} onClose={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders loading state initially', () => {
    vi.mocked(monitoringQueries.fetchItemDetail).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<MonitoringDetailModal item={mockItem} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Loading details...')).toBeInTheDocument();
  });

  it('renders detail information when data loads', async () => {
    const mockDetail = {
      ...mockItem,
      recent_ledger: [
        {
          type: 'in_stock',
          qty: 10,
          notes: 'Purchase',
          created_at: '2026-06-10T09:00:00Z',
        },
      ],
      discrepancy_details: undefined,
    };

    vi.mocked(monitoringQueries.fetchItemDetail).mockResolvedValue(mockDetail);

    render(<MonitoringDetailModal item={mockItem} isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Minyak Goreng')).toBeInTheDocument();
    });

    expect(screen.getByText('Bandung')).toBeInTheDocument();
    expect(screen.getByText('Purchase')).toBeInTheDocument();
  });

  it('renders error message when fetch fails', async () => {
    const errorMsg = 'Failed to load item details';
    vi.mocked(monitoringQueries.fetchItemDetail).mockRejectedValue(
      new Error(errorMsg)
    );

    render(<MonitoringDetailModal item={mockItem} isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(errorMsg))).toBeInTheDocument();
    });
  });

  it('renders discrepancy details when present', async () => {
    const mockDetail = {
      ...mockItem,
      is_flagged: true,
      recent_ledger: [],
      discrepancy_details: {
        type: 'qty_mismatch',
        qty_system: 20,
        qty_fisik: 8,
        catatan: 'Quantity mismatch during opname',
      },
    };

    vi.mocked(monitoringQueries.fetchItemDetail).mockResolvedValue(mockDetail);

    render(<MonitoringDetailModal item={mockItem} isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Flagged Discrepancy')).toBeInTheDocument();
    });

    expect(screen.getByText(/qty mismatch/i)).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Quantity mismatch during opname')).toBeInTheDocument();
  });

  it('renders recent ledger entries', async () => {
    const mockDetail = {
      ...mockItem,
      recent_ledger: [
        {
          type: 'out_stock',
          qty: -3,
          notes: 'Daily usage',
          created_at: '2026-06-10T14:00:00Z',
        },
        {
          type: 'in_stock',
          qty: 10,
          notes: 'Purchase order',
          created_at: '2026-06-10T09:00:00Z',
        },
      ],
      discrepancy_details: undefined,
    };

    vi.mocked(monitoringQueries.fetchItemDetail).mockResolvedValue(mockDetail);

    render(<MonitoringDetailModal item={mockItem} isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Movements')).toBeInTheDocument();
    });

    expect(screen.getByText('Daily usage')).toBeInTheDocument();
    expect(screen.getByText('Purchase order')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const mockDetail = {
      ...mockItem,
      recent_ledger: [],
      discrepancy_details: undefined,
    };

    const onCloseMock = vi.fn();
    vi.mocked(monitoringQueries.fetchItemDetail).mockResolvedValue(mockDetail);

    const { rerender } = render(
      <MonitoringDetailModal item={mockItem} isOpen={true} onClose={onCloseMock} />
    );

    await waitFor(() => {
      expect(screen.getByText('Minyak Goreng')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);

    expect(onCloseMock).toHaveBeenCalled();
  });

  it('refetches data when item changes', async () => {
    const mockDetail = {
      ...mockItem,
      recent_ledger: [],
      discrepancy_details: undefined,
    };

    vi.mocked(monitoringQueries.fetchItemDetail).mockResolvedValue(mockDetail);

    const onCloseMock = vi.fn();
    const { rerender } = render(
      <MonitoringDetailModal item={mockItem} isOpen={true} onClose={onCloseMock} />
    );

    await waitFor(() => {
      expect(monitoringQueries.fetchItemDetail).toHaveBeenCalledWith(
        'outlet1',
        'bb1'
      );
    });

    const newItem = {
      ...mockItem,
      bahan_baku_id: 'bb2',
      item_name: 'Garam',
    };

    rerender(
      <MonitoringDetailModal item={newItem} isOpen={true} onClose={onCloseMock} />
    );

    await waitFor(() => {
      expect(monitoringQueries.fetchItemDetail).toHaveBeenCalledWith(
        'outlet1',
        'bb2'
      );
    });
  });

  it('handles empty recent ledger gracefully', async () => {
    const mockDetail = {
      ...mockItem,
      recent_ledger: [],
      discrepancy_details: undefined,
    };

    vi.mocked(monitoringQueries.fetchItemDetail).mockResolvedValue(mockDetail);

    render(<MonitoringDetailModal item={mockItem} isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Minyak Goreng')).toBeInTheDocument();
    });

    // Should not render Recent Movements section if empty
    expect(screen.queryByText('Recent Movements')).not.toBeInTheDocument();
  });

  it('displays last opname date as "Never" if not available', async () => {
    const mockDetail = {
      ...mockItem,
      last_opname_date: null,
      recent_ledger: [],
      discrepancy_details: undefined,
    };

    vi.mocked(monitoringQueries.fetchItemDetail).mockResolvedValue(mockDetail);

    render(<MonitoringDetailModal item={mockItem} isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });
});
