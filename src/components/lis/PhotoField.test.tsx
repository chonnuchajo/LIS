import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoField } from './PhotoField';

vi.mock('@/lib/api', () => ({
  uploadQcPhoto: vi.fn(),
  deleteQcPhoto: vi.fn(),
}));

const field = { label: 'Media', type: 'photo' as const, maxPhotos: 5 };

describe('PhotoField', () => {
  it('renders saved images and videos', () => {
    const { container } = render(
      <PhotoField
        field={field}
        value={['/LIS/uploads/qc-photos/a.webp', '/LIS/api/uploads/qc-photos/b.mp4']}
        onChange={() => {}}
      />,
    );

    expect(screen.getByAltText('QC photo')).toHaveAttribute('src', '/LIS/uploads/qc-photos/a.webp');
    expect(screen.getByLabelText('QC video')).toHaveAttribute('src', '/LIS/uploads/qc-photos/b.mp4');
    expect(container.querySelector('input[type="file"]')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime',
    );
  });
});
