import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmitterPicker from './SubmitterPicker';

vi.mock('@/hooks/useExternalLookups', () => ({
  useEmployeeOptions: () => ({ options: [], loading: false, optionMap: new Map() }),
}));

describe('SubmitterPicker', () => {
  it('shows plain department label in read-only mode', () => {
    render(
      <SubmitterPicker
        value={{ employeeId: 'E001', name: 'สมชาย' }}
        onChange={vi.fn()}
        readOnly
        department="QC"
      />,
    );

    expect(screen.getByText('แผนก')).toBeInTheDocument();
    expect(screen.queryByText(/จากระบบ HR/)).not.toBeInTheDocument();
    expect(screen.getByText('QC')).toBeInTheDocument();
  });
});
