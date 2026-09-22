import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmitterPicker, { filterSubmitterOptions } from './SubmitterPicker';

vi.mock('@/hooks/useExternalLookups', () => ({
  useEmployeeOptions: () => ({ options: [], loading: false, optionMap: new Map() }),
}));

describe('SubmitterPicker', () => {
  it('filters submitters to QC daily staff', () => {
    const option = (overrides: Partial<Parameters<typeof filterSubmitterOptions>[0][number]>) => ({
      id: '1',
      label: 'พนักงาน',
      name: 'พนักงาน',
      email: '',
      department: 'ควบคุมคุณภาพ',
      position: 'เจ้าหน้าที่',
      employeeType: 'รายวัน',
      ...overrides,
    });

    expect(filterSubmitterOptions([
      option({ id: 'match' }),
      option({ id: 'wrong-department', department: 'ผลิต' }),
      option({ id: 'wrong-position', position: 'หัวหน้า' }),
      option({ id: 'wrong-type', employeeType: 'รายเดือน' }),
    ]).map((item) => item.id)).toEqual(['match']);
  });

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
