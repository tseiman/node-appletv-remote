import { describe, expect, it } from 'vitest';
import { createInitialTransferId } from '../connection.js';

describe('CompanionConnection transfer identifiers', () => {
  it('starts encrypted requests with a non-zero 16-bit transfer identifier', () => {
    for (let index = 0; index < 64; index += 1) {
      const transferId = createInitialTransferId();
      expect(Number.isInteger(transferId)).toBe(true);
      expect(transferId).toBeGreaterThanOrEqual(1);
      expect(transferId).toBeLessThanOrEqual(0xffff);
    }
  });
});
