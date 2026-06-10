import { describe, it, expect } from 'vitest';
import { isAssignedTo } from './assignment';

describe('isAssignedTo', () => {
  it('matches by employeeId even when display names differ', () => {
    // The bug: Azure AD name ("Ketkanok S.") differs from the directory name
    // ("นางสาวเกศกนก สิริเหล่าตระกูล") captured at assign time.
    expect(
      isAssignedTo(
        { employeeId: 'E123', name: 'นางสาวเกศกนก สิริเหล่าตระกูล' },
        { employeeId: 'E123', name: 'Ketkanok S.' },
      ),
    ).toBe(true);
  });

  it('does not match different employeeIds even if names collide', () => {
    expect(
      isAssignedTo(
        { employeeId: 'E123', name: 'สมชาย' },
        { employeeId: 'E999', name: 'สมชาย' },
      ),
    ).toBe(false);
  });

  it('falls back to name when the user is not linked (no employeeId)', () => {
    expect(
      isAssignedTo({ employeeId: 'E123', name: 'สมชาย' }, { name: 'สมชาย' }),
    ).toBe(true);
    expect(
      isAssignedTo({ employeeId: 'E123', name: 'สมชาย' }, { name: 'สมหญิง' }),
    ).toBe(false);
  });

  it('falls back to name when the petition predates employeeId capture', () => {
    expect(
      isAssignedTo({ name: 'สมชาย' }, { employeeId: 'E123', name: 'สมชาย' }),
    ).toBe(true);
  });

  it('never matches on two absent values', () => {
    expect(isAssignedTo({}, {})).toBe(false);
    expect(isAssignedTo({ name: '' }, { name: '' })).toBe(false);
    expect(isAssignedTo(null, { employeeId: 'E1' })).toBe(false);
    expect(isAssignedTo({ employeeId: 'E1' }, undefined)).toBe(false);
  });
});
