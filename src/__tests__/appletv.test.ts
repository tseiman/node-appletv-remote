import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  AppleTV,
  Key,
  type PowerStateChangedEvent,
  type SystemStatusChangedEvent,
} from '../appletv.js';
import { Credentials } from '../credentials.js';
import { NowPlayingInfo } from '../now-playing-info.js';
import { SupportedCommand } from '../supported-command.js';
import { Message } from '../message.js';
import { MessageType } from '../mrp/messages.js';
import { CompanionConnection } from '../companion/connection.js';
import type { OpackDict } from '../companion/opack.js';
import { CompanionSystemStatus, PowerState } from '../power-state.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppleTV', () => {
  it('creates from discovered device info', () => {
    const atv = new AppleTV({
      name: 'Living Room',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC',
      model: 'AppleTV6,2',
    });
    expect(atv.name).toBe('Living Room');
    expect(atv.address).toBe('192.168.1.100');
  });

  it('has remote control methods', () => {
    const atv = new AppleTV({
      name: 'Test',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC',
      model: 'AppleTV6,2',
    });
    expect(typeof atv.up).toBe('function');
    expect(typeof atv.down).toBe('function');
    expect(typeof atv.left).toBe('function');
    expect(typeof atv.right).toBe('function');
    expect(typeof atv.select).toBe('function');
    expect(typeof atv.menu).toBe('function');
    expect(typeof atv.home).toBe('function');
    expect(typeof atv.playPause).toBe('function');
    expect(typeof atv.volumeUp).toBe('function');
    expect(typeof atv.volumeDown).toBe('function');
  });

  it('has new media control methods', () => {
    const atv = new AppleTV({
      name: 'Test',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC',
      model: 'AppleTV6,2',
    });
    expect(typeof atv.play).toBe('function');
    expect(typeof atv.pause).toBe('function');
    expect(typeof atv.stop).toBe('function');
    expect(typeof atv.next).toBe('function');
    expect(typeof atv.previous).toBe('function');
    expect(typeof atv.wake).toBe('function');
    expect(typeof atv.suspend).toBe('function');
    expect(typeof atv.requestPlaybackQueue).toBe('function');
    expect(typeof atv.requestArtwork).toBe('function');
    expect(typeof atv.sendKeyCommand).toBe('function');
  });

  it('throws when calling commands without connection', async () => {
    const atv = new AppleTV({
      name: 'Test',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC',
      model: 'AppleTV6,2',
    });

    await expect(atv.play()).rejects.toThrow('Not connected');
    await expect(atv.pause()).rejects.toThrow('Not connected');
    await expect(atv.next()).rejects.toThrow('Not connected');
    await expect(atv.wake()).rejects.toThrow('Not connected');
    await expect(atv.suspend()).rejects.toThrow('Not connected');
    await expect(atv.requestPlaybackQueue()).rejects.toThrow('Not connected');
  });

  it('initializes a remote session after Companion pair verification', async () => {
    const connect = vi.spyOn(CompanionConnection.prototype, 'connect').mockResolvedValue();
    vi.spyOn(CompanionConnection.prototype, 'sendMessage').mockImplementation(() => {});
    const sendRequest = vi.spyOn(CompanionConnection.prototype, 'sendRequest')
      .mockImplementation(async (identifier): Promise<OpackDict> => {
        if (identifier === '_sessionStart') {
          return new Map([['_c', new Map([['_sid', 7]])]]);
        }
        return new Map();
      });
    const atv = new AppleTV({
      name: 'Living Room',
      address: '192.168.1.100',
      port: 7000,
      companionPort: 49152,
      deviceId: 'AA:BB:CC:DD:EE:FF',
      model: 'AppleTV6,2',
    });
    const credentials = {
      clientId: 'companion-client',
      clientLTSK: Buffer.alloc(32, 1),
      clientLTPK: Buffer.alloc(32, 2),
      serverLTPK: Buffer.alloc(32, 3),
      serverId: 'server',
    };

    await atv.connectCompanion(credentials);

    expect(connect).toHaveBeenCalledOnce();
    expect(sendRequest.mock.calls.map(([identifier]) => identifier)).toEqual([
      '_systemInfo',
      '_sessionStart',
      'TVRCSessionStart',
      'FetchAttentionState',
    ]);
    await atv.close();
    expect(sendRequest.mock.calls.at(-1)?.[0]).toBe('_sessionStop');
  });

  it('cleans up a Companion connection when remote-session setup fails', async () => {
    vi.spyOn(CompanionConnection.prototype, 'connect').mockResolvedValue();
    vi.spyOn(CompanionConnection.prototype, 'sendRequest').mockResolvedValue(new Map());
    const close = vi.spyOn(CompanionConnection.prototype, 'close').mockImplementation(() => {});
    const atv = new AppleTV({
      name: 'Living Room',
      address: '192.168.1.100',
      port: 7000,
      companionPort: 49152,
      deviceId: 'AA:BB:CC:DD:EE:FF',
      model: 'AppleTV6,2',
    });

    await expect(atv.connectCompanion({
      clientId: 'companion-client',
      clientLTSK: Buffer.alloc(32, 1),
      clientLTPK: Buffer.alloc(32, 2),
      serverLTPK: Buffer.alloc(32, 3),
      serverId: 'server',
    })).rejects.toThrow('Companion session response is missing _c');

    expect(close).toHaveBeenCalledOnce();
    expect(() => atv.sendCompanionMessage('test', new Map())).toThrow('Companion not connected');
  });

  it('fetches and exposes the initial Companion power state', async () => {
    vi.spyOn(CompanionConnection.prototype, 'connect').mockResolvedValue();
    const sendMessage = vi.spyOn(CompanionConnection.prototype, 'sendMessage')
      .mockImplementation(() => {});
    vi.spyOn(CompanionConnection.prototype, 'sendRequest')
      .mockImplementation(async (identifier): Promise<OpackDict> => {
        if (identifier === '_sessionStart') {
          return new Map([['_c', new Map([['_sid', 7]])]]);
        }
        if (identifier === 'FetchAttentionState') {
          return new Map([['_c', new Map([['state', CompanionSystemStatus.Awake]])]]);
        }
        return new Map();
      });
    const atv = new AppleTV({
      name: 'Living Room',
      address: '192.168.1.100',
      port: 7000,
      companionPort: 49152,
      deviceId: 'AA:BB:CC:DD:EE:FF',
      model: 'AppleTV6,2',
    });
    const changes: unknown[] = [];
    atv.on('powerStateChanged', (event) => changes.push(event));

    await atv.connectCompanion({
      clientId: 'companion-client',
      clientLTSK: Buffer.alloc(32, 1),
      clientLTPK: Buffer.alloc(32, 2),
      serverLTPK: Buffer.alloc(32, 3),
      serverId: 'server',
    });

    expect(atv.powerState).toBe(PowerState.On);
    expect(sendMessage.mock.calls.map(([identifier, message]) => ({
      identifier,
      events: (message.get('_c') as OpackDict).get('_regEvents'),
    }))).toEqual([
      { identifier: '_interest', events: ['SystemStatus'] },
      { identifier: '_interest', events: ['TVSystemStatus'] },
    ]);
    const fetchCallOrder = vi.mocked(CompanionConnection.prototype.sendRequest)
      .mock.invocationCallOrder[3];
    expect(Math.min(...sendMessage.mock.invocationCallOrder)).toBeGreaterThan(fetchCallOrder);
    expect(changes).toEqual([{
      previous: PowerState.Unknown,
      current: PowerState.On,
      systemStatus: CompanionSystemStatus.Awake,
    }]);
    await atv.close();
    expect(atv.powerState).toBe(PowerState.Unknown);
    expect(changes).toHaveLength(2);
    expect(changes[1]).toEqual({
      previous: PowerState.On,
      current: PowerState.Unknown,
      systemStatus: CompanionSystemStatus.Unknown,
    });
  });

  it('updates power state from Companion status events without duplicate changes', () => {
    const atv = new AppleTV({
      name: 'Living Room',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC:DD:EE:FF',
      model: 'AppleTV6,2',
    });
    const powerChanges: PowerStateChangedEvent[] = [];
    const systemChanges: SystemStatusChangedEvent[] = [];
    atv.on('powerStateChanged', (event) => powerChanges.push(event));
    atv.on('systemStatusChanged', (event) => systemChanges.push(event));
    const asleepEvent = {
      identifier: 'TVSystemStatus',
      data: new Map([['_c', new Map([['state', CompanionSystemStatus.Asleep]])]]),
    };

    (atv as any).handleCompanionEvent(asleepEvent);
    (atv as any).handleCompanionEvent(asleepEvent);

    expect(atv.powerState).toBe(PowerState.Off);
    expect(atv.systemStatus).toBe(CompanionSystemStatus.Asleep);
    expect(powerChanges).toEqual([{
      previous: PowerState.Unknown,
      current: PowerState.Off,
      systemStatus: CompanionSystemStatus.Asleep,
    }]);
    expect(systemChanges).toHaveLength(1);
  });

  it('reports raw active-state transitions without duplicate power changes', () => {
    const atv = new AppleTV({
      name: 'Living Room',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC:DD:EE:FF',
      model: 'AppleTV6,2',
    });
    const powerChanges: PowerStateChangedEvent[] = [];
    const systemChanges: SystemStatusChangedEvent[] = [];
    atv.on('powerStateChanged', (event) => powerChanges.push(event));
    atv.on('systemStatusChanged', (event) => systemChanges.push(event));

    for (const state of [CompanionSystemStatus.Awake, CompanionSystemStatus.Idle]) {
      (atv as any).handleCompanionEvent({
        identifier: 'SystemStatus',
        data: new Map([['_c', new Map([['state', state]])]]),
      });
    }

    expect(powerChanges).toHaveLength(1);
    expect(systemChanges).toHaveLength(2);
    expect(atv.powerState).toBe(PowerState.On);
    expect(atv.systemStatus).toBe(CompanionSystemStatus.Idle);
  });

  it('ignores malformed and unrelated Companion events', () => {
    const atv = new AppleTV({
      name: 'Living Room',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC:DD:EE:FF',
      model: 'AppleTV6,2',
    });

    (atv as any).handleCompanionEvent({ identifier: 'Other', data: new Map() });
    (atv as any).handleCompanionEvent({
      identifier: 'SystemStatus',
      data: new Map([['_c', new Map([['state', 'asleep']])]]),
    });

    expect(atv.powerState).toBe(PowerState.Unknown);
    expect(atv.systemStatus).toBe(CompanionSystemStatus.Unknown);
  });

  it('handleMRPMessage emits nowPlaying for SetState with nowPlayingInfo', () => {
    const atv = new AppleTV({
      name: 'Test',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC',
      model: 'AppleTV6,2',
    });

    const received: NowPlayingInfo[] = [];
    atv.on('nowPlaying', (info: NowPlayingInfo) => received.push(info));

    // Simulate an MRP message by calling handleMRPMessage via the internal handler
    // Since handleMRPMessage is private, we trigger it via the event path
    const msg = {
      type: MessageType.SetState,
      identifier: 'test-id',
      '.setStateMessage': {
        playbackState: 1,
        displayName: 'Music',
        nowPlayingInfo: {
          title: 'Song',
          artist: 'Artist',
          duration: 300,
          elapsedTime: 100,
        },
      },
    };

    // Access private method for testing
    (atv as any).handleMRPMessage(msg);

    expect(received).toHaveLength(1);
    expect(received[0].title).toBe('Song');
    expect(received[0].artist).toBe('Artist');
    expect(received[0].appDisplayName).toBe('Music');
  });

  it('handleMRPMessage emits supportedCommands for SetState with supportedCommands', () => {
    const atv = new AppleTV({
      name: 'Test',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC',
      model: 'AppleTV6,2',
    });

    const received: SupportedCommand[][] = [];
    atv.on('supportedCommands', (cmds: SupportedCommand[]) => received.push(cmds));

    (atv as any).handleMRPMessage({
      type: MessageType.SetState,
      identifier: 'test-id',
      '.setStateMessage': {
        supportedCommands: {
          supportedCommands: [
            { command: 1, enabled: true },
            { command: 2, enabled: true },
          ],
        },
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toHaveLength(2);
  });

  it('handleMRPMessage emits message for every MRP message', () => {
    const atv = new AppleTV({
      name: 'Test',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC',
      model: 'AppleTV6,2',
    });

    const received: Message[] = [];
    atv.on('message', (msg: Message) => received.push(msg));

    (atv as any).handleMRPMessage({
      type: MessageType.DeviceInfo,
      identifier: 'xyz',
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe(MessageType.DeviceInfo);
  });

  it('handleMRPMessage emits playbackQueue', () => {
    const atv = new AppleTV({
      name: 'Test',
      address: '192.168.1.100',
      port: 7000,
      deviceId: 'AA:BB:CC',
      model: 'AppleTV6,2',
    });

    const received: Record<string, unknown>[] = [];
    atv.on('playbackQueue', (q: Record<string, unknown>) => received.push(q));

    (atv as any).handleMRPMessage({
      type: MessageType.SetState,
      identifier: 'test',
      '.setStateMessage': {
        playbackQueue: {
          contentItems: [{ identifier: 'item1' }],
        },
      },
    });

    expect(received).toHaveLength(1);
    expect((received[0].contentItems as any[])[0].identifier).toBe('item1');
  });
});

describe('Key enum', () => {
  it('has all expected key values', () => {
    expect(Key.Up).toBe('up');
    expect(Key.Play).toBe('play');
    expect(Key.Pause).toBe('pause');
    expect(Key.Next).toBe('next');
    expect(Key.Previous).toBe('previous');
    expect(Key.Wake).toBe('wake');
    expect(Key.Suspend).toBe('suspend');
  });
});

describe('Credentials', () => {
  it('serializes and deserializes', () => {
    const creds = new Credentials({
      clientId: 'abc',
      clientLTSK: Buffer.alloc(32, 0x01),
      clientLTPK: Buffer.alloc(32, 0x02),
      serverLTPK: Buffer.alloc(32, 0x03),
      serverId: 'server',
    });
    const serialized = creds.serialize();
    const restored = Credentials.deserialize(serialized);
    expect(restored.clientId).toBe('abc');
    expect(restored.serverLTPK).toEqual(Buffer.alloc(32, 0x03));
  });
});
