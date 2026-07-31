import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ItemsStep, { type ItemRowValues } from './ItemsStep';

vi.mock('./SubmitterPicker', () => ({
  default: () => <div data-testid="submitter-picker" />,
}));

const baseItem: ItemRowValues = {
  seq: 1,
  sampleName: '',
  commonName: '',
  batchNo: 'BATCH001',
  lotNo: '',
  productionDate: '2026-07-14',
  packageUnit: '',
  submissionNo: '',
  testUnit: '',
  testItems: '',
  note: '',
};

function renderStep(overrides: Partial<React.ComponentProps<typeof ItemsStep>> = {}) {
  const onChange = vi.fn();
  render(
    <ItemsStep
      value={[baseItem]}
      onChange={onChange}
      submitter={{ name: 'Requester' }}
      onSubmitterChange={vi.fn()}
      deliverer={{ name: 'Deliverer' }}
      onDelivererChange={vi.fn()}
      masterItemOptions={[
        {
          itemNo: 'P001',
          sampleName: 'Product A 1.8 EC',
          commonName: 'ABAMECTIN 1.8% W/V EC',
          packageUnit: '1 L x 12 bottles',
        },
      ]}
      {...overrides}
    />,
  );
  return { onChange };
}

describe('ItemsStep master item selection', () => {
  it('requires selecting sample name from master item and fills common name plus package size', () => {
    const { onChange } = renderStep();

    fireEvent.click(screen.getByRole('combobox', { name: /ชื่อตัวอย่าง/ }));
    fireEvent.click(screen.getByText('Product A 1.8 EC'));

    expect(onChange).toHaveBeenCalledWith([
      {
        ...baseItem,
        sampleName: 'Product A 1.8 EC',
        commonName: 'ABAMECTIN 1.8% W/V EC',
        packageUnit: '1 L x 12 bottles',
      },
    ]);
  });

  it('does not render Lot No. or submission number fields', () => {
    renderStep();

    expect(screen.queryByText(/Lot No\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/ใบนำส่ง/)).not.toBeInTheDocument();
  });

  it('lets R&D type a sample name and fills empty fields from a matching master item', () => {
    const { onChange } = renderStep({
      allowManualItemFields: true,
      requireDeliveryAndBatch: false,
    });

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Product A 1.8 EC' },
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...baseItem,
        sampleName: 'Product A 1.8 EC',
        commonName: 'ABAMECTIN 1.8% W/V EC',
        packageUnit: '1 L x 12 bottles',
      },
    ]);
  });

  it('does not overwrite R&D item fields that were already typed when selecting a master item', () => {
    const { onChange } = renderStep({
      value: [{
        ...baseItem,
        sampleName: 'Typed sample',
        commonName: 'Typed common',
        packageUnit: 'Typed package',
      }],
      allowManualItemFields: true,
      requireDeliveryAndBatch: false,
    });

    fireEvent.click(screen.getByText('Master'));
    fireEvent.click(screen.getByText('Product A 1.8 EC'));

    expect(onChange).toHaveBeenCalledWith([
      {
        ...baseItem,
        sampleName: 'Typed sample',
        commonName: 'Typed common',
        packageUnit: 'Typed package',
      },
    ]);
  });
});
