import { describe, expect, it } from 'vitest';
import { CompanionAPI, CompanionMessageType } from '../api.js';
import { CompanionSystemStatus } from '../../power-state.js';
import type { OpackDict } from '../opack.js';

class RecordingTransport {
  readonly requests: Array<{ identifier: string; message: OpackDict }> = [];
  readonly messages: Array<{ identifier: string; message: OpackDict }> = [];
  readonly responses = new Map<string, OpackDict>();
  readonly failures = new Map<string, Error>();

  async sendRequest(identifier: string, message: OpackDict): Promise<OpackDict> {
    this.requests.push({ identifier, message });
    const failure = this.failures.get(identifier);
    if (failure) throw failure;
    return this.responses.get(identifier) ?? new Map();
  }

  sendMessage(identifier: string, message: OpackDict): void {
    this.messages.push({ identifier, message });
  }
}

describe('CompanionAPI', () => {
  it('wraps commands in a Companion request envelope', async () => {
    const transport = new RecordingTransport();
    const api = new CompanionAPI(transport);
    const content: OpackDict = new Map([['value', 42]]);

    await api.sendCommand('TestCommand', content);

    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0].identifier).toBe('TestCommand');
    expect(transport.requests[0].message.get('_t')).toBe(CompanionMessageType.Request);
    expect(transport.requests[0].message.get('_c')).toBe(content);
  });

  it('wraps subscriptions in a Companion event envelope', () => {
    const transport = new RecordingTransport();
    const api = new CompanionAPI(transport);

    api.subscribeEvent('SystemStatus');

    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0].identifier).toBe('_interest');
    expect(transport.messages[0].message.get('_t')).toBe(CompanionMessageType.Event);
    const content = transport.messages[0].message.get('_c') as OpackDict;
    expect(content.get('_regEvents')).toEqual(['SystemStatus']);
  });

  it('initializes the Companion remote session in protocol order', async () => {
    const transport = new RecordingTransport();
    const sessionContent: OpackDict = new Map([['_sid', 0x89abcdef]]);
    transport.responses.set('_sessionStart', new Map([['_c', sessionContent]]));
    const api = new CompanionAPI(transport);

    const sessionId = await api.initializeRemoteSession({
      clientId: 'pairing-client',
      deviceId: 'AA:BB:CC:DD:EE:FF',
      model: 'AppleTV6,2',
      name: 'KidControl',
      localSessionId: 0x12345678,
    });

    expect(transport.requests.map(({ identifier }) => identifier)).toEqual([
      '_systemInfo',
      '_sessionStart',
      'TVRCSessionStart',
    ]);
    expect(sessionId).toBe(0x89abcdef12345678n);

    const systemInfo = transport.requests[0].message.get('_c') as OpackDict;
    expect(systemInfo.get('_i')).toBe('aabbccddeeff');
    expect(systemInfo.get('_idsID')).toBe('pairing-client');
    expect(systemInfo.get('model')).toBe('AppleTV6,2');
    expect(systemInfo.get('name')).toBe('KidControl');

    const sessionStart = transport.requests[1].message.get('_c') as OpackDict;
    expect(sessionStart.get('_srvT')).toBe('com.apple.tvremoteservices');
    expect(sessionStart.get('_sid')).toBe(0x12345678);

    const tvRemoteSession = transport.requests[2].message.get('_c') as OpackDict;
    expect(tvRemoteSession.get('ProtocolVersionKey')).toBe('1.2');
  });

  it('keeps the remote session usable when TVRCSessionStart is unsupported', async () => {
    const transport = new RecordingTransport();
    transport.responses.set(
      '_sessionStart',
      new Map([['_c', new Map([['_sid', 7]])]]),
    );
    transport.failures.set('TVRCSessionStart', new Error('No request handler'));
    const api = new CompanionAPI(transport);

    await expect(api.initializeRemoteSession({
      clientId: 'pairing-client',
      deviceId: 'AA:BB:CC:DD:EE:FF',
      model: 'AppleTV6,2',
      name: 'KidControl',
      localSessionId: 8,
    })).resolves.toBe(0x0000000700000008n);
  });

  it('stops an initialized remote session with its combined session id', async () => {
    const transport = new RecordingTransport();
    transport.responses.set(
      '_sessionStart',
      new Map([['_c', new Map([['_sid', 7]])]]),
    );
    const api = new CompanionAPI(transport);
    await api.initializeRemoteSession({
      clientId: 'pairing-client',
      deviceId: 'AA:BB:CC:DD:EE:FF',
      model: 'AppleTV6,2',
      name: 'KidControl',
      localSessionId: 8,
    });
    transport.requests.length = 0;

    await api.stopRemoteSession();

    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0].identifier).toBe('_sessionStop');
    const content = transport.requests[0].message.get('_c') as OpackDict;
    expect(content.get('_srvT')).toBe('com.apple.tvremoteservices');
    expect(content.get('_sid')).toBe(0x0000000700000008n);
  });

  it('fetches the current Companion attention state', async () => {
    const transport = new RecordingTransport();
    transport.responses.set(
      'FetchAttentionState',
      new Map([['_c', new Map([['state', CompanionSystemStatus.Asleep]])]]),
    );
    const api = new CompanionAPI(transport);

    await expect(api.fetchAttentionState()).resolves.toBe(CompanionSystemStatus.Asleep);
  });
});
