const {
  validateStandardUnitReceiveInput,
  validateSolventReceiveInput,
  composeSolventReceiveNote,
  normalizePhotoUrls,
  normalizeBottlePhotoUrls,
} = require('./stockReceiveValidation');

describe('stock receive validation', () => {
  test('requires Lot No for standard unit receive', () => {
    expect(validateStandardUnitReceiveInput({
      lotNo: '',
      purity: '99.5',
      bottles: [{ exp: '2027-01-01' }],
    })).toMatch(/Lot No/);
  });

  test('requires % Purity for standard unit receive', () => {
    expect(validateStandardUnitReceiveInput({
      lotNo: 'L1',
      purity: '',
      bottles: [{ exp: '2027-01-01' }],
    })).toMatch(/Purity/);
  });

  test('requires EXP for every standard unit bottle', () => {
    expect(validateStandardUnitReceiveInput({
      lotNo: 'L1',
      purity: '99.5',
      bottles: [{ exp: '2027-01-01' }, { exp: '' }],
    })).toMatch(/EXP/);

    expect(validateStandardUnitReceiveInput({
      lotNo: 'L1',
      purity: '99.5',
      bottles: [{ exp: 'not-a-date' }],
    })).toMatch(/EXP/);
  });

  test('accepts standard unit receive when Lot No, % Purity and EXP are present', () => {
    expect(validateStandardUnitReceiveInput({
      lotNo: 'L1',
      purity: '99.5',
      bottles: [{ exp: '2027-01-01' }, { exp: '2027-02-02' }],
    })).toBeNull();
  });

  test('requires Lot No, EXP, size and price for solvent receive', () => {
    expect(validateSolventReceiveInput({ lotNo: '', exp: '2027-01-01', sizeLiter: 2.5, price: 1200 })).toMatch(/Lot No/);
    expect(validateSolventReceiveInput({ lotNo: 'L1', exp: '', sizeLiter: 2.5, price: 1200 })).toMatch(/EXP/);
    expect(validateSolventReceiveInput({ lotNo: 'L1', exp: '2027-01-01', sizeLiter: '', price: 1200 })).toMatch(/ขนาด/);
    expect(validateSolventReceiveInput({ lotNo: 'L1', exp: '2027-01-01', sizeLiter: 0, price: 1200 })).toMatch(/ขนาด/);
    expect(validateSolventReceiveInput({ lotNo: 'L1', exp: '2027-01-01', sizeLiter: 2.5, price: '' })).toMatch(/ราคา/);
    expect(validateSolventReceiveInput({ lotNo: 'L1', exp: '2027-01-01', sizeLiter: 2.5, price: -1 })).toMatch(/ราคา/);
    expect(validateSolventReceiveInput({ lotNo: 'L1', exp: '2027-01-01', sizeLiter: 2.5, price: 1200 })).toBeNull();
  });


  test('normalizes optional receive photo URLs', () => {
    expect(normalizePhotoUrls([' /LIS/uploads/qc-photos/a.webp ', '', 'https://evil.example/a.png'])).toEqual([
      '/LIS/uploads/qc-photos/a.webp',
    ]);
    expect(normalizePhotoUrls(undefined)).toEqual([]);
  });

  test('normalizes optional per-bottle photo URLs', () => {
    expect(normalizeBottlePhotoUrls({ photoUrls: ['/uploads/qc-photos/b.png', 'file:///tmp/a.png'] })).toEqual([
      '/uploads/qc-photos/b.png',
    ]);
  });

  test('composes solvent receive note from structured fields', () => {
    expect(composeSolventReceiveNote({
      lotNo: 'L1',
      exp: '2027-01-01',
      sizeLiter: 2.5,
      price: 1200,
      note: 'new bottle',
    })).toBe('lot L1 · exp 2027-01-01 · ขนาด 2.5 L · ราคา 1200 บาท · new bottle');
  });
});
