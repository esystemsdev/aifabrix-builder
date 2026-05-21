'use strict';

const path = require('path');
const {
  existsSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync
} = require('../../../lib/internal/fs-real-sync');
const {
  readDimensionCreateFile,
  normalizeValueType
} = require('../../../lib/resolvers/dimension-file');

describe('dimension-file valueType', () => {
  let tmpDir;
  let tmpFile;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(__dirname, '../../../.temp/dim-file-'));
    tmpFile = path.join(tmpDir, 'dim.json');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      try {
        rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
      } catch {
        /* best-effort */
      }
    }
  });

  it('defaults valueType to static when omitted', () => {
    writeFileSync(
      tmpFile,
      JSON.stringify({
        key: 'region',
        displayName: 'Region',
        dataType: 'string'
      })
    );
    const parsed = readDimensionCreateFile(tmpFile);
    expect(parsed.valueType).toBe('static');
  });

  it('reads dynamic valueType from file', () => {
    const fixture = path.join(__dirname, '../../fixtures/dimension/department-dynamic.json');
    const parsed = readDimensionCreateFile(fixture);
    expect(parsed.valueType).toBe('dynamic');
  });

  it('rejects invalid valueType enum', () => {
    expect(() => normalizeValueType('hybrid')).toThrow(/static, dynamic, both/);
  });
});
