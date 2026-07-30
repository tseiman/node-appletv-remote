import { describe, expect, it } from 'vitest';
import { CompanionSystemStatus, PowerState } from '../../power-state.js';
import { formatPowerStatus } from '../power.js';

describe('formatPowerStatus', () => {
  it('formats known states for humans and scripts', () => {
    expect(formatPowerStatus(PowerState.Off, CompanionSystemStatus.Asleep))
      .toEqual(['Power: off', 'System status: Asleep (1)']);
  });

  it('formats an unavailable state explicitly', () => {
    expect(formatPowerStatus(PowerState.Unknown, CompanionSystemStatus.Unknown))
      .toEqual(['Power: unknown', 'System status: Unknown (0)']);
  });
});
