import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders below status with red styling', () => {
    render(<StatusBadge status="below" />);
    expect(screen.getByText('🔴')).toBeInTheDocument();
    const badge = screen.getByText('below').parentElement;
    expect(badge).toHaveClass('bg-red-100');
  });

  it('renders warning status with yellow styling', () => {
    render(<StatusBadge status="warning" />);
    expect(screen.getByText('🟡')).toBeInTheDocument();
  });

  it('renders ok status with green styling', () => {
    render(<StatusBadge status="ok" />);
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('shows flagged icon when isFlagged=true', () => {
    render(<StatusBadge status="below" isFlagged={true} />);
    expect(screen.getByText('📌')).toBeInTheDocument();
  });
});
