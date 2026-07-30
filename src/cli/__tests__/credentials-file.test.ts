import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeCredentialsFile } from '../credentials-file.js';

describe('writeCredentialsFile', () => {
  it('creates a new credential file with owner-only permissions', () => {
    const directory = mkdtempSync(join(tmpdir(), 'atv-credentials-'));
    const path = join(directory, 'credentials.json');

    writeCredentialsFile(path, { device: 'serialized-credentials' });

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      device: 'serialized-credentials',
    });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('writes valid JSON and tightens permissions on an existing file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'atv-credentials-'));
    const path = join(directory, 'credentials.json');
    writeFileSync(path, '{}', { mode: 0o644 });

    writeCredentialsFile(path, { device: 'serialized-credentials' });

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      device: 'serialized-credentials',
    });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});
