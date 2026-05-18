'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  readDimensionCreateFile,
  normalizeValueType
} = require('../../../lib/resolvers/dimension-file');

describe('dimension-file valueType', () => {
  let tmpFile;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dim-file-'));
    tmpFile = path.join(dir, 'dim.json');
  });

  it('defaults valueType to static when omitted', () => {
    fs.writeFileSync(
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
