import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StaffForm } from './StaffForm';

describe('Dummy', () => {
  it('works', () => {
    render(<StaffForm onSubmit={vi.fn()} submitting={false} outlets={[]} />)
    const { screen } = require('@testing-library/react')
    screen.debug()
    expect(1).toBe(1);
  });
});
