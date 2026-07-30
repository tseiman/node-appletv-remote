import { describe, expect, it } from 'vitest';
import {
  CompanionSystemStatus,
  PowerState,
  companionSystemStatusFromValue,
  powerStateFromSystemStatus,
} from '../power-state.js';

describe('powerStateFromSystemStatus', () => {
  it('normalizes unsupported and malformed system status values', () => {
    expect(companionSystemStatusFromValue(CompanionSystemStatus.Awake))
      .toBe(CompanionSystemStatus.Awake);
    expect(companionSystemStatusFromValue(99)).toBe(CompanionSystemStatus.Unknown);
    expect(companionSystemStatusFromValue('awake')).toBe(CompanionSystemStatus.Unknown);
  });

  it('maps sleep to off', () => {
    expect(powerStateFromSystemStatus(CompanionSystemStatus.Asleep)).toBe(PowerState.Off);
  });

  it.each([
    CompanionSystemStatus.Screensaver,
    CompanionSystemStatus.Awake,
    CompanionSystemStatus.Idle,
  ])('maps active system status %s to on', (status) => {
    expect(powerStateFromSystemStatus(status)).toBe(PowerState.On);
  });

  it('maps unsupported values to unknown', () => {
    expect(powerStateFromSystemStatus(CompanionSystemStatus.Unknown)).toBe(PowerState.Unknown);
    expect(powerStateFromSystemStatus(99)).toBe(PowerState.Unknown);
  });
});
