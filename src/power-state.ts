export enum CompanionSystemStatus {
  Unknown = 0x00,
  Asleep = 0x01,
  Screensaver = 0x02,
  Awake = 0x03,
  Idle = 0x04,
}

export enum PowerState {
  Unknown = 'unknown',
  On = 'on',
  Off = 'off',
}

export function companionSystemStatusFromValue(value: unknown): CompanionSystemStatus {
  if (
    value === CompanionSystemStatus.Asleep
    || value === CompanionSystemStatus.Screensaver
    || value === CompanionSystemStatus.Awake
    || value === CompanionSystemStatus.Idle
  ) {
    return value;
  }
  return CompanionSystemStatus.Unknown;
}

export function powerStateFromSystemStatus(status: number): PowerState {
  if (status === CompanionSystemStatus.Asleep) return PowerState.Off;
  if (
    status === CompanionSystemStatus.Screensaver
    || status === CompanionSystemStatus.Awake
    || status === CompanionSystemStatus.Idle
  ) {
    return PowerState.On;
  }
  return PowerState.Unknown;
}
