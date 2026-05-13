/**
 * @fileoverview writeEnvOutputForReload: template seed + merge without appending run-only keys
 */

'use strict';

jest.unmock('../../../lib/internal/fs-real-sync');

const fs = require('fs');
const os = require('os');
const path = require('path');
const secrets = require('../../../lib/core/secrets');
const { writeEnvOutputForReload } = require('../../../lib/utils/env-copy');

describe('writeEnvOutputForReload', () => {
  let dir;
  let genSpy;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-reload-env-'));
    genSpy = jest.spyOn(secrets, 'generateEnvContent').mockResolvedValue('# From template\nPORT=3000\n');
  });

  afterEach(() => {
    genSpy.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('seeds from local template when output is missing then merges .env.run', async() => {
    const outPath = path.join(dir, '.env');
    const runPath = path.join(dir, '.env.run');
    fs.writeFileSync(runPath, 'PORT=3010\n', 'utf8');

    await writeEnvOutputForReload(outPath, runPath, 'myapp');

    const written = fs.readFileSync(outPath, 'utf8');
    expect(written).toContain('# From template');
    expect(written).toMatch(/^PORT=3010$/m);
    expect(secrets.generateEnvContent).toHaveBeenCalledWith('myapp', null, 'local', false);
  });

  it('does not append keys only present in .env.run when output already exists', async() => {
    const outPath = path.join(dir, '.env');
    fs.writeFileSync(outPath, '# Header\nPORT=3000\n', 'utf8');
    const runPath = path.join(dir, '.env.run');
    fs.writeFileSync(runPath, 'PORT=3010\nDB_0_NAME=should-not-appear\n', 'utf8');

    await writeEnvOutputForReload(outPath, runPath, 'myapp');

    const written = fs.readFileSync(outPath, 'utf8');
    expect(written).toContain('# Header');
    expect(written).toMatch(/^PORT=3010$/m);
    expect(written).not.toContain('DB_0_NAME');
    expect(secrets.generateEnvContent).not.toHaveBeenCalled();
  });
});
