import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SampleLabelPrintTemplate from '../SampleLabelPrintTemplate';
import type { Petition } from '@/types/petition.types';

const petition: Petition = {
  _id: 'petition-1',
  petitionNo: 'P-2607-0001',
  dept: 'production',
  status: 'sampleSent',
  submittedBy: {
    employeeId: 'dev-admin',
    name: 'Dev Administrator',
    submittedAt: '2026-07-13T00:00:00.000Z',
  },
  items: [
    {
      seq: 1,
      sampleId: '69',
      sampleName: '25 PACLOBUTRAZOL 25% SC',
      commonName: '',
      batchNo: '26S-PCB25SC-HI-026',
      lotNo: '1',
      productionDate: '2026-07-13',
      labelSampledDate: '2026-07-13',
      labelSampledBy: 'Dev Administrator',
    },
  ],
  createdAt: '2026-07-13T00:00:00.000Z',
  updatedAt: '2026-07-13T00:00:00.000Z',
};

describe('SampleLabelPrintTemplate', () => {
  it('prints the batch number as text below the small batch QR code', () => {
    render(<SampleLabelPrintTemplate petition={petition} />);

    expect(screen.getByTestId('sample-label-batch-qr-text')).toHaveTextContent('26S-PCB25SC-HI-026');
  });

  it('keeps the document number out of the title flow instead of absolutely overlaying it', () => {
    const { container } = render(<SampleLabelPrintTemplate petition={petition} />);

    expect(container.querySelector('.label-card .absolute.right-0.top-0')).not.toBeInTheDocument();
  });

  it('renders the requested one-line label header and keeps the document number smaller', () => {
    render(<SampleLabelPrintTemplate petition={petition} />);

    expect(screen.getByTestId('sample-label-header-title')).toBeInTheDocument();
    expect(screen.getByTestId('sample-label-title-line')).toHaveTextContent(
      'ป้ายนำส่งตัวอย่าง บริษัท ไอ ซี พี ลัดดา จำกัด',
    );
    expect(screen.getByTestId('sample-label-title-line')).toHaveClass('whitespace-nowrap');
    expect(screen.getByTestId('sample-label-document-number')).toHaveClass('text-[7px]');
  });

  it('shows the full batch number instead of truncating it with an ellipsis', () => {
    render(<SampleLabelPrintTemplate petition={petition} />);

    const batchNumber = screen.getByTestId('sample-label-batch-number-value');
    expect(batchNumber).toHaveTextContent('26S-PCB25SC-HI-026');
    expect(batchNumber).not.toHaveClass('text-ellipsis');
    expect(batchNumber).not.toHaveClass('overflow-hidden');
  });
});
