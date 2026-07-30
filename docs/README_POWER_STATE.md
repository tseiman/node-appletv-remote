# Companion Power-State Monitoring

This document describes the typed Apple TV power-state API implemented over Companion Link.

## Scope

The implementation observes Apple TV system status. It does not infer standby from ping, mDNS presence, MRP connectivity, or media playback. An Apple TV can remain reachable while asleep, so network reachability is not a valid power signal.

## Prerequisites

1. Discover the Apple TV with `scan()` or `atv scan`.
2. Pair once over Companion Link with `atv companion-pair`.
3. Store the returned Companion credentials outside the source tree.
4. Connect with `AppleTV.connectCompanion()`.

Companion credentials authenticate a trusted remote. Never commit, log, or share them.

## Protocol flow

`connectCompanion()` performs these steps after HAP pair verification:

1. Send `_systemInfo` with a stable paired-client identity.
2. Open `com.apple.tvremoteservices` with `_sessionStart`.
3. Attempt `TVRCSessionStart` using protocol version `1.2`.
4. Attempt an initial `FetchAttentionState` request.
5. Subscribe to `SystemStatus` and `TVSystemStatus` through `_interest` events, regardless of whether the initial query succeeded.

`TVRCSessionStart` and `FetchAttentionState` are not implemented consistently across tvOS releases. Failure of either request is therefore non-fatal. Pushed status events remain authoritative.

On a clean shutdown, the library sends `_sessionStop`. A transport close or explicit `close()` resets the public state to `Unknown`.

## Public states

`AppleTV.systemStatus` exposes the normalized Companion status:

- `CompanionSystemStatus.Unknown` (`0`)
- `CompanionSystemStatus.Asleep` (`1`)
- `CompanionSystemStatus.Screensaver` (`2`)
- `CompanionSystemStatus.Awake` (`3`)
- `CompanionSystemStatus.Idle` (`4`)

Unsupported values are normalized to `Unknown` rather than being exposed as an unsafe enum cast.

`AppleTV.powerState` maps the detailed status to:

- `Asleep` → `PowerState.Off`
- `Screensaver` → `PowerState.On`
- `Awake` → `PowerState.On`
- `Idle` → `PowerState.On`
- missing, malformed, unsupported, or disconnected → `PowerState.Unknown`

`Unknown` is not equivalent to `Off`. Applications must not use it to trigger standby actions.

## Events

### `powerStateChanged`

Emitted only when the normalized state changes between `unknown`, `on`, and `off`.

```typescript
import { PowerState, type PowerStateChangedEvent } from 'node-appletv-remote';

atv.on('powerStateChanged', (event: PowerStateChangedEvent) => {
  console.log(event.previous, event.current, event.systemStatus);

  if (event.current === PowerState.Off) {
    // Handle a confirmed standby transition.
  }
});
```

### `systemStatusChanged`

Emitted for every detailed status transition, including active-to-active changes such as `Awake` to `Idle`.

```typescript
import type { SystemStatusChangedEvent } from 'node-appletv-remote';

atv.on('systemStatusChanged', (event: SystemStatusChangedEvent) => {
  console.log(event.previous, event.current, event.powerState);
});
```

Duplicate events carrying the same status are suppressed.

## CLI

Show the current state and disconnect:

```bash
atv power [deviceId]
```

Monitor status transitions:

```bash
atv monitor-power [deviceId]
```

Example output:

```text
2026-07-30T12:00:00.000Z | Power: on | System status: Awake (3)
2026-07-30T12:15:00.000Z | Power: off | System status: Asleep (1)
```

## Reconnection policy

The library currently reports disconnects but does not hide reconnection behind the `AppleTV` object. Applications should:

1. treat the state as `Unknown` after `companionClose`;
2. reconnect with bounded exponential backoff;
3. call `connectCompanion()` again, which recreates the remote session and subscriptions;
4. wait for `Off` before taking any standby-only action.

This keeps retry policy, shutdown behavior, and operational logging under application control.

## KidControl integration rule

A confirmed transition to `PowerState.Off` may end active normal claims and persist consumed time. `PowerState.Unknown` must not end claims. A later transition to `PowerState.On` must not automatically resume a previously ended claim.

## Verification

Automated tests cover:

- Companion request and event envelopes;
- remote-session start and stop;
- unsupported `TVRCSessionStart`;
- initial attention-state parsing;
- status normalization and power mapping;
- event deduplication;
- raw active-state transitions;
- malformed and unrelated events;
- reset to `Unknown` on close;
- CLI status formatting.

Before relying on power state in production, test against every target Apple TV model and tvOS version:

1. normal Home screen;
2. media playback and pause;
3. screensaver;
4. manual sleep;
5. wake by physical remote;
6. network interruption and reconnect;
7. process restart with stored credentials.

## References and attribution

The protocol behavior was implemented in TypeScript using the existing Companion transport in this project. The session and power-state flow was informed by the MIT-licensed [pyatv](https://github.com/postlund/pyatv) Companion implementation and Apple TV behavior observed by that project. No Python runtime or Python sidecar is required.
