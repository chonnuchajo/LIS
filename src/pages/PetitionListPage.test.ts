import { describe, expect, it } from 'vitest';
import { canUserCreatePetition } from './PetitionListPage';

describe('canUserCreatePetition', () => {
  it('hides the create petition action for viewer-only users even when the route is accessible', () => {
    expect(canUserCreatePetition({ role: 'viewer' }, true)).toBe(false);
    expect(canUserCreatePetition({ roles: ['viewer'] }, true)).toBe(false);
  });

  it('shows the create petition action for non-viewer users with access', () => {
    expect(canUserCreatePetition({ role: 'lab' }, true)).toBe(true);
    expect(canUserCreatePetition({ roles: ['viewer', 'qc'] }, true)).toBe(true);
  });

  it('hides the create petition action when the route is not accessible', () => {
    expect(canUserCreatePetition({ role: 'lab' }, false)).toBe(false);
  });
});
