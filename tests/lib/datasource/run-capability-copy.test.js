/**
 * @fileoverview Tests for run-capability-copy file helpers and error paths
 *
 * Uses `node:fs` so assertions are not affected by other suites' `jest.mock('fs')`.
 */

const fs = require('node:fs');
const os = require('os');
const path = require('path');

const {
  runCapabilityCopy,
  writeBackup,
  atomicWriteJson
} = require('../../../lib/datasource/capability/run-capability-copy');

describe('writeBackup', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-bak-'));
    file = path.join(dir, 'ds.json');
    fs.writeFileSync(file, '{"x":1}\n', 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('writes backup under backup/ with .bak suffix when noBackup is false', () => {
    const bak = writeBackup(file, false);
    expect(bak).toBeTruthy();
    expect(fs.existsSync(bak)).toBe(true);
    expect(bak).toContain(`${path.sep}backup${path.sep}`);
    expect(bak.endsWith('.bak')).toBe(true);
    expect(fs.readFileSync(bak, 'utf8')).toContain('"x"');
  });

  it('returns null when noBackup is true', () => {
    expect(writeBackup(file, true)).toBeNull();
  });
});

describe('atomicWriteJson', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-atom-'));
    file = path.join(dir, 'out.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('writes JSON with trailing newline via rename', () => {
    atomicWriteJson(file, { a: 1 });
    expect(fs.existsSync(file)).toBe(true);
    const raw = fs.readFileSync(file, 'utf8');
    expect(raw.trim()).toBe(JSON.stringify({ a: 1 }, null, 2));
    expect(raw.endsWith('\n')).toBe(true);
  });
});

describe('runCapabilityCopy error paths', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-run-'));
    file = path.join(dir, 'ds.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        openapi: { operations: {} },
        execution: { engine: 'cip', cip: { operations: {} } },
        capabilities: []
      }),
      'utf8'
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('throws when source capability missing from openapi.operations', async() => {
    await expect(
      runCapabilityCopy({
        fileOrKey: file,
        from: 'missing',
        as: 'copy',
        dryRun: true
      })
    ).rejects.toThrow(/Missing openapi.operations entry for capability "missing"/);
  });
});
