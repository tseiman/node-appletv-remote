import { CompanionSystemStatus, PowerState } from '../power-state.js';

export function formatPowerStatus(
  powerState: PowerState,
  systemStatus: CompanionSystemStatus,
): string[] {
  const statusName = CompanionSystemStatus[systemStatus] ?? 'Unknown';
  return [
    `Power: ${powerState}`,
    `System status: ${statusName} (${systemStatus})`,
  ];
}
