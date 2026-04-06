/**
 * @fileoverview Tests for lib/utils/datasource-test-run-schema-sync.js
 *
 * Reset modules before each test so this suite never inherits a `node:fs` binding
 * from another project that ran in the same Jest worker with jest.mock('fs').
 */

const crypto = require('crypto');
const path = require('path');
const os = require('os');

let sha256FileSync;
let assertDatasourceTestRunSchemasInSync;

function loadSut() {
  ({
    sha256FileSync,
    assertDatasourceTestRunSchemasInSync
  } = require('../../../lib/utils/datasource-test-run-schema-sync'));
}

beforeEach(() => {
  jest.resetModules();
  loadSut();
});

function withSchemaSyncTempDir(fn) {
  const fs = require('node:fs');
  const unique = `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `schema-sync-${unique}-`));
  try {
    return fn(dir, fs);
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    } catch {
      // best-effort
    }
  }
}

describe('datasource-test-run-schema-sync', () => {
  it('sha256FileSync is stable for same bytes', () => {
    withSchemaSyncTempDir((dir, fs) => {
      const f = path.join(dir, 'a.json');
      fs.writeFileSync(f, '{"a":1}', 'utf8');
      const h1 = sha256FileSync(f);
      const h2 = sha256FileSync(f);
      expect(h1).toBe(h2);
      expect(h1.length).toBe(64);
    });
  });

  it('assertDatasourceTestRunSchemasInSync skips when dataplane missing', () => {
    withSchemaSyncTempDir((dir, fs) => {
      const b = path.join(dir, 'b.json');
      fs.writeFileSync(b, '{}', 'utf8');
      const d = path.join(dir, `absent-dataplane-${crypto.randomUUID()}.json`);
      const r = assertDatasourceTestRunSchemasInSync(b, d);
      expect(r.skipped).toBe(true);
    });
  });

  it('assertDatasourceTestRunSchemasInSync throws on drift', () => {
    withSchemaSyncTempDir((dir, fs) => {
      const b = path.join(dir, 'b.json');
      const d = path.join(dir, 'd.json');
      fs.writeFileSync(b, '{"x":1}', 'utf8');
      fs.writeFileSync(d, '{"x":2}', 'utf8');
      expect(() => assertDatasourceTestRunSchemasInSync(b, d)).toThrow(/schema drift/);
    });
  });

  it('assertDatasourceTestRunSchemasInSync ok when equal', () => {
    withSchemaSyncTempDir((dir, fs) => {
      const b = path.join(dir, 'b.json');
      const d = path.join(dir, 'd.json');
      const content = '{"same":true}\n';
      fs.writeFileSync(b, content, 'utf8');
      fs.writeFileSync(d, content, 'utf8');
      const r = assertDatasourceTestRunSchemasInSync(b, d);
      expect(r.skipped).toBe(false);
      expect(r.builderSha).toBe(r.dataplaneSha);
    });
  });
});
