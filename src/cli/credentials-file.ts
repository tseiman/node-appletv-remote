import { chmodSync, existsSync, writeFileSync } from 'node:fs';

const OWNER_READ_WRITE = 0o600;

export function writeCredentialsFile(path: string, credentials: Record<string, string>): void {
  // Secure an existing store before replacing its contents; mode only affects
  // newly created files and tightening it afterwards leaves a brief exposure.
  if (existsSync(path)) chmodSync(path, OWNER_READ_WRITE);
  writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: 'utf8',
    mode: OWNER_READ_WRITE,
  });
  chmodSync(path, OWNER_READ_WRITE);
}
