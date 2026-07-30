import { chmodSync, writeFileSync } from 'node:fs';

const OWNER_READ_WRITE = 0o600;

export function writeCredentialsFile(path: string, credentials: Record<string, string>): void {
  writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: 'utf8',
    mode: OWNER_READ_WRITE,
  });
  // The mode option only affects newly created files. Tighten an existing file too.
  chmodSync(path, OWNER_READ_WRITE);
}
