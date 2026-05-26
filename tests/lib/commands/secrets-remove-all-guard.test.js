/**
 * @fileoverview writeEmptySecretsFile must refuse the operator secrets tree during Jest.
 */

'use strict';

const path = require('path');
const os = require('os');

jest.unmock('fs');

const { writeEmptySecretsFile } = require('../../../lib/commands/secrets-remove-all');

describe('secrets-remove-all write guard', () => {
  const originalJestId = process.env.JEST_WORKER_ID;

  beforeEach(() => {
    process.env.JEST_WORKER_ID = '1';
  });

  afterEach(() => {
    if (originalJestId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalJestId;
    }
  });

  it('refuses to empty live user secrets.local.yaml', () => {
    const livePath = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');
    expect(() => writeEmptySecretsFile(livePath)).toThrow(/Refusing to write secrets/);
  });

  it('allows empty write under os.tmpdir', () => {
    const fs = require('fs');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifx-rm-all-'));
    const secretsPath = path.join(tmpDir, 'secrets.local.yaml');
    fs.writeFileSync(secretsPath, 'k: v\n', 'utf8');
    expect(() => writeEmptySecretsFile(secretsPath)).not.toThrow();
    expect(fs.readFileSync(secretsPath, 'utf8').trim()).toBe('{}');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
