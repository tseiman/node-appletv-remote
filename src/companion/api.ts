import { randomInt } from 'node:crypto';
import type { OpackDict } from './opack.js';

const REMOTE_SERVICE = 'com.apple.tvremoteservices';

export interface RemoteSessionOptions {
  clientId: string;
  deviceId: string;
  model: string;
  name: string;
  localSessionId?: number;
}

export enum CompanionMessageType {
  Event = 1,
  Request = 2,
  Response = 3,
}

export interface CompanionTransport {
  sendRequest(identifier: string, message: OpackDict, timeoutMs?: number): Promise<OpackDict>;
  sendMessage(identifier: string, message: OpackDict): void;
}

export class CompanionAPI {
  private sessionId?: bigint;

  constructor(private readonly transport: CompanionTransport) {}

  async sendCommand(
    identifier: string,
    content: OpackDict = new Map(),
    timeoutMs?: number,
  ): Promise<OpackDict> {
    const message: OpackDict = new Map();
    message.set('_t', CompanionMessageType.Request);
    message.set('_c', content);
    return this.transport.sendRequest(identifier, message, timeoutMs);
  }

  sendEvent(identifier: string, content: OpackDict = new Map()): void {
    const message: OpackDict = new Map();
    message.set('_t', CompanionMessageType.Event);
    message.set('_c', content);
    this.transport.sendMessage(identifier, message);
  }

  subscribeEvent(event: string): void {
    const content: OpackDict = new Map();
    content.set('_regEvents', [event]);
    this.sendEvent('_interest', content);
  }

  async initializeRemoteSession(options: RemoteSessionOptions): Promise<bigint> {
    const stableDeviceId = options.deviceId.replaceAll(':', '').toLowerCase();
    const systemInfo: OpackDict = new Map();
    systemInfo.set('_bf', 0);
    systemInfo.set('_cf', 512);
    systemInfo.set('_clFl', 128);
    systemInfo.set('_i', stableDeviceId);
    systemInfo.set('_idsID', options.clientId);
    systemInfo.set('_pubID', options.deviceId);
    systemInfo.set('_sf', 256);
    systemInfo.set('_sv', '170.18');
    systemInfo.set('model', options.model);
    systemInfo.set('name', options.name);
    await this.sendCommand('_systemInfo', systemInfo);

    const localSessionId = options.localSessionId ?? randomInt(0, 0x1_0000_0000);
    const sessionStart: OpackDict = new Map();
    sessionStart.set('_srvT', REMOTE_SERVICE);
    sessionStart.set('_sid', localSessionId);
    const response = await this.sendCommand('_sessionStart', sessionStart);
    const responseContent = response.get('_c');
    if (!(responseContent instanceof Map)) {
      throw new Error('Companion session response is missing _c');
    }
    const remoteSessionId = responseContent.get('_sid');
    if (typeof remoteSessionId !== 'number' || !Number.isInteger(remoteSessionId)) {
      throw new Error('Companion session response is missing _sid');
    }

    const tvRemoteSession: OpackDict = new Map();
    tvRemoteSession.set('ProtocolVersionKey', '1.2');
    try {
      await this.sendCommand('TVRCSessionStart', tvRemoteSession);
    } catch {
      // Older and newer tvOS releases differ in whether this request exists.
      // The base Companion session and pushed events can still remain usable.
    }

    this.sessionId = (BigInt(remoteSessionId) << 32n) | BigInt(localSessionId);
    return this.sessionId;
  }

  async stopRemoteSession(): Promise<void> {
    if (this.sessionId === undefined) return;

    const sessionStop: OpackDict = new Map();
    sessionStop.set('_srvT', REMOTE_SERVICE);
    sessionStop.set('_sid', this.sessionId);
    await this.sendCommand('_sessionStop', sessionStop);
    this.sessionId = undefined;
  }
}
