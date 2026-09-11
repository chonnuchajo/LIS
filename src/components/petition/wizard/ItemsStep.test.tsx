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
        itemNo: 'P001',
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

    fireEvent.change(screen.getByLabelText('ชื่อตัวอย่าง'), {
      target: { value: 'Product A 1.8 EC' },
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...baseItem,
        itemNo: 'P001',
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

    fireEvent.click(screen.getByLabelText('ชื่อสามัญ / Active Ingredient'));
    fireEvent.click(screen.getByText('Product A 1.8 EC'));

    // itemNo คือตัวตนของ master item ที่เลือก ไม่ใช่ค่าที่คนพิมพ์เอง — ต้องตามของที่เลือกเสมอ
    expect(onChange).toHaveBeenCalledWith([
      {
        ...baseItem,
        itemNo: 'P001',
        sampleName: 'Typed sample',
        commonName: 'Typed common',
        packageUnit: 'Typed package',
      },
    ]);
  });

  it('shows submitted quantity and unit from integration payload as read-only fields', () => {
    renderStep({
      value: [{
        ...baseItem,
        submittedQuantity: '9478.67',
        submittedUnit: 'Kg/L',
      }],
      itemsReadOnly: true,
    });

    expect(screen.getByLabelText('ปริมาณที่ส่งตัวอย่าง')).toHaveValue('9478.67');
    expect(screen.getByLabelText('หน่วยที่นำส่ง')).toHaveValue('Kg/L');
  });

  it('defaults LAB choice from batch suffix 1/6 and lets user override it', () => {
    const { onChange } = renderStep();

    expect(screen.getByRole('button', { name: 'ส่ง LAB' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'ไม่ส่ง LAB' }));

    expect(onChange).toHaveBeenCalledWith([{ ...baseItem, sendToLab: false }]);
  });

  it('keeps LAB choice as explicit true when user chooses the default send option', () => {
    const { onChange } = renderStep();

    fireEvent.click(screen.getByRole('button', { name: 'ส่ง LAB' }));

    expect(onChange).toHaveBeenCalledWith([{ ...baseItem, sendToLab: true }]);
  });

  it('updates LAB choice to true when batch changes into the legacy Lab suffix', () => {
    const { onChange } = renderStep({ value: [{ ...baseItem, batchNo: 'BATCH002', sendToLab: false }] });

    fireEvent.change(screen.getByPlaceholderText('เช่น BN240601'), { target: { value: 'BATCH001' } });

    expect(onChange).toHaveBeenCalledWith([{ ...baseItem, batchNo: 'BATCH001', sendToLab: true }]);
  });

  it('defaults LAB choice to not send for other batch suffixes', () => {
    renderStep({ value: [{ ...baseItem, batchNo: 'BATCH002' }] });

    expect(screen.getByRole('button', { name: 'ไม่ส่ง LAB' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a red note label and reason placeholder when LAB choice differs from the default', () => {
    renderStep({ value: [{ ...baseItem, sendToLab: false }] });

    expect(screen.queryByText('เลือกต่างจากค่าเริ่มต้น')).not.toBeInTheDocument();
    expect(screen.queryByText('ต้องระบุหมายเหตุเมื่อเลือกส่ง LAB ต่างจากค่าเริ่มต้น')).not.toBeInTheDocument();
    expect(screen.getByText('โปรดระบุ')).toHaveClass('text-red-500');
    expect(screen.getByPlaceholderText('โปรดระบุเหตุผล')).toBeInTheDocument();
  });

  // itemNo ขับ "หมวดหมู่ย่อย (prefix code)" + "กลุ่ม Item" ของ parameter — ถ้าค้างรหัสเก่าไว้
  // ตอนคนพิมพ์ชื่อที่ไม่ตรง master item ไหนเลย พารามิเตอร์จะขึ้นผิดตัว
  it('clears itemNo when a typed sample name matches no master item', () => {
    const { onChange } = renderStep({
      value: [{ ...baseItem, itemNo: 'P001', sampleName: 'Product A 1.8 EC' }],
      allowManualItemFields: true,
      requireDeliveryAndBatch: false,
    });

    fireEvent.change(screen.getByLabelText('ชื่อตัวอย่าง'), {
      target: { value: 'Something nobody sells' },
    });

    expect(onChange).toHaveBeenCalledWith([
      { ...baseItem, itemNo: '', sampleName: 'Something nobody sells' },
    ]);
  });

  it('uses the R&D active ingredient field as the master item picker trigger', () => {
    renderStep({
      allowManualItemFields: true,
      requireDeliveryAndBatch: false,
    });

    expect(screen.queryByText('Master')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('ชื่อสามัญ / Active Ingredient'));

    expect(screen.getByText('Product A 1.8 EC')).toBeInTheDocument();
  });
});
