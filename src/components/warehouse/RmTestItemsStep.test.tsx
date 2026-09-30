import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RmTestItemsStep from './RmTestItemsStep';

describe('RmTestItemsStep search ranking', () => {
  it('ranks codes while retaining fuzzy matches and excluding empty common names', () => {
    render(
      <RmTestItemsStep
        batches={[{ batchNo: 'B001' }]}
        value={[]}
        onChange={vi.fn()}
        masterItemOptions={[
          { itemNo: 'AA', sampleName: 'Rising name', commonName: 'Alpha', packageUnit: '' },
          { itemNo: 'RI-100', sampleName: 'Prefix code', commonName: 'Alpha', packageUnit: '' },
          { itemNo: 'RI', sampleName: 'Exact code', commonName: 'Alpha', packageUnit: '' },
          { itemNo: 'RI', sampleName: 'Excluded', commonName: '', packageUnit: '' },
          { itemNo: 'BB', sampleName: 'Alpha Beta', commonName: 'Alpha', packageUnit: '' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('combobox'));
    const search = screen.getByPlaceholderText('ค้นหาชื่อตัวอย่างจาก Master Item...');
    fireEvent.change(search, { target: { value: 'ri' } });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      expect.stringContaining('Exact code'),
      expect.stringContaining('Prefix code'),
      expect.stringContaining('Rising name'),
    ]);
    expect(screen.queryByText('Excluded')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'albt' } });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([expect.stringContaining('Alpha Beta')]);
    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Rising name');
  });
});
