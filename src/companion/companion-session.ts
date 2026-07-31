/**
 * ChaCha20-Poly1305 encryption session for the Companion protocol.
 * Differs from HAPSession:
 * - AAD = the 4-byte frame header (type + 3-byte encrypted payload length)
 * - Encrypts whole messages (no 1024-byte chunking)
 * - Counter-based nonce, separate TX/RX counters
 */

import { encryptChaCha20, decryptChaCha20 } from '../util/crypto.js';
import { FrameType } from './framing.js';

const AUTH_TAG_LENGTH = 16;

function companionNonce(counter: bigint): Buffer {
  const nonce = Buffer.alloc(12);
  nonce.writeBigUInt64LE(counter, 0);
  return nonce;
}

export class CompanionSession {
  private outCounter = 0n;
  private inCounter = 0n;

  constructor(
    private outKey: Buffer,
    private inKey: Buffer,
  ) {}

  /**
   * Encrypt a companion payload for sending.
   * Returns a complete frame: 4-byte header + ciphertext + 16-byte auth tag.
   */
  encrypt(frameType: FrameType, plaintext: Buffer): Buffer {
    const nonce = companionNonce(this.outCounter);
    this.outCounter++;

    // Companion frame lengths include the authentication tag. The receiver
    // uses this value to read the complete ciphertext before decrypting it.
    const encryptedLength = plaintext.length + AUTH_TAG_LENGTH;
    const header = Buffer.alloc(4);
    header[0] = frameType;
    header[1] = (encryptedLength >> 16) & 0xff;
    header[2] = (encryptedLength >> 8) & 0xff;
    header[3] = encryptedLength & 0xff;

    const { ciphertext, tag } = encryptChaCha20(
      this.outKey,
      nonce,
      plaintext,
      header,
    );

    return Buffer.concat([header, ciphertext, tag]);
  }

  /**
   * Decrypt a companion frame payload.
   * Input: raw data after the 4-byte frame header has been parsed.
   * The header bytes are needed as AAD.
   */
  decrypt(header: Buffer, encryptedPayload: Buffer): Buffer {
    const nonce = companionNonce(this.inCounter);
    this.inCounter++;

    const ciphertext = encryptedPayload.subarray(0, encryptedPayload.length - AUTH_TAG_LENGTH);
    const tag = encryptedPayload.subarray(encryptedPayload.length - AUTH_TAG_LENGTH);

    return decryptChaCha20(
      this.inKey,
      nonce,
      ciphertext,
      tag,
      header,
    );
  }
}
