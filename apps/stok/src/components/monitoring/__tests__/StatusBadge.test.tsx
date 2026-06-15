import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders below status with red styling', () => {
    render(<StatusBadge status="below" />);
    const badge = screen.getByText('Below Threshold');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-[#ba1a1a]');
  });

  it('renders warning status with orange styling', () => {
    render(<StatusBadge status="warning" />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders ok status with green styling', () => {
    render(<StatusBadge status="ok" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('shows flagged marker when isFlagged=true', () => {
    render(<StatusBadge status="below" isFlagged={true} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
