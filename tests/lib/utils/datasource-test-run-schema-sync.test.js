/**
 * @fileoverview Tests for lib/utils/datasource-test-run-schema-sync.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  sha256FileSync,
  assertDatasourceTestRunSchemasInSync
} = require('../../../lib/utils/datasource-test-run-schema-sync');

function withSchemaSyncTempDir(fn) {
  const unique = `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `schema-sync-${unique}-`));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('datasource-test-run-schema-sync', () => {
  it('sha256FileSync is stable for same bytes', () => {
    withSchemaSyncTempDir(dir => {
      const f = path.join(dir, 'a.json');
      fs.writeFileSync(f, '{"a":1}', 'utf8');
      const h1 = sha256FileSync(f);
      const h2 = sha256FileSync(f);
      expect(h1).toBe(h2);
      expect(h1.length).toBe(64);
    });
  });

  it('assertDatasourceTestRunSchemasInSync skips when dataplane missing', () => {
    withSchemaSyncTempDir(dir => {
      const b = path.join(dir, 'b.json');
      fs.writeFileSync(b, '{}', 'utf8');
      const d = path.join(dir, `absent-dataplane-${crypto.randomUUID()}.json`);
      const r = assertDatasourceTestRunSchemasInSync(b, d);
      expect(r.skipped).toBe(true);
    });
  });

  it('assertDatasourceTestRunSchemasInSync throws on drift', () => {
    withSchemaSyncTempDir(dir => {
      const b = path.join(dir, 'b.json');
      const d = path.join(dir, 'd.json');
      fs.writeFileSync(b, '{"x":1}', 'utf8');
      fs.writeFileSync(d, '{"x":2}', 'utf8');
      expect(() => assertDatasourceTestRunSchemasInSync(b, d)).toThrow(/schema drift/);
    });
  });

  it('assertDatasourceTestRunSchemasInSync ok when equal', () => {
    withSchemaSyncTempDir(dir => {
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
